import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadEnvLocal } from './loadEnvLocal.js';
import { sanitizeApiKey } from '../src/finalPipeline/hero/providers/openaiImageEdit.js';

loadEnvLocal();

const DEFAULT_PROMPT =
  'Live-action cinematic B-roll montage for a premium home furnishings store. ' +
  'Real camera movement throughout — dolly, pan, and glide — not a slideshow. ' +
  'Scene 1: elegant leather sofas in a warm living room, no people. ' +
  'Scene 2: plush luxury throw blankets draped on seating, fabric moving naturally. ' +
  'Scene 3: younger adult women in their 30s and 40s laughing together at a wood dining table playing mahjong; ' +
  'no elderly people, no old men. ' +
  'Photorealistic live-action commercial footage, warm golden light, no text, no logos.';

type VideoJob = {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  error?: { code?: string; message?: string };
};

function apiKey(): string {
  const key =
    sanitizeApiKey(process.env.OPENAI_API_KEY) ||
    sanitizeApiKey(process.env.HERO_GENERATIVE_API_KEY);
  if (!key) {
    throw new Error(
      'No OPENAI_API_KEY in .env.local — add your key from platform.openai.com/api-keys',
    );
  }
  return key;
}

async function createVideoJob(prompt: string): Promise<VideoJob> {
  const form = new FormData();
  form.set('model', process.env.HOME_HERO_VIDEO_MODEL?.trim() || 'sora-2');
  form.set('prompt', prompt);
  form.set('size', process.env.HOME_HERO_VIDEO_SIZE?.trim() || '1280x720');
  form.set('seconds', process.env.HOME_HERO_VIDEO_SECONDS?.trim() || '12');

  const res = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });

  const body = (await res.json()) as VideoJob & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(
      `OpenAI video create failed (${res.status}): ${body.error?.message || JSON.stringify(body)}`,
    );
  }
  return body;
}

async function pollVideoJob(id: string): Promise<VideoJob> {
  const maxWaitMs = Number(process.env.HOME_HERO_VIDEO_MAX_WAIT_MS || 20 * 60 * 1000);
  const intervalMs = Number(process.env.HOME_HERO_VIDEO_POLL_MS || 15_000);
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(`https://api.openai.com/v1/videos/${id}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    const job = (await res.json()) as VideoJob & { error?: { message?: string } };
    if (!res.ok) {
      throw new Error(
        `OpenAI video poll failed (${res.status}): ${job.error?.message || JSON.stringify(job)}`,
      );
    }

    const pct = typeof job.progress === 'number' ? `${job.progress}%` : '—';
    console.log(`[home-hero-video] ${job.status} (${pct})`);

    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new Error(
        `Video generation failed: ${job.error?.message || job.error?.code || 'unknown error'}`,
      );
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Timed out waiting for video ${id} after ${maxWaitMs / 1000}s`);
}

async function downloadVideo(id: string, outPath: string): Promise<void> {
  const res = await fetch(`https://api.openai.com/v1/videos/${id}/content?variant=video`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(join(outPath, '..'), { recursive: true });
  writeFileSync(outPath, buf);
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const outPath = join(repoRoot, process.env.HOME_HERO_VIDEO_OUT?.trim() || 'vspfiles/windsor.mp4');
  const prompt = process.argv.slice(2).join(' ').trim() || DEFAULT_PROMPT;

  console.log('[home-hero-video] Creating Sora job…');
  console.log('[home-hero-video] Prompt:', prompt.slice(0, 160) + (prompt.length > 160 ? '…' : ''));

  const job = await createVideoJob(prompt);
  console.log('[home-hero-video] Job id:', job.id);

  await pollVideoJob(job.id);

  if (existsSync(outPath)) {
    const backup = `${outPath}.bak`;
    copyFileSync(outPath, backup);
    console.log('[home-hero-video] Backed up existing file to', backup);
  }

  console.log('[home-hero-video] Downloading MP4…');
  await downloadVideo(job.id, outPath);
  console.log('[home-hero-video] Saved', outPath);
}

main().catch((err) => {
  console.error('[home-hero-video] Failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
