import { mkdirSync, writeFileSync } from 'fs';
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

function apiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || process.env.HERO_GENERATIVE_API_KEY?.trim();
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
    throw new Error(`OpenAI image edit: invalid JSON (${res.status}): ${text.slice(0, 400)}`);
  }

  if (!res.ok) {
    throw new Error(
      `OpenAI image edit failed (${res.status}): ${json.error?.message ?? text.slice(0, 400)}`,
    );
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
      if (request.variant.model !== 'dall-e-2') {
        console.warn(`[hero/openai] ${request.variant.model} failed, retrying dall-e-2:`, firstErr);
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
