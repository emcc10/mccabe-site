/**
 * LAB chroma-only recolor — preserve sofa L (lighting); transfer swatch a/b only.
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

const BG_THRESH = 238;
const EDGE_LUM_MAX = 210;
const EDGE_RECOLOR_DISTANCE = 4;
/** Do not recolor pixels in this band above the scanned sofa bottom (cast shadow on floor). */
const CAST_SHADOW_BAND_PX = 34;
const BODY_RECOLOR_MARGIN_ABOVE_BOTTOM_PX = 8;
const MASK_DILATE_RADIUS = 0;
const MASK_ERODE_RADIUS = 1;
const MASK_APPLY_THRESH = 128;
const MIN_LAB_STD = 0.8;
const CHROMA_STRENGTH = 0.88;
const CHROMA_TEXTURE = 0.42;
const CHROMA_SCALE_MIN = 0.72;
const CHROMA_SCALE_MAX = 1.22;

const SWATCH_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SWATCH_ID_PATTERN = /^[a-z]+-[a-z]+\.(jpe?g|png|webp)$/i;
const SWATCH_BLOCK_PATTERN = /^(debug|test|chip|palette|cache|flat|target|color-)/i;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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

/** Gray drop shadow under sofa — must stay original, not leather color. */
function isCastShadowPixel(r, g, b, y, sofaBottomY) {
  if (y < sofaBottomY - CAST_SHADOW_BAND_PX) return false;
  if (y > sofaBottomY + 6) return isFloorShadowPixel(r, g, b, y, sofaBottomY);

  const lum = pixelBrightness(r, g, b);
  const sat = pixelSaturation(r, g, b);
  if (lum < 18 || lum > 210) return false;
  if (sat >= 0.2) return false;
  if (sat < 0.11 && rgbMaxDiff(r, g, b) < 32) return true;
  return sat < 0.14 && lum < 175 && rgbMaxDiff(r, g, b) < 24;
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

/** Anti-aliased white fringe at silhouette. */
function isEdgeFringePixel(r, g, b) {
  const lum = pixelBrightness(r, g, b);
  if (lum > 232) return true;
  if (lum > EDGE_LUM_MAX && pixelSaturation(r, g, b) < 0.2) return true;
  return false;
}

/** Warm cognac bleed on cushion/arm edges in the base photo. */
function isCognacFringePixel(r, g, b) {
  const sat = pixelSaturation(r, g, b);
  if (sat < 0.04) return false;
  return r > g + 3 && r > b + 2 && g >= b - 8;
}

function isEdgeGlowPixel(r, g, b) {
  return isEdgeFringePixel(r, g, b);
}

function isUpholsteryPixel(r, g, b, y, sofaBottomY) {
  if (isNearWhite(r, g, b)) return false;
  if (isEdgeFringePixel(r, g, b)) return false;
  if (isCastShadowPixel(r, g, b, y, sofaBottomY)) return false;
  if (isLegPixel(r, g, b, y, sofaBottomY)) return false;
  if (isFloorShadowPixel(r, g, b, y, sofaBottomY)) return false;
  if (isUnderSofaGapPixel(r, g, b, y, sofaBottomY)) return false;

  const lum = pixelBrightness(r, g, b);
  const sat = pixelSaturation(r, g, b);
  if (sat >= 0.05) return true;
  if (lum >= 6 && lum <= EDGE_LUM_MAX) return true;
  return false;
}

function morphologyErode(src, width, height, radius) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let min = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
          const v = src[yy * width + xx];
          if (v < min) min = v;
        }
      }
      out[y * width + x] = min;
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

/** Mean + std of L,a,b in LAB (Reinhard transfer). */
export function computeLabStats(labSamples) {
  const n = labSamples.length;
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  for (const s of labSamples) {
    sumL += s.L;
    sumA += s.a;
    sumB += s.b;
  }
  const meanL = sumL / n;
  const meanA = sumA / n;
  const meanB = sumB / n;
  let vL = 0;
  let vA = 0;
  let vB = 0;
  for (const s of labSamples) {
    vL += (s.L - meanL) ** 2;
    vA += (s.a - meanA) ** 2;
    vB += (s.b - meanB) ** 2;
  }
  return {
    meanL,
    meanA,
    meanB,
    stdL: Math.max(Math.sqrt(vL / n), MIN_LAB_STD),
    stdA: Math.max(Math.sqrt(vA / n), MIN_LAB_STD),
    stdB: Math.max(Math.sqrt(vB / n), MIN_LAB_STD),
  };
}

/**
 * Swatch stats from mid-tone leather (not center shadow / glare).
 * Chroma from brighter band so cool grays keep their tint.
 */
export function computeRepresentativeSwatchStats(samples) {
  if (samples.length < 64) return computeLabStats(samples);

  const sorted = [...samples].sort((a, b) => a.L - b.L);
  const n = sorted.length;
  const lLo = sorted[Math.floor(n * 0.4)].L;
  const lHi = sorted[Math.floor(n * 0.92)].L;
  const body =
    lHi > lLo ? sorted.filter((s) => s.L >= lLo && s.L <= lHi) : sorted;

  const bodyStats = computeLabStats(body.length >= n * 0.15 ? body : sorted);

  const lBright = sorted[Math.floor(n * 0.78)].L;
  const bright = sorted.filter((s) => s.L >= lBright);
  const chromaStats =
    bright.length >= n * 0.06 ? computeLabStats(bright) : bodyStats;

  let meanL = bodyStats.meanL;
  let meanA = chromaStats.meanA;
  let meanB = chromaStats.meanB;

  const repRgb = labToRgb(meanL, meanA, meanB);
  const chromaMag = Math.hypot(meanA, meanB);
  const isCoolGray =
    chromaMag < 10 &&
    repRgb.b <= repRgb.r - 1 &&
    repRgb.b <= repRgb.g - 1 &&
    meanL < 55;

  if (isCoolGray) {
    meanB -= clamp((repRgb.g - repRgb.b) * 0.06 + (repRgb.r - repRgb.b) * 0.03, 0.5, 3.5);
    meanA -= clamp((repRgb.r - repRgb.g) * 0.02, 0, 1.2);
  }

  return {
    meanL,
    meanA,
    meanB,
    stdL: bodyStats.stdL,
    stdA: Math.max(bodyStats.stdA, chromaStats.stdA, MIN_LAB_STD),
    stdB: Math.max(bodyStats.stdB, chromaStats.stdB, MIN_LAB_STD),
  };
}

/**
 * Keep original photo luminance in RGB after a/b shift (no overlay/blend modes).
 */
export function restoreOriginalLuminance(oR, oG, oB, r, g, b) {
  const origLum = pixelBrightness(oR, oG, oB);
  const newLum = pixelBrightness(r, g, b);
  if (newLum < 1) {
    return { r: oR, g: oG, b: oB };
  }
  const scale = origLum / newLum;
  return {
    r: clamp(Math.round(r * scale), 0, 255),
    g: clamp(Math.round(g * scale), 0, 255),
    b: clamp(Math.round(b * scale), 0, 255),
  };
}

/**
 * Automotive-style colorize: original L unchanged; soft swatch a/b transfer only.
 */
export function transferLabPixel(pixel, src, dst, opts = {}) {
  const finalL = pixel.L;

  const scaleA = clamp(dst.stdA / src.stdA, CHROMA_SCALE_MIN, CHROMA_SCALE_MAX);
  const scaleB = clamp(dst.stdB / src.stdB, CHROMA_SCALE_MIN, CHROMA_SCALE_MAX);

  const targetA = dst.meanA + (pixel.a - src.meanA) * scaleA * CHROMA_TEXTURE;
  const targetB = dst.meanB + (pixel.b - src.meanB) * scaleB * CHROMA_TEXTURE;

  let strength = CHROMA_STRENGTH;
  const edgeT = clamp(opts.edgeStrength ?? 0, 0, 1);
  if (edgeT > 0) {
    strength = Math.min(1, strength + edgeT * 0.1);
  }

  let a = pixel.a + (targetA - pixel.a) * strength;
  let b = pixel.b + (targetB - pixel.b) * strength;

  if (opts.cognacEdge || opts.fringeEdge) {
    const snap = clamp(edgeT * 0.55, 0, 0.9);
    a = a + (dst.meanA - a) * snap;
    b = b + (dst.meanB - b) * snap;
  }

  const { r, g, b: bOut } = labToRgb(finalL, a, b);
  const orig = opts.originalRgb;
  if (orig) {
    return restoreOriginalLuminance(orig.r, orig.g, orig.b, r, g, bOut);
  }
  return { r, g, b: bOut };
}

export function distanceToBackground(mask, width, height, x, y, maxDist) {
  if (mask[y * width + x] < MASK_APPLY_THRESH) return 0;
  for (let d = 1; d <= maxDist; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) return d;
        if (mask[yy * width + xx] < MASK_APPLY_THRESH) return d;
      }
    }
  }
  return maxDist + 1;
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

/** LAB stats from every pixel on the full uploaded swatch image. */
export async function getSwatchLabStats(swatchPath) {
  const resolved = resolveOriginalSwatchPath(swatchPath) || resolve(swatchPath);
  if (!resolved.startsWith(resolve(SWATCH_DIR))) {
    throw new Error(`Swatch must be under input/swatches: ${swatchPath}`);
  }

  const { data, info } = await sharp(resolved).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const samples = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;
      samples.push(rgbToLab(r, g, b));
    }
  }

  if (!samples.length) throw new Error(`No swatch pixels: ${resolved}`);

  const stats = computeRepresentativeSwatchStats(samples);
  const meanRgb = labToRgb(stats.meanL, stats.meanA, stats.meanB);
  return {
    stats,
    overallRGB: [meanRgb.r, meanRgb.g, meanRgb.b],
    pixelCount: samples.length,
    sourceFile: basename(resolved),
  };
}

export function computeSofaLabStats(baseImage, mask, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const yMax = sofaBottomY - BODY_RECOLOR_MARGIN_ABOVE_BOTTOM_PX;
  const samples = [];

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const p = j * channels;
      samples.push(rgbToLab(data[p], data[p + 1], data[p + 2]));
    }
  }

  if (!samples.length) {
    return computeLabStats([{ L: 40, a: 15, b: 20 }]);
  }
  return computeLabStats(samples);
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

  let m = morphologyDilate(hard, width, height, MASK_DILATE_RADIUS);
  if (MASK_ERODE_RADIUS > 0) {
    m = morphologyErode(m, width, height, MASK_ERODE_RADIUS);
  }
  return m;
}

export function recolorSofa(baseImage, mask, sofaStats, swatchStats, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const yMax = sofaBottomY - BODY_RECOLOR_MARGIN_ABOVE_BOTTOM_PX;

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;

      const p = j * channels;
      const oR = data[p];
      const oG = data[p + 1];
      const oB = data[p + 2];
      if (isCastShadowPixel(oR, oG, oB, y, sofaBottomY)) continue;

      const edgeDist = distanceToBackground(mask, width, height, x, y, EDGE_RECOLOR_DISTANCE);
      const edgeStrength = edgeDist <= EDGE_RECOLOR_DISTANCE ? (EDGE_RECOLOR_DISTANCE - edgeDist + 1) / (EDGE_RECOLOR_DISTANCE + 1) : 0;
      const fringeEdge = edgeStrength > 0 && isEdgeFringePixel(oR, oG, oB);
      const cognacEdge = edgeStrength > 0 && (isCognacFringePixel(oR, oG, oB) || fringeEdge);

      const baseLab = rgbToLab(oR, oG, oB);
      const { r, g, b } = transferLabPixel(baseLab, sofaStats, swatchStats, {
        edgeStrength,
        cognacEdge,
        fringeEdge,
        originalRgb: { r: oR, g: oG, b: oB },
      });

      out[p] = r;
      out[p + 1] = g;
      out[p + 2] = b;
      if (channels === 4) out[p + 3] = data[p + 3];
    }
  }

  return out;
}

export async function processSwatch(swatchPath, baseSofa, mask, sofaStats, sofaBottomY) {
  const resolved = resolveOriginalSwatchPath(swatchPath);
  if (!resolved) throw new Error(`Not an original swatch: ${swatchPath}`);

  const swatchName = basename(resolved, extname(resolved));
  const swatch = await getSwatchLabStats(resolved);

  console.log({
    swatchName,
    source: `input/swatches/${swatch.sourceFile}`,
    overallRGB: swatch.overallRGB,
    pixelsSampled: swatch.pixelCount,
    swatchLAB: [
      Math.round(swatch.stats.meanL * 10) / 10,
      Math.round(swatch.stats.meanA * 10) / 10,
      Math.round(swatch.stats.meanB * 10) / 10,
    ],
  });

  const outData = recolorSofa(baseSofa, mask, sofaStats, swatch.stats, sofaBottomY);
  const outPath = join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(outData, outPath, baseSofa.width, baseSofa.height, baseSofa.channels);
  console.log(`  wrote ${swatchName}.png (${Math.round(bytes / 1024)} KB)`);
  return { outPath, swatch };
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
  console.log('  method: LAB chroma-only (L preserved); no swatch luminance transfer');

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  const mask = await createUpholsteryMask(baseSofa, maskPath);
  const sofaBottomY = getSofaBottomY(baseSofa);
  const sofaStats = computeSofaLabStats(baseSofa, mask, sofaBottomY);
  console.log(
    `  sofa LAB L ${Math.round(sofaStats.meanL)} σ${Math.round(sofaStats.stdL)}`,
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
