/**
 * Luminance remapping — sofa L-structure + swatch gradient curve (color-convert LAB).
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
const FLOOR_MARGIN_PX = 28;
const SWATCH_CENTER_CROP = 0.35;
const SWATCH_BLUR_PX = 12;
const MASK_DILATE_RADIUS = 1;
const MASK_FEATHER_RADIUS = 0;
const MASK_APPLY_THRESH = 220;

const LAB_LUT_BINS = 101;
const SWATCH_L_PCT_LO = 0.05;
const SWATCH_L_PCT_HI = 0.95;
const SOFA_L_PCT_LO = 0.02;
const SOFA_L_PCT_HI = 0.98;
const BLACK_SWATCH_L_THRESHOLD = 18;
const BLACK_SHADOW_T_MAX = 0.22;
const HIGHLIGHT_L_START = 76;
const HIGHLIGHT_L_END = 94;
const HIGHLIGHT_CHROMA_REDUCE = 0.72;

const SWATCH_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

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

function pixelBrightness(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isNearWhite(r, g, b) {
  return r > BG_THRESH && g > BG_THRESH && b > BG_THRESH;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function pixelSaturation(r, g, b) {
  return rgbToHsl(r, g, b).s;
}

function rgbMaxDiff(r, g, b) {
  return Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
}

function isLegPixel(r, g, b, y, sofaBottomY) {
  if (y < sofaBottomY - 6) return false;
  if (pixelBrightness(r, g, b) > 52) return false;
  return pixelSaturation(r, g, b) < 0.14;
}

function isFloorAmbientPixel(r, g, b) {
  const bright = pixelBrightness(r, g, b);
  if (bright > 200) return false;
  if (pixelSaturation(r, g, b) >= 0.08) return false;
  return rgbMaxDiff(r, g, b) < 22;
}

function isEdgeGlowPixel(r, g, b) {
  const lum = pixelBrightness(r, g, b);
  if (lum > 228) return true;
  return pixelSaturation(r, g, b) < 0.06 && lum > 175;
}

function isUpholsteryPixel(r, g, b, y, sofaBottomY) {
  if (isNearWhite(r, g, b)) return false;
  if (isEdgeGlowPixel(r, g, b)) return false;
  const lum = pixelBrightness(r, g, b);
  if (lum > 250) return false;
  if (isLegPixel(r, g, b, y, sofaBottomY)) return false;
  if (y > sofaBottomY - 12 && isFloorAmbientPixel(r, g, b)) return false;
  if (pixelSaturation(r, g, b) >= 0.06) return true;
  return lum >= 8 && lum <= 120;
}

function boxBlurChannel(src, width, height, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        sum += src[y * width + xx];
        n++;
      }
      tmp[y * width + x] = sum / n;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        sum += tmp[yy * width + x];
        n++;
      }
      out[y * width + x] = sum / n;
    }
  }
  return out;
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

function featherMask(mask, width, height, radius) {
  const blurred = boxBlurChannel(Float32Array.from(mask, (v) => v), width, height, radius);
  const result = new Uint8Array(mask.length);
  for (let j = 0; j < mask.length; j++) {
    result[j] = Math.round(clamp(blurred[j], 0, 255));
  }
  return result;
}

/** RGB float 0–1 → LAB (L 0–100, signed a/b). */
export function rgbFloatToLab(rf, gf, bf) {
  const lab = convert.rgb.lab([rf * 255, gf * 255, bf * 255]);
  return { L: lab[0], a: lab[1], b: lab[2] };
}

/** LAB → RGB float 0–1, clipped. */
export function labToRgbFloat(L, a, b) {
  const [r, g, bOut] = convert.lab.rgb([L, a, b]);
  return {
    r: clamp(r / 255, 0, 1),
    g: clamp(g / 255, 0, 1),
    b: clamp(bOut / 255, 0, 1),
  };
}

/** Fill empty LAB LUT bins by linear interpolation. */
function finalizeLabLut(rawBins) {
  const lutA = new Float32Array(LAB_LUT_BINS);
  const lutB = new Float32Array(LAB_LUT_BINS);
  const filled = new Uint8Array(LAB_LUT_BINS);

  for (let i = 0; i < LAB_LUT_BINS; i++) {
    const bin = rawBins[i];
    if (bin.a.length) {
      lutA[i] = medianOf(bin.a);
      lutB[i] = medianOf(bin.b);
      filled[i] = 1;
    }
  }

  let prev = -1;
  for (let i = 0; i < LAB_LUT_BINS; i++) {
    if (!filled[i]) continue;
    if (prev >= 0) {
      for (let j = prev + 1; j < i; j++) {
        const t = (j - prev) / (i - prev);
        lutA[j] = lutA[prev] + (lutA[i] - lutA[prev]) * t;
        lutB[j] = lutB[prev] + (lutB[i] - lutB[prev]) * t;
        filled[j] = 1;
      }
    }
    prev = i;
  }

  if (prev < 0) {
    lutA.fill(0);
    lutB.fill(0);
    return { lutA, lutB };
  }

  for (let i = 0; i < prev; i++) {
    lutA[i] = lutA[prev];
    lutB[i] = lutB[prev];
  }
  for (let i = prev + 1; i < LAB_LUT_BINS; i++) {
    lutA[i] = lutA[prev];
    lutB[i] = lutB[prev];
  }

  return { lutA, lutB };
}

export function sampleSwatchLabAtL(curve, L) {
  const li = clamp(L, 0, 100);
  const lo = Math.floor(li);
  const hi = Math.min(lo + 1, 100);
  const t = li - lo;
  return {
    a: curve.lutA[lo] + (curve.lutA[hi] - curve.lutA[lo]) * t,
    b: curve.lutB[lo] + (curve.lutB[hi] - curve.lutB[lo]) * t,
  };
}

/** Map normalized sofa luminance t → swatch L on brightness curve. */
export function mapLuminanceToSwatch(t, curve) {
  const tn = clamp(t, 0, 1);
  let targetL = curve.L_dark + tn * (curve.L_bright - curve.L_dark);

  if (curve.isBlackLeather) {
    if (tn < BLACK_SHADOW_T_MAX) {
      const shadowT = tn / BLACK_SHADOW_T_MAX;
      const floorL = 1.5 + shadowT * curve.L_dark * 0.12;
      targetL = Math.min(targetL, floorL);
    }
    if (tn < 0.06) targetL = Math.min(targetL, 3);
  }

  return clamp(targetL, 0, 100);
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

/** Swatch gradient curve: per-L median a/b + brightness range + hue/sat stats. */
export async function buildSwatchLuminanceCurve(swatchPath) {
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
  const rawBins = Array.from({ length: LAB_LUT_BINS }, () => ({ a: [], b: [] }));
  const Ls = [];
  const hues = [];
  const sats = [];
  const rs = [];
  const gs = [];
  const bs = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;

      rs.push(r);
      gs.push(g);
      bs.push(b);
      const hsl = rgbToHsl(r, g, b);
      hues.push(hsl.h);
      sats.push(hsl.s);

      const lab = rgbFloatToLab(r / 255, g / 255, b / 255);
      Ls.push(lab.L);
      const bin = clamp(Math.round(lab.L), 0, 100);
      rawBins[bin].a.push(lab.a);
      rawBins[bin].b.push(lab.b);
    }
  }

  if (!Ls.length) throw new Error(`No swatch pixels: ${swatchPath}`);

  Ls.sort((a, b) => a - b);
  const { lutA, lutB } = finalizeLabLut(rawBins);
  const L_dark = percentile(Ls, SWATCH_L_PCT_LO);
  const L_core = percentile(Ls, 0.5);
  const L_bright = percentile(Ls, SWATCH_L_PCT_HI);
  const medianL = percentile(Ls, 0.5);

  return {
    lutA,
    lutB,
    L_dark,
    L_core,
    L_bright,
    medianL,
    medianHue: medianOf(hues),
    medianSat: medianOf(sats),
    isBlackLeather:
      L_bright < BLACK_SWATCH_L_THRESHOLD + 2 && medianOf(sats) < 0.12,
    medianRGB: [Math.round(medianOf(rs)), Math.round(medianOf(gs)), Math.round(medianOf(bs))],
  };
}

export function computeSofaLRange(baseImage, mask, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const yFloor = sofaBottomY - FLOOR_MARGIN_PX;
  const Ls = [];

  for (let y = 0; y < height; y++) {
    if (y > yFloor) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const p = j * channels;
      const lab = rgbFloatToLab(data[p] / 255, data[p + 1] / 255, data[p + 2] / 255);
      Ls.push(lab.L);
    }
  }

  if (!Ls.length) return { min: 5, max: 85 };
  Ls.sort((a, b) => a - b);
  return {
    min: percentile(Ls, SOFA_L_PCT_LO),
    max: percentile(Ls, SOFA_L_PCT_HI),
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

  let m = morphologyDilate(hard, width, height, MASK_DILATE_RADIUS);
  if (MASK_FEATHER_RADIUS > 0) {
    m = featherMask(m, width, height, MASK_FEATHER_RADIUS);
  }
  return m;
}

/**
 * Luminance gradient-map: sofa L-structure → swatch brightness curve → LAB color.
 */
export function recolorSofa(baseImage, mask, curve, sofaLRange, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const yFloor = sofaBottomY - FLOOR_MARGIN_PX;
  const span = Math.max(1, sofaLRange.max - sofaLRange.min);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      if (y > yFloor) continue;

      const p = j * channels;
      const rf = data[p] / 255;
      const gf = data[p + 1] / 255;
      const bf = data[p + 2] / 255;

      const baseLab = rgbFloatToLab(rf, gf, bf);
      const sofaL = baseLab.L;

      const t = (sofaL - sofaLRange.min) / span;
      const targetL = mapLuminanceToSwatch(t, curve);
      const { a: swA, b: swB } = sampleSwatchLabAtL(curve, targetL);

      const hiMix = smoothstep(HIGHLIGHT_L_START, HIGHLIGHT_L_END, sofaL);
      const chromaKeep = 1 - hiMix * HIGHLIGHT_CHROMA_REDUCE;
      const finalA = swA * chromaKeep;
      const finalB = swB * chromaKeep;

      const rec = labToRgbFloat(targetL, finalA, finalB);
      const mw = mask[j] / 255;

      const nR = rf + (rec.r - rf) * mw;
      const nG = gf + (rec.g - gf) * mw;
      const nB = bf + (rec.b - bf) * mw;

      out[p] = Math.round(clamp(nR, 0, 1) * 255);
      out[p + 1] = Math.round(clamp(nG, 0, 1) * 255);
      out[p + 2] = Math.round(clamp(nB, 0, 1) * 255);
      if (channels === 4) out[p + 3] = data[p + 3];
    }
  }

  return out;
}

export async function processSwatch(swatchPath, baseSofa, mask, sofaLRange, sofaBottomY) {
  const swatchName = basename(swatchPath, extname(swatchPath));
  const curve = await buildSwatchLuminanceCurve(swatchPath);
  console.log({
    swatchName,
    medianRGB: curve.medianRGB,
    medianHue: Math.round(curve.medianHue * 360),
    medianSat: Math.round(curve.medianSat * 100) / 100,
    L_dark: Math.round(curve.L_dark * 10) / 10,
    L_core: Math.round(curve.L_core * 10) / 10,
    L_bright: Math.round(curve.L_bright * 10) / 10,
    blackLeather: curve.isBlackLeather,
  });

  const outData = recolorSofa(baseSofa, mask, curve, sofaLRange, sofaBottomY);
  const outPath = join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(outData, outPath, baseSofa.width, baseSofa.height, baseSofa.channels);
  console.log(`  wrote ${swatchName}.png (${Math.round(bytes / 1024)} KB)`);
  return { outPath, curve };
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
  console.log('  method: luminance gradient-map (LAB)');

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  if (maskPath) console.log(`  mask: ${maskPath}`);
  const mask = await createUpholsteryMask(baseSofa, maskPath);
  const sofaBottomY = getSofaBottomY(baseSofa);
  const sofaLRange = computeSofaLRange(baseSofa, mask, sofaBottomY);
  console.log(
    `  floor cut y=${sofaBottomY - FLOOR_MARGIN_PX} (bottom y=${sofaBottomY})`,
  );
  console.log(
    `  sofa L range: ${Math.round(sofaLRange.min * 10) / 10} – ${Math.round(sofaLRange.max * 10) / 10}`,
  );

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath } = await processSwatch(swPath, baseSofa, mask, sofaLRange, sofaBottomY);
    console.log(`\nDone: ${outPath}`);
    return;
  }

  const swatches = readdirSync(SWATCH_DIR)
    .filter((f) => SWATCH_EXT.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  for (const file of swatches) {
    await processSwatch(join(SWATCH_DIR, file), baseSofa, mask, sofaLRange, sofaBottomY);
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
