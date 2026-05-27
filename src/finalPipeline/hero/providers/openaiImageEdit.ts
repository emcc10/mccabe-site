import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { HeroGenerativeRequest, HeroGenerativeResult } from '../spec.js';
import { buildFullEditPrompt } from '../prompt.js';
import {
  buildOpenAiEditMaskPng,
  computeEditCanvasMapping,
  cropEditCanvasToSource,
  letterboxToEditCanvas,
} from '../prepareEdit.js';
import type { HeroGenerativeProvider } from '../generativeProvider.js';
import { HeroProviderNotConfiguredError } from '../generativeProvider.js';
import { loadRgba } from '../../../phase1/segment.js';

function readKeyFile(): string | undefined {
  const path = process.env.OPENAI_API_KEY_FILE?.trim() || process.env.HERO_OPENAI_KEY_FILE?.trim();
  if (!path) return undefined;
  try {
    return sanitizeApiKey(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Trim BOM/quotes; reject obvious placeholders and truncated keys. */
export function sanitizeApiKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let k = raw.trim().replace(/^\uFEFF/, '');
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (!k || k === 'sk-...' || k === 'sk-proj-...' || /^sk-[a-z]*\.\.\.$/i.test(k)) {
    return undefined;
  }
  return k;
}

function apiKey(): string | undefined {
  return (
    sanitizeApiKey(process.env.OPENAI_API_KEY) ||
    sanitizeApiKey(process.env.HERO_GENERATIVE_API_KEY) ||
    readKeyFile()
  );
}

function assertKeyLooksValid(key: string): void {
  if (key.length < 80) {
    throw new OpenAIApiError(
      401,
      [
        `OPENAI_API_KEY looks truncated (${key.length} characters; real keys are usually 150+).`,
        'Copy the full key from https://platform.openai.com/api-keys',
        'Tip: put it in .env.local as OPENAI_API_KEY=sk-proj-... (no quotes) and re-run npm run render:hero-pipeline',
      ].join('\n'),
    );
  }
  if (!key.startsWith('sk-')) {
    throw new OpenAIApiError(
      401,
      'OPENAI_API_KEY should start with sk-. Check you copied a secret key, not a project ID or org name.',
    );
  }
}

export class OpenAIApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'OpenAIApiError';
    this.status = status;
  }
}

/** Fail fast before image edits if the key is missing or rejected. */
export async function verifyOpenAiApiKey(): Promise<void> {
  const key = apiKey();
  if (!key) {
    throw new HeroProviderNotConfiguredError(
      'openai',
      'Set OPENAI_API_KEY, HERO_GENERATIVE_API_KEY, or OPENAI_API_KEY_FILE (path to a one-line key file).',
    );
  }
  assertKeyLooksValid(key);

  const res = await fetch('https://api.openai.com/v1/models?limit=1', {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (res.ok) return;

  const text = await res.text();
  let message = text.slice(0, 300);
  try {
    const json = JSON.parse(text) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch {
    /* keep raw slice */
  }

  if (res.status === 401) {
    throw new OpenAIApiError(
      401,
      [
        'OpenAI rejected the API key (401 Unauthorized).',
        'Use a valid key from https://platform.openai.com/api-keys',
        'Set it in the same terminal before running:',
        '  $env:OPENAI_API_KEY = "sk-..."',
        'Do not use a placeholder like sk-....',
        `Server message: ${message}`,
      ].join('\n'),
    );
  }

  throw new OpenAIApiError(res.status, `OpenAI API check failed (${res.status}): ${message}`);
}

function isNonRetryableError(err: unknown): boolean {
  if (err instanceof OpenAIApiError) {
    return err.status === 401 || err.status === 403 || err.status === 429;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(401|403)\b/.test(msg) || /incorrect api key/i.test(msg);
}

async function postOpenAiEdit(form: FormData): Promise<Buffer> {
  const key = apiKey();
  if (!key) {
    throw new HeroProviderNotConfiguredError(
      'openai',
      'Set OPENAI_API_KEY or HERO_GENERATIVE_API_KEY.',
    );
  }

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  const text = await res.text();
  let json: { data?: { b64_json?: string }[]; error?: { message?: string } };
  try {
    json = JSON.parse(text);
  } catch {
    throw new OpenAIApiError(res.status, `OpenAI image edit: invalid JSON: ${text.slice(0, 400)}`);
  }

  if (!res.ok) {
    const message = json.error?.message ?? text.slice(0, 400);
    throw new OpenAIApiError(res.status, `OpenAI image edit failed (${res.status}): ${message}`);
  }

  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image edit: missing b64_json in response');
  return Buffer.from(b64, 'base64');
}

export class OpenAIImageEditProvider implements HeroGenerativeProvider {
  readonly id = 'openai';

  isConfigured(): boolean {
    return Boolean(apiKey());
  }

  async generate(
    request: HeroGenerativeRequest,
    outputPath: string,
  ): Promise<HeroGenerativeResult> {
    if (!request.variant) {
      throw new Error('HeroGenerativeRequest.variant is required for OpenAI provider');
    }

    const basePath = request.bundle.paths.referenceBaseRecolor;
    const source = await loadRgba(basePath);
    const mapping = computeEditCanvasMapping(source.width, source.height);

    const imagePng = await letterboxToEditCanvas(basePath, mapping);
    const maskPng = await buildOpenAiEditMaskPng(request.upholstery, mapping);

    const bundleDir = request.bundle.paths.bundleDir;
    mkdirSync(bundleDir, { recursive: true });
    const debugImage = join(bundleDir, `openai-canvas-image-${request.variant.id}.png`);
    const debugMask = join(bundleDir, `openai-canvas-mask-${request.variant.id}.png`);
    writeFileSync(debugImage, imagePng);
    writeFileSync(debugMask, maskPng);

    const prompt = buildFullEditPrompt(request.bundle.promptParts, request.variant);
    const size = `${mapping.canvasSize}x${mapping.canvasSize}`;

    const attempt = async (model: string, withFidelity: boolean) => {
      const form = new FormData();
      form.append('model', model);
      form.append('image', new Blob([imagePng], { type: 'image/png' }), 'image.png');
      form.append('mask', new Blob([maskPng], { type: 'image/png' }), 'mask.png');
      form.append('prompt', prompt);
      form.append('n', '1');
      form.append('size', size);
      if (withFidelity && model.startsWith('gpt-image')) {
        form.append('input_fidelity', request.variant!.inputFidelity);
      }
      return postOpenAiEdit(form);
    };

    let canvasResult: Buffer;
    let modelUsed = request.variant.model;
    try {
      canvasResult = await attempt(request.variant.model, true);
    } catch (firstErr) {
      if (isNonRetryableError(firstErr)) throw firstErr;
      if (request.variant.model !== 'dall-e-2') {
        console.warn(
          `[hero/openai] ${request.variant.model} failed (${firstErr instanceof Error ? firstErr.message : firstErr}), retrying dall-e-2...`,
        );
        canvasResult = await attempt('dall-e-2', false);
        modelUsed = 'dall-e-2';
      } else {
        throw firstErr;
      }
    }

    const cropped = await cropEditCanvasToSource(canvasResult, mapping);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, cropped);

    return {
      generativeRgbPath: outputPath,
      providerId: this.id,
      metadata: {
        model: modelUsed,
        size,
        inputFidelity: request.variant.inputFidelity,
        variantId: request.variant.id,
        debugCanvasImage: debugImage,
        debugCanvasMask: debugMask,
      },
    };
  }
}
