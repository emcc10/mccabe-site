import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const repoRoot = process.cwd();
const framesDir = join(repoRoot, 'vspfiles/home-hero-frames');
const outPath = join(repoRoot, 'vspfiles/windsor.mp4');
const ffmpeg = ffmpegInstaller.path;

const FRAME_ORDER = [
  'home-hero-frame1-sofas.jpg',
  'home-hero-frame2-blankets.jpg',
  'home-hero-frame3-mahjong.jpg',
  'home-hero-frame4-wide.jpg',
];

const SECONDS_PER_FRAME = 4;
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const FRAMES = SECONDS_PER_FRAME * FPS;

function framePath(name: string): string {
  const path = join(framesDir, name);
  if (!existsSync(path)) {
    throw new Error(`Missing frame: ${path}`);
  }
  return path;
}

function renderClip(input: string, output: string, panRight: boolean): void {
  const xExpr = panRight
    ? "x='iw/2-(iw/zoom/2)+on*0.12'"
    : "x='iw/2-(iw/zoom/2)-on*0.12'";
  const vf =
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${WIDTH}:${HEIGHT},` +
    `zoompan=z='min(zoom+0.0006,1.08)':${xExpr}:y='ih/2-(ih/zoom/2)':` +
    `d=${FRAMES}:s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p`;

  const result = spawnSync(
    ffmpeg,
    [
      '-y',
      '-loop',
      '1',
      '-i',
      input,
      '-frames:v',
      String(FRAMES),
      '-vf',
      vf,
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      output,
    ],
    { stdio: 'inherit', encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg clip render failed (${input})`);
  }
}

function concatClips(clips: string[], output: string): void {
  const listPath = join(tmpdir(), `mc-hero-clips-${Date.now()}.txt`);
  writeFileSync(
    listPath,
    clips.map((c) => `file '${c.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8',
  );

  const result = spawnSync(
    ffmpeg,
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      output,
    ],
    { stdio: 'inherit', encoding: 'utf8' },
  );

  rmSync(listPath, { force: true });
  if (result.status !== 0) {
    throw new Error('ffmpeg concat failed');
  }
}

function main(): void {
  const available = readdirSync(framesDir);
  for (const name of FRAME_ORDER) {
    if (!available.includes(name)) {
      throw new Error(`Expected ${name} in ${framesDir}`);
    }
  }

  if (existsSync(outPath)) {
    copyFileSync(outPath, `${outPath}.bak`);
    console.log('[assemble-home-hero] Backed up existing windsor.mp4');
  }

  const workDir = mkdtempSync(join(tmpdir(), 'mc-hero-clips-'));
  const clips: string[] = [];

  try {
    FRAME_ORDER.forEach((name, i) => {
      const clipPath = join(workDir, `clip-${i + 1}.mp4`);
      console.log(`[assemble-home-hero] Rendering clip ${i + 1}/${FRAME_ORDER.length}…`);
      renderClip(framePath(name), clipPath, i % 2 === 0);
      clips.push(clipPath);
    });

    console.log('[assemble-home-hero] Concatenating clips…');
    concatClips(clips, outPath);
    console.log('[assemble-home-hero] Saved', outPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
