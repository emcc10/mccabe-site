/**
 * RGB color-balance recolor — one median target per swatch; scales original channels.
 */
import AdmZip from 'adm-zip';
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
const FLOOR_BELOW_SOFA_PX = 6;
const SWATCH_CENTER_CROP = 0.4;
const SWATCH_BLUR_PX = 12;
const SWATCH_LUM_MIN = 25;
const SWATCH_LUM_MAX = 230;
const MASK_DILATE_RADIUS = 2;
const MASK_APPLY_THRESH = 128;
const RATIO_MIN = 0.45;
const RATIO_MAX = 2.2;
const ORIGINAL_BLEND = 0.35;
const BALANCE_BLEND = 0.65;

const SWATCH_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function medianOf(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
  const bright = pixelBrightness(r, g, b);
  if (bright > 210) return false;
  if (pixelSaturation(r, g, b) >= 0.1) return false;
  return rgbMaxDiff(r, g, b) < 28;
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

/** Channel ratios from one target RGB and sofa average RGB. */
export function computeColorBalanceRatios(targetRgb, baseRgb) {
  const safe = (v) => Math.max(v, 1);
  return {
    r: clamp(targetRgb.r / safe(baseRgb.r), RATIO_MIN, RATIO_MAX),
    g: clamp(targetRgb.g / safe(baseRgb.g), RATIO_MIN, RATIO_MAX),
    b: clamp(targetRgb.b / safe(baseRgb.b), RATIO_MIN, RATIO_MAX),
  };
}

/** original * 0.35 + (original * ratio) * 0.65 */
export function applyColorBalancePixel(oR, oG, oB, ratios) {
  const newR = oR * ratios.r;
  const newG = oG * ratios.g;
  const newB = oB * ratios.b;
  return {
    r: Math.round(clamp(oR * ORIGINAL_BLEND + newR * BALANCE_BLEND, 0, 255)),
    g: Math.round(clamp(oG * ORIGINAL_BLEND + newG * BALANCE_BLEND, 0, 255)),
    b: Math.round(clamp(oB * ORIGINAL_BLEND + newB * BALANCE_BLEND, 0, 255)),
  };
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

/**
 * ONE median RGB from center 40% of blurred swatch crop (textured reference).
 * Excludes edge highlights/shadows; never reads debug files.
 */
export async function getSwatchTargetRgb(swatchPath) {
  const meta = await sharp(swatchPath).metadata();
  const width = meta.width;
  const height = meta.height;
  const margin = (1 - SWATCH_CENTER_CROP) / 2;
  const x0 = Math.floor(width * margin);
  const y0 = Math.floor(height * margin);
  const cw = Math.max(1, Math.floor(width * SWATCH_CENTER_CROP));
  const ch = Math.max(1, Math.floor(height * SWATCH_CENTER_CROP));

  const { data, info } = await sharp(swatchPath)
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .blur(SWATCH_BLUR_PX)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const rs = [];
  const gs = [];
  const bs = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a < 20 || isNearWhite(r, g, b)) continue;
      const lum = pixelBrightness(r, g, b);
      if (lum < SWATCH_LUM_MIN || lum > SWATCH_LUM_MAX) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }

  if (!rs.length) throw new Error(`No swatch pixels: ${swatchPath}`);

  return {
    r: Math.round(medianOf(rs)),
    g: Math.round(medianOf(gs)),
    b: Math.round(medianOf(bs)),
    cropWidth: cw,
    cropHeight: ch,
    cropBuffer: data,
    cropChannels: channels,
    cropW: info.width,
    cropH: info.height,
  };
}

/** Diagnostic only — textured crop preview; not used for ratios. */
export async function saveDebugSwatchCrop(swatchName, target) {
  const path = join(OUTPUT_DIR, `DEBUG-${swatchName}-crop.png`);
  await sharp(target.cropBuffer, {
    raw: { width: target.cropW, height: target.cropH, channels: target.cropChannels },
  }).png().toFile(path);
}

/** Average RGB of masked upholstery on base sofa. */
export function computeSofaAverageRgb(baseImage, mask, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const yMax = sofaBottomY + FLOOR_BELOW_SOFA_PX;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let n = 0;

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const p = j * channels;
      sumR += data[p];
      sumG += data[p + 1];
      sumB += data[p + 2];
      n++;
    }
  }

  if (!n) return { r: 90, g: 60, b: 40 };
  return {
    r: sumR / n,
    g: sumG / n,
    b: sumB / n,
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
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (useOptional && hard[j] < 128) {
      hard[j] = 0;
      continue;
    }
    hard[j] = isUpholsteryPixel(r, g, b, y, sofaBottomY) ? 255 : 0;
  }

  return morphologyDilate(hard, width, height, MASK_DILATE_RADIUS);
}

export function recolorSofa(baseImage, mask, ratios, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const yMax = sofaBottomY + FLOOR_BELOW_SOFA_PX;

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;

      const p = j * channels;
      const oR = data[p];
      const oG = data[p + 1];
      const oB = data[p + 2];
      const { r, g, b } = applyColorBalancePixel(oR, oG, oB, ratios);

      out[p] = r;
      out[p + 1] = g;
      out[p + 2] = b;
      if (channels === 4) out[p + 3] = data[p + 3];
    }
  }

  return out;
}

export async function processSwatch(swatchPath, baseSofa, mask, sofaBottomY, sofaAvgRgb) {
  const swatchName = basename(swatchPath, extname(swatchPath));
  const target = await getSwatchTargetRgb(swatchPath);
  const ratios = computeColorBalanceRatios(target, sofaAvgRgb);

  console.log({
    swatchName,
    targetRGB: [target.r, target.g, target.b],
    sofaAvgRGB: [
      Math.round(sofaAvgRgb.r),
      Math.round(sofaAvgRgb.g),
      Math.round(sofaAvgRgb.b),
    ],
    ratios: [
      Math.round(ratios.r * 1000) / 1000,
      Math.round(ratios.g * 1000) / 1000,
      Math.round(ratios.b * 1000) / 1000,
    ],
  });

  try {
    await saveDebugSwatchCrop(swatchName, target);
  } catch (err) {
    console.warn(`  debug crop skipped: ${err.message}`);
  }

  const outData = recolorSofa(baseSofa, mask, ratios, sofaBottomY);
  const outPath = join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(outData, outPath, baseSofa.width, baseSofa.height, baseSofa.channels);
  console.log(`  wrote ${swatchName}.png (${Math.round(bytes / 1024)} KB)`);
  return { outPath, target, ratios };
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
  const base = basename(name);
  const direct = join(SWATCH_DIR, base);
  if (existsSync(direct)) return direct;
  const hit = readdirSync(SWATCH_DIR).find(
    (f) => f.toLowerCase() === base.toLowerCase() || f.toLowerCase().startsWith(base.toLowerCase()),
  );
  return hit ? join(SWATCH_DIR, hit) : null;
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
  if (!existsSync(SOFA_PATH)) {
    console.error(`Missing: ${SOFA_PATH}`);
    process.exit(1);
  }
  if (!existsSync(SWATCH_DIR)) {
    console.error(`Missing: ${SWATCH_DIR}`);
    process.exit(1);
  }

  const cli = parseCli(argv);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Base sofa: ${SOFA_PATH}`);
  const baseSofa = await loadImage(SOFA_PATH);
  console.log(`  ${baseSofa.width}x${baseSofa.height}`);
  console.log('  method: RGB color balance (one target per swatch)');

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  if (maskPath) console.log(`  mask: ${maskPath}`);
  const mask = await createUpholsteryMask(baseSofa, maskPath);
  const sofaBottomY = getSofaBottomY(baseSofa);
  const sofaAvgRgb = computeSofaAverageRgb(baseSofa, mask, sofaBottomY);
  console.log(
    `  sofa avg RGB: [${Math.round(sofaAvgRgb.r)}, ${Math.round(sofaAvgRgb.g)}, ${Math.round(sofaAvgRgb.b)}]`,
  );
  console.log(`  recolor through y=${sofaBottomY + FLOOR_BELOW_SOFA_PX}`);

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath } = await processSwatch(swPath, baseSofa, mask, sofaBottomY, sofaAvgRgb);
    console.log(`\nDone: ${outPath}`);
    return;
  }

  const swatches = readdirSync(SWATCH_DIR)
    .filter((f) => SWATCH_EXT.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  for (const file of swatches) {
    await processSwatch(join(SWATCH_DIR, file), baseSofa, mask, sofaBottomY, sofaAvgRgb);
  }

  const onDisk = readdirSync(OUTPUT_DIR).filter(
    (f) => f.endsWith('.png') && !f.startsWith('DEBUG-') && !f.startsWith('TEST-'),
  );
  console.log(`\nSofa PNGs: ${onDisk.length} / ${swatches.length}`);

  try {
    const n = zipOutputs(OUTPUT_DIR, ZIP_PATH);
    console.log(`Zip: ${ZIP_PATH} (${n} files)`);
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
