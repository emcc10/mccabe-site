import { copyFileSync, createWriteStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const repoRoot = process.cwd();
const clipsDir = join(repoRoot, 'vspfiles/home-hero-clips');
const outPath = join(repoRoot, 'vspfiles/windsor.mp4');
const ffmpeg = ffmpegInstaller.path;

/** Mixkit free stock clips (Mixkit License). Furniture-forward, residential home interiors. */
const CLIPS = [
  {
    name: 'living-room-sofa',
    // Couple on a cozy home sofa — living room visible, not the gray minimalist zoom.
    url: 'https://assets.mixkit.co/videos/4858/4858-1080.mp4',
    start: 2,
    seconds: 4,
  },
  {
    name: 'blanket-on-sofa',
    // Brown sofa with a plush throw blanket draped over it.
    url: 'https://assets.mixkit.co/videos/4710/4710-1080.mp4',
    start: 1,
    seconds: 4,
  },
  {
    name: 'dining-table-gathering',
    // Elegant dining table set with people gathered — furniture in frame.
    url: 'https://assets.mixkit.co/videos/42151/42151-1080.mp4',
    start: 0,
    seconds: 4,
  },
  {
    name: 'home-living-room',
    // Modern residential living room — not a hotel pan.
    url: 'https://assets.mixkit.co/videos/3090/3090-1080.mp4',
    start: 1,
    seconds: 4,
  },
] as const;

const TARGET_W = 1920;
const TARGET_H = 1080;
const TARGET_FPS = 30;

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), createWriteStream(dest));
}

function trimClip(input: string, output: string, start: number, seconds: number): void {
  const result = spawnSync(
    ffmpeg,
    [
      '-y',
      '-ss',
      String(start),
      '-i',
      input,
      '-t',
      String(seconds),
      '-vf',
      `scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,crop=${TARGET_W}:${TARGET_H},fps=${TARGET_FPS},format=yuv420p`,
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      output,
    ],
    { stdio: 'inherit', encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg trim failed for ${input}`);
  }
}

function concatClips(clips: string[], output: string): void {
  const listPath = join(clipsDir, 'concat-list.txt');
  writeFileSync(
    listPath,
    clips.map((c) => `file '${c.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8',
  );

  const result = spawnSync(
    ffmpeg,
    ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', output],
    { stdio: 'inherit', encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error('ffmpeg concat failed');
  }
}

async function main(): Promise<void> {
  mkdirSync(clipsDir, { recursive: true });

  if (existsSync(outPath)) {
    copyFileSync(outPath, `${outPath}.bak`);
    console.log('[home-hero-stock] Backed up existing windsor.mp4');
  }

  const trimmed: string[] = [];
  for (const clip of CLIPS) {
    const raw = join(clipsDir, `${clip.name}-raw.mp4`);
    const cut = join(clipsDir, `${clip.name}-cut.mp4`);
    console.log(`[home-hero-stock] Downloading ${clip.name}…`);
    await download(clip.url, raw);
    console.log(`[home-hero-stock] Trimming ${clip.name}…`);
    trimClip(raw, cut, clip.start, clip.seconds);
    trimmed.push(cut);
  }

  console.log('[home-hero-stock] Concatenating…');
  concatClips(trimmed, outPath);
  console.log('[home-hero-stock] Saved', outPath);
}

main().catch((err) => {
  console.error('[home-hero-stock] Failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
