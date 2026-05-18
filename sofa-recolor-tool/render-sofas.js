/**
 * LAB luminance-map recolor — sofa fold structure → swatch brightness range; swatch chroma only.
 */
import AdmZip from 'adm-zip';
import convert from 'color-convert';
import {
  mkdirSync,
  readdirSync,
  existsSync,
  renameSync,
  unlinkSync,
  statSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const INPUT_DIR = join(ROOT, 'input');
const SWATCH_DIR = join(INPUT_DIR, 'swatches');
const OUTPUT_DIR = join(ROOT, 'output');
const SOFA_PATH = join(INPUT_DIR, 'sofa.png');
const MASK_PATH = join(INPUT_DIR, 'mask.png');
const ZIP_PATH = join(OUTPUT_DIR, 'sofa-renders.zip');
const DEFAULT_PREVIEW_SWATCH = 'Bali-Currant.jpg';

const BG_THRESH = 235;
const FLOOR_BELOW_SOFA_PX = 4;
const SWATCH_CENTER_CROP = 0.4;
const SWATCH_BLUR_PX = 10;
const SWATCH_LUM_PCT_LO = 0.35;
const SWATCH_LUM_PCT_HI = 0.65;
const MASK_DILATE_RADIUS = 2;
const MASK_APPLY_THRESH = 128;
const SOFA_L_PCT_LO = 0.03;
const SOFA_L_PCT_HI = 0.97;
const SWATCH_L_PCT_DARK = 0.08;
const SWATCH_L_PCT_BRIGHT = 0.92;
const CHROMA_TEXTURE = 0.08;
const HIGHLIGHT_L_START = 88;
const HIGHLIGHT_L_END = 97;
const HIGHLIGHT_AB_DAMP = 0.35;
const BLACK_LEATHER_L_BRIGHT = 22;

const SWATCH_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SWATCH_ID_PATTERN = /^[a-z]+-[a-z]+\.(jpe?g|png|webp)$/i;
const SWATCH_BLOCK_PATTERN = /^(debug|test|chip|palette|cache|flat|target|color-)/i;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function medianOf(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function rgbToLab(r, g, b) {
  const lab = convert.rgb.lab([r, g, b]);
  return { L: lab[0], a: lab[1], b: lab[2] };
}

export function labToRgb(L, a, b) {
  const [r, g, bOut] = convert.lab.rgb([L, a, b]);
  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(bOut), 0, 255),
  };
}

export function isOriginalSwatchFile(filename) {
  const base = basename(filename);
  if (SWATCH_BLOCK_PATTERN.test(base)) return false;
  return SWATCH_ID_PATTERN.test(base);
}

export function listOriginalSwatches() {
  if (!existsSync(SWATCH_DIR)) return [];
  return readdirSync(SWATCH_DIR)
    .filter((f) => SWATCH_EXT.has(extname(f).toLowerCase()) && isOriginalSwatchFile(f))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function cleanGeneratedArtifacts(outputDir = OUTPUT_DIR) {
  if (!existsSync(outputDir)) return 0;
  let removed = 0;
  for (const f of readdirSync(outputDir)) {
    const lower = f.toLowerCase();
    if (
      lower.startsWith('debug-') ||
      lower.startsWith('test-') ||
      lower.includes('-chip') ||
      lower.includes('palette') ||
      (lower.endsWith('.json') && lower.includes('target'))
    ) {
      try {
        unlinkSync(join(outputDir, f));
        removed++;
      } catch {
        /* locked */
      }
    }
  }
  return removed;
}

export function resolveOriginalSwatchPath(filename) {
  const base = basename(filename);
  if (!isOriginalSwatchFile(base)) return null;
  const resolved = resolve(join(SWATCH_DIR, base));
  if (!resolved.startsWith(resolve(SWATCH_DIR))) return null;
  if (!existsSync(resolved)) return null;
  return resolved;
}

function pixelBrightness(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isNearWhite(r, g, b) {
  return r > BG_THRESH && g > BG_THRESH && b > BG_THRESH;
}

function pixelSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 510;
  const d = (max - min) / 255;
  return l > 0.5 ? d / (2 - l * 2) : d / (l * 2);
}

function rgbMaxDiff(r, g, b) {
  return Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
}

function isFloorShadowPixel(r, g, b, y, sofaBottomY) {
  if (y <= sofaBottomY) return false;
  if (pixelBrightness(r, g, b) > 200) return false;
  if (pixelSaturation(r, g, b) >= 0.08) return false;
  return rgbMaxDiff(r, g, b) < 30;
}

/** Gap / floor strip between legs — avoid cyan recolor artifacts. */
function isUnderSofaGapPixel(r, g, b, y, sofaBottomY) {
  if (y < sofaBottomY - 18 || y > sofaBottomY + 4) return false;
  if (pixelSaturation(r, g, b) >= 0.12) return false;
  return pixelBrightness(r, g, b) < 120;
}

function isLegPixel(r, g, b, y, sofaBottomY) {
  if (y < sofaBottomY - 2) return false;
  if (pixelBrightness(r, g, b) > 48) return false;
  return pixelSaturation(r, g, b) < 0.12;
}

function isEdgeGlowPixel(r, g, b) {
  const lum = pixelBrightness(r, g, b);
  if (lum > 248) return true;
  return pixelSaturation(r, g, b) < 0.04 && lum > 200;
}

function isUpholsteryPixel(r, g, b, y, sofaBottomY) {
  if (isNearWhite(r, g, b)) return false;
  if (isEdgeGlowPixel(r, g, b)) return false;
  if (isLegPixel(r, g, b, y, sofaBottomY)) return false;
  if (isFloorShadowPixel(r, g, b, y, sofaBottomY)) return false;
  if (isUnderSofaGapPixel(r, g, b, y, sofaBottomY)) return false;

  const lum = pixelBrightness(r, g, b);
  const sat = pixelSaturation(r, g, b);
  if (sat >= 0.05) return true;
  if (lum >= 6 && lum <= 200) return true;
  return false;
}

function morphologyDilate(src, width, height, radius) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
          const v = src[yy * width + xx];
          if (v > max) max = v;
        }
      }
      out[y * width + x] = max;
    }
  }
  return out;
}

/** Map sofa pixel L onto swatch leather brightness range. */
export function mapSofaLToSwatchL(sofaL, sofaRange, profile) {
  const span = Math.max(0.5, sofaRange.L_max - sofaRange.L_min);
  const t = clamp((sofaL - sofaRange.L_min) / span, 0, 1);
  let L = profile.L_dark + t * (profile.L_bright - profile.L_dark);

  if (profile.isDarkLeather && t < 0.18) {
    const floor = 1.5 + (t / 0.18) * profile.L_dark * 0.35;
    L = Math.min(L, floor);
  }

  return clamp(L, 0, 100);
}

/**
 * Luminance map + swatch chroma. Never blends original brown a/b into shadows.
 */
export function applySwatchMapPixel(baseLab, profile, sofaStats) {
  const finalL = mapSofaLToSwatchL(baseLab.L, sofaStats, profile);

  const finalA = profile.lab.a + (baseLab.a - sofaStats.avgA) * CHROMA_TEXTURE;
  const finalB = profile.lab.b + (baseLab.b - sofaStats.avgB) * CHROMA_TEXTURE;

  const hi = smoothstep(HIGHLIGHT_L_START, HIGHLIGHT_L_END, finalL);
  const a = hi > 0 ? finalA * (1 - hi * HIGHLIGHT_AB_DAMP) : finalA;
  const b = hi > 0 ? finalB * (1 - hi * HIGHLIGHT_AB_DAMP) : finalB;

  return labToRgb(finalL, a, b);
}

export async function loadImage(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

export async function saveImage(data, path, width, height, channels = 4) {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = join(
    tmpdir(),
    `sofa-recolor-${Date.now()}-${basename(path).replace(/[^\w.-]/g, '_')}`,
  );
  await sharp(data, { raw: { width, height, channels } }).png().toFile(tmpPath);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* locked */
  }
  try {
    renameSync(tmpPath, path);
  } catch {
    await sharp(tmpPath).toFile(path);
    try {
      unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
  if (!existsSync(path)) throw new Error(`PNG not created: ${path}`);
  const { size } = statSync(path);
  if (size < 10_000) throw new Error(`PNG too small (${size} bytes): ${path}`);
  return size;
}

/** Sofa L range + average chroma (texture reference only). */
export function computeSofaLabStats(baseImage, mask, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const yMax = sofaBottomY + FLOOR_BELOW_SOFA_PX;
  const Ls = [];
  let sumA = 0;
  let sumB = 0;
  let n = 0;

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const p = j * channels;
      const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
      Ls.push(lab.L);
      sumA += lab.a;
      sumB += lab.b;
      n++;
    }
  }

  if (!n) return { L_min: 8, L_max: 55, avgA: 12, avgB: 18 };
  Ls.sort((a, b) => a - b);
  return {
    L_min: percentile(Ls, SOFA_L_PCT_LO),
    L_max: percentile(Ls, SOFA_L_PCT_HI),
    avgA: sumA / n,
    avgB: sumB / n,
  };
}

/**
 * Swatch profile from center 40% of uploaded JPG (fresh read, core-tone median).
 */
export async function getSwatchProfile(swatchPath) {
  const resolved = resolveOriginalSwatchPath(swatchPath) || resolve(swatchPath);
  if (!resolved.startsWith(resolve(SWATCH_DIR))) {
    throw new Error(`Swatch must be under input/swatches: ${swatchPath}`);
  }

  const meta = await sharp(resolved).metadata();
  const margin = (1 - SWATCH_CENTER_CROP) / 2;
  const x0 = Math.floor(meta.width * margin);
  const y0 = Math.floor(meta.height * margin);
  const cw = Math.max(1, Math.floor(meta.width * SWATCH_CENTER_CROP));
  const ch = Math.max(1, Math.floor(meta.height * SWATCH_CENTER_CROP));

  const { data, info } = await sharp(resolved)
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .blur(SWATCH_BLUR_PX)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const samples = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a < 20 || isNearWhite(r, g, b)) continue;
      samples.push({ r, g, b, lum: pixelBrightness(r, g, b) });
    }
  }

  if (!samples.length) throw new Error(`No swatch pixels: ${resolved}`);

  const lums = samples.map((s) => s.lum).sort((a, b) => a - b);
  const lumLo = percentile(lums, SWATCH_LUM_PCT_LO);
  const lumHi = percentile(lums, SWATCH_LUM_PCT_HI);
  const core = samples.filter((s) => s.lum >= lumLo && s.lum <= lumHi);
  const use = core.length >= 8 ? core : samples;

  const r = Math.round(medianOf(use.map((s) => s.r)));
  const g = Math.round(medianOf(use.map((s) => s.g)));
  const b = Math.round(medianOf(use.map((s) => s.b)));
  const lab = rgbToLab(r, g, b);

  const labLs = samples
    .map((s) => rgbToLab(s.r, s.g, s.b).L)
    .sort((a, b) => a - b);
  const L_dark = percentile(labLs, SWATCH_L_PCT_DARK);
  const L_bright = percentile(labLs, SWATCH_L_PCT_BRIGHT);

  return {
    r,
    g,
    b,
    lab,
    L_dark,
    L_bright,
    isDarkLeather: L_bright < BLACK_LEATHER_L_BRIGHT,
    sourceFile: basename(resolved),
  };
}

export function getSofaBottomY(baseImage) {
  const { data, width, height, channels } = baseImage;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels;
      if (isNearWhite(data[p], data[p + 1], data[p + 2])) continue;
      if (pixelBrightness(data[p], data[p + 1], data[p + 2]) < 35) continue;
      if (pixelSaturation(data[p], data[p + 1], data[p + 2]) < 0.12) continue;
      return y;
    }
  }
  return height - 1;
}

export async function createUpholsteryMask(image, optionalMaskPath = null) {
  const { data, width, height, channels } = image;
  const sofaBottomY = getSofaBottomY(image);
  const hard = new Uint8Array(width * height);
  let useOptional = false;

  if (optionalMaskPath && existsSync(optionalMaskPath)) {
    const m = await loadImage(optionalMaskPath);
    if (m.width !== width || m.height !== height) {
      throw new Error(`mask.png must be ${width}x${height}`);
    }
    useOptional = true;
    for (let j = 0, i = 0; j < width * height; j++, i += m.channels) {
      const lum = pixelBrightness(m.data[i], m.data[i + 1], m.data[i + 2]);
      hard[j] = lum > 127 ? 255 : 0;
    }
  }

  for (let j = 0, p = 0; j < width * height; j++, p += channels) {
    const y = Math.floor(j / width);
    if (useOptional && hard[j] < 128) {
      hard[j] = 0;
      continue;
    }
    hard[j] = isUpholsteryPixel(data[p], data[p + 1], data[p + 2], y, sofaBottomY) ? 255 : 0;
  }

  return morphologyDilate(hard, width, height, MASK_DILATE_RADIUS);
}

export function recolorSofa(baseImage, mask, profile, sofaStats, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const yMax = sofaBottomY + FLOOR_BELOW_SOFA_PX;

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;

      const p = j * channels;
      const baseLab = rgbToLab(data[p], data[p + 1], data[p + 2]);
      const { r, g, b } = applySwatchMapPixel(baseLab, profile, sofaStats);

      out[p] = r;
      out[p + 1] = g;
      out[p + 2] = b;
      if (channels === 4) out[p + 3] = 255;
    }
  }

  return out;
}

export async function processSwatch(swatchPath, baseSofa, mask, sofaStats, sofaBottomY) {
  const resolved = resolveOriginalSwatchPath(swatchPath);
  if (!resolved) throw new Error(`Not an original swatch: ${swatchPath}`);

  const swatchName = basename(resolved, extname(resolved));
  const profile = await getSwatchProfile(resolved);

  console.log({
    swatchName,
    source: `input/swatches/${profile.sourceFile}`,
    targetRGB: [profile.r, profile.g, profile.b],
    L_range: [
      Math.round(profile.L_dark * 10) / 10,
      Math.round(profile.L_bright * 10) / 10,
    ],
    targetLAB: [
      Math.round(profile.lab.L * 10) / 10,
      Math.round(profile.lab.a * 10) / 10,
      Math.round(profile.lab.b * 10) / 10,
    ],
  });

  const outData = recolorSofa(baseSofa, mask, profile, sofaStats, sofaBottomY);
  const outPath = join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(outData, outPath, baseSofa.width, baseSofa.height, baseSofa.channels);
  console.log(`  wrote ${swatchName}.png (${Math.round(bytes / 1024)} KB)`);
  return { outPath, profile };
}

export function zipOutputs(outputDir, zipPath) {
  const zip = new AdmZip();
  const files = readdirSync(outputDir).filter(
    (f) =>
      f.toLowerCase().endsWith('.png') &&
      f !== 'sofa-renders.zip' &&
      !f.startsWith('DEBUG-') &&
      !f.startsWith('TEST-'),
  );
  if (!files.length) throw new Error(`No PNG files in ${outputDir}`);
  for (const f of files) zip.addLocalFile(join(outputDir, f), '', f);
  mkdirSync(dirname(zipPath), { recursive: true });
  zip.writeZip(zipPath);
  return files.length;
}

function resolveSwatchArg(name) {
  if (!name) return null;
  const direct = resolveOriginalSwatchPath(basename(name));
  if (direct) return direct;
  const stem = basename(name, extname(name));
  const hit = listOriginalSwatches().find(
    (f) => basename(f, extname(f)).toLowerCase() === stem.toLowerCase(),
  );
  return hit ? resolveOriginalSwatchPath(hit) : null;
}

function parseCli(argv) {
  const args = argv.slice(2);
  let all = false;
  let swatchFile = null;
  for (const a of args) {
    if (a === '--all') all = true;
    else if (a === '--currant' || a === '--current') swatchFile = DEFAULT_PREVIEW_SWATCH;
    else if (a.startsWith('--swatch=')) swatchFile = a.slice('--swatch='.length);
    else if (!a.startsWith('-')) swatchFile = a;
  }
  if (all) return { mode: 'all' };
  return { mode: 'one', swatchFile: swatchFile || DEFAULT_PREVIEW_SWATCH };
}

export async function main(argv = process.argv) {
  if (!existsSync(SOFA_PATH) || !existsSync(SWATCH_DIR)) {
    console.error('Missing input/sofa.png or input/swatches/');
    process.exit(1);
  }

  const cli = parseCli(argv);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  cleanGeneratedArtifacts();

  const swatchFiles = listOriginalSwatches();
  if (!swatchFiles.length) {
    console.error(`No leather swatches in ${SWATCH_DIR}`);
    process.exit(1);
  }

  console.log(`  swatch source: ${SWATCH_DIR} (${swatchFiles.length} files)`);
  console.log(`Base sofa: ${SOFA_PATH}`);
  const baseSofa = await loadImage(SOFA_PATH);
  console.log(`  ${baseSofa.width}x${baseSofa.height}`);
  console.log('  method: LAB luminance map (swatch L range + chroma)');

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  const mask = await createUpholsteryMask(baseSofa, maskPath);
  const sofaBottomY = getSofaBottomY(baseSofa);
  const sofaStats = computeSofaLabStats(baseSofa, mask, sofaBottomY);
  console.log(
    `  sofa L ${Math.round(sofaStats.L_min)}–${Math.round(sofaStats.L_max)}`,
  );

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath } = await processSwatch(swPath, baseSofa, mask, sofaStats, sofaBottomY);
    console.log(`\nDone: ${outPath}`);
    return;
  }

  for (const file of swatchFiles) {
    await processSwatch(join(SWATCH_DIR, file), baseSofa, mask, sofaStats, sofaBottomY);
  }

  const onDisk = readdirSync(OUTPUT_DIR).filter(
    (f) => f.endsWith('.png') && isOriginalSwatchFile(f.replace(/\.png$/i, '.jpg')),
  );
  console.log(`\nSofa PNGs: ${onDisk.length} / ${swatchFiles.length}`);

  try {
    zipOutputs(OUTPUT_DIR, ZIP_PATH);
    console.log(`Zip: ${ZIP_PATH}`);
  } catch (err) {
    console.warn(`Zip skipped: ${err.message}`);
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
