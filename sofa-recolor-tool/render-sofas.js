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
/** Multiplier on (target − pixel) a/b delta — strong dyed-leather look. */
const CHROMA_GAIN_BASE = 2.5;
const CHROMA_TEXTURE = 0.72;
const CHROMA_SCALE_MIN = 0.85;
const CHROMA_SCALE_MAX = 1.35;
const LAB_CHROMA_CLAMP = 72;

/** Hero swatch sampling — population-weighted cluster, not max-saturation. */
const HERO_BORDER_FRAC = 0.2;
const HERO_L_MIN = 42;
const HERO_L_MAX = 88;
const HERO_SAT_MIN = 0.04;
const HERO_LUM_TRIM = 0.08;
const HERO_K_MEANS = 4;
const HERO_L_TARGET = 68;
const HERO_SCORE_POP = 0.65;
const HERO_SCORE_MIDL = 0.25;
const HERO_SCORE_CHROMA_PEN = 0.45;
const HERO_CHROMA_PEN_THRESHOLD = 18;
const NEUTRAL_CHROMA_AVG = 14;
const NEUTRAL_GAIN_MULT = 0.55;
const NEUTRAL_AB_CLAMP = 8;

/** Post-recolor contrast restoration (luminance only — chroma unchanged). */
const DEPTH_BLUR_RADIUS = 2;
const DEPTH_DETAIL_BLEND = 0.88;
const DEPTH_MICROCONTRAST = 0.32;
const DEPTH_SHADOW_LOCK_LUM = 78;
const DEPTH_SHADOW_LOCK_STRENGTH = 0.92;
const DEPTH_SPECULAR_LUM = 192;
const DEPTH_SPECULAR_BLEND = 0.9;
const DEPTH_S_CURVE = 0.11;

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

function medianOf(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Mean + std of L,a,b in LAB. */
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

function collectInteriorSwatchPixels(data, width, height, channels, lMin, lMax, minSat) {
  const xMin = Math.floor(width * HERO_BORDER_FRAC);
  const xMax = Math.ceil(width * (1 - HERO_BORDER_FRAC));
  const yMin = Math.floor(height * HERO_BORDER_FRAC);
  const yMax = Math.ceil(height * (1 - HERO_BORDER_FRAC));
  const out = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < xMin || x >= xMax || y < yMin || y >= yMax) continue;
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;

      const sat = pixelSaturation(r, g, b);
      if (sat < minSat) continue;

      const lab = rgbToLab(r, g, b);
      if (lab.L < lMin || lab.L > lMax) continue;

      out.push({ lab, sat });
    }
  }

  return out;
}

/** Exclude darkest/lightest 8% of luminance in the candidate pool. */
function trimLuminanceExtremes(pool) {
  if (pool.length < HERO_K_MEANS * 4) {
    return pool.map((p) => p.lab);
  }
  const sorted = [...pool].sort((a, b) => a.lab.L - b.lab.L);
  const trim = Math.floor(sorted.length * HERO_LUM_TRIM);
  const end = sorted.length - trim;
  if (end - trim < HERO_K_MEANS) {
    return sorted.map((p) => p.lab);
  }
  return sorted.slice(trim, end).map((p) => p.lab);
}

/** Filter swatch pixels for hero sampling. */
export function filterHeroSwatchPixels(data, width, height, channels) {
  let pool = collectInteriorSwatchPixels(
    data,
    width,
    height,
    channels,
    HERO_L_MIN,
    HERO_L_MAX,
    HERO_SAT_MIN,
  );

  if (pool.length < HERO_K_MEANS) {
    pool = collectInteriorSwatchPixels(data, width, height, channels, HERO_L_MIN, HERO_L_MAX, 0.02);
  }

  if (pool.length < HERO_K_MEANS) {
    return { samples: [], tier: 'none' };
  }

  const samples = trimLuminanceExtremes(pool);
  return { samples, tier: samples.length === pool.length ? 'hero' : 'hero-trimmed' };
}

/** Score cluster: population + mid-L fit − extreme chroma penalty. */
export function scoreHeroCluster(members, totalCount) {
  const n = members.length;
  if (!n) return -Infinity;

  const population = n / totalCount;
  const avgL = members.reduce((s, p) => s + p.L, 0) / n;
  const midLCloseness = 1 - clamp(Math.abs(avgL - HERO_L_TARGET) / 36, 0, 1);

  const avgChroma = members.reduce((s, p) => s + Math.hypot(p.a, p.b), 0) / n;
  const excess = Math.max(0, avgChroma - HERO_CHROMA_PEN_THRESHOLD);
  const extremeChromaPenalty = excess > 0 ? (excess / 10) ** 1.65 : 0;

  return (
    population * HERO_SCORE_POP +
    midLCloseness * HERO_SCORE_MIDL -
    extremeChromaPenalty * HERO_SCORE_CHROMA_PEN
  );
}

function kMeansLabAB(samples, k = HERO_K_MEANS) {
  const n = samples.length;
  const labels = new Uint8Array(n);
  const centroids = [];

  for (let i = 0; i < k; i++) {
    const idx = Math.min(n - 1, Math.floor((n * (i + 1)) / (k + 1)));
    centroids.push({ a: samples[idx].a, b: samples[idx].b });
  }

  for (let iter = 0; iter < 28; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const da = samples[i].a - centroids[c].a;
        const db = samples[i].b - centroids[c].b;
        const d = da * da + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      labels[i] = best;
    }

    const sums = Array.from({ length: k }, () => ({ a: 0, b: 0, n: 0 }));
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      sums[c].a += samples[i].a;
      sums[c].b += samples[i].b;
      sums[c].n++;
    }

    let stable = true;
    for (let c = 0; c < k; c++) {
      if (sums[c].n === 0) continue;
      const na = sums[c].a / sums[c].n;
      const nb = sums[c].b / sums[c].n;
      if (Math.abs(na - centroids[c].a) > 0.05 || Math.abs(nb - centroids[c].b) > 0.05) {
        stable = false;
      }
      centroids[c] = { a: na, b: nb };
    }
    if (stable) break;
  }

  return { centroids, labels };
}

function finishHeroStats(meanA, meanB, meanL, spreadSamples) {
  const spread = spreadSamples.length ? computeLabStats(spreadSamples) : computeLabStats([{ L: meanL, a: meanA, b: meanB }]);
  const repRgb = labToRgb(meanL, meanA, meanB);
  const rgbSat = pixelSaturation(repRgb.r, repRgb.g, repRgb.b);
  const chromaMag = Math.hypot(meanA, meanB);

  let satFactor = 1;
  if (chromaMag < 4) {
    satFactor = 0.92;
  } else if (chromaMag < 12) {
    satFactor = 1.1 + rgbSat * 0.65;
  } else {
    satFactor = 1.28 + clamp(rgbSat * 1.4, 0, 1.35);
  }

  let chromaGain = CHROMA_GAIN_BASE;
  if (chromaMag < 3.5) {
    chromaGain = 2.05;
  } else if (chromaMag > 14) {
    chromaGain = 2.85;
  } else if (chromaMag > 8) {
    chromaGain = 2.65;
  }

  return {
    meanL,
    meanA,
    meanB,
    stdL: spread.stdL,
    stdA: Math.max(spread.stdA, MIN_LAB_STD),
    stdB: Math.max(spread.stdB, MIN_LAB_STD),
    chromaMag,
    satFactor,
    chromaGain,
  };
}

/**
 * Hero color: k=3 cluster on filtered swatch; pick most saturated cluster centroid.
 */
export function computeHeroSwatchStats(heroSamples) {
  if (!heroSamples.length) {
    return finishHeroStats(0, 0, 50, []);
  }

  if (heroSamples.length < HERO_K_MEANS) {
    const s = computeLabStats(heroSamples);
    return finishHeroStats(s.meanA, s.meanB, s.meanL, heroSamples);
  }

  const { centroids, labels } = kMeansLabAB(heroSamples, HERO_K_MEANS);
  let bestCluster = 0;
  let bestSat = -1;

  for (let c = 0; c < HERO_K_MEANS; c++) {
    const members = heroSamples.filter((_, i) => labels[i] === c);
    if (!members.length) continue;
    const avgSat =
      members.reduce((sum, p) => sum + Math.hypot(p.a, p.b), 0) / members.length;
    if (avgSat > bestSat) {
      bestSat = avgSat;
      bestCluster = c;
    }
  }

  const heroMembers = heroSamples.filter((_, i) => labels[i] === bestCluster);
  const pool = heroMembers.length ? heroMembers : heroSamples;
  const meanA = pool.reduce((s, p) => s + p.a, 0) / pool.length;
  const meanB = pool.reduce((s, p) => s + p.b, 0) / pool.length;
  const meanL = medianOf(pool.map((p) => p.L));

  return finishHeroStats(meanA, meanB, meanL, heroSamples);
}

/** @deprecated alias */
export function computeRepresentativeSwatchStats(samples) {
  return computeHeroSwatchStats(samples);
}

function percentileSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = clamp(Math.floor(sorted.length * p), 0, sorted.length - 1);
  return sorted[idx];
}

/** Black/white anchors from original upholstery luminance (preserves black point). */
export function computeLuminanceAnchors(origLum, mask, width, height) {
  const samples = [];
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    samples.push(origLum[j]);
  }
  if (!samples.length) return { black: 0, white: 255 };
  samples.sort((a, b) => a - b);
  return {
    black: percentileSorted(samples, 0.03),
    white: percentileSorted(samples, 0.97),
  };
}

export function boxBlurLuminance(src, width, height, radius = DEPTH_BLUR_RADIUS) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
          sum += src[yy * width + xx];
          count++;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

/** Subtle S-curve on luminance — anchored at original black point, does not lift shadows. */
export function applySubtleSCurve(lum, black, white, strength = DEPTH_S_CURVE) {
  const range = Math.max(white - black, 8);
  const t = clamp((lum - black) / range, 0, 1);
  const bump = strength * (t - 0.5) * (1 - Math.abs(t - 0.5) * 1.6);
  const curved = clamp(t + bump, 0, 1);
  return black + curved * range;
}

function midtoneDetailWeight(origLum) {
  const t = 1 - Math.abs(origLum - 118) / 118;
  return clamp(t, 0, 1);
}

/**
 * Contrast-only leather depth: original micro-detail, shadows, speculars.
 */
export function restoreLeatherDepth(oR, oG, oB, r, g, b, origLum, blurLum, anchors) {
  const detail = origLum - blurLum;
  let nL = pixelBrightness(r, g, b);

  nL = applySubtleSCurve(nL, anchors.black, anchors.white);

  if (origLum < DEPTH_SHADOW_LOCK_LUM) {
    const t = clamp((DEPTH_SHADOW_LOCK_LUM - origLum) / DEPTH_SHADOW_LOCK_LUM, 0, 1);
    nL = nL + (origLum - nL) * t * DEPTH_SHADOW_LOCK_STRENGTH;
    nL = Math.min(nL, origLum);
  }

  if (origLum > DEPTH_SPECULAR_LUM) {
    const t = smoothstep(DEPTH_SPECULAR_LUM, 248, origLum) * DEPTH_SPECULAR_BLEND;
    nL = nL + (origLum - nL) * t;
  }

  const midW = midtoneDetailWeight(origLum);
  let finalL = nL + detail * (DEPTH_DETAIL_BLEND + midW * DEPTH_MICROCONTRAST);

  if (origLum < DEPTH_SHADOW_LOCK_LUM) {
    finalL = Math.min(finalL, origLum);
  }

  finalL = clamp(finalL, 0, 255);
  const curL = pixelBrightness(r, g, b);
  if (curL < 1) {
    return { r: oR, g: oG, b: oB };
  }
  const scale = finalL / curL;
  return {
    r: clamp(Math.round(r * scale), 0, 255),
    g: clamp(Math.round(g * scale), 0, 255),
    b: clamp(Math.round(b * scale), 0, 255),
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

/** Map 2–3× gain to a strong blend toward target (no overshoot past swatch chroma). */
export function chromaBlendFactor(dst, edgeT = 0) {
  const gain = (dst.chromaGain ?? CHROMA_GAIN_BASE) * (dst.satFactor ?? 1);
  let t = 1 - Math.exp(-gain * 0.82);
  if ((dst.chromaMag ?? 0) < 4) {
    t = Math.min(0.98, t + 0.17);
  } else if ((dst.chromaMag ?? 0) > 12) {
    t = Math.min(0.98, t + 0.06);
  }
  if (edgeT > 0) {
    t = Math.min(0.99, t + edgeT * 0.1);
  }
  return t;
}

/**
 * Automotive-style colorize: L fixed; single hero swatch a/b target (2–3× gain).
 */
export function transferLabPixel(pixel, src, dst, opts = {}) {
  const finalL = pixel.L;
  const edgeT = clamp(opts.edgeStrength ?? 0, 0, 1);
  const t = chromaBlendFactor(dst, edgeT);

  const scaleA = clamp(dst.stdA / src.stdA, CHROMA_SCALE_MIN, CHROMA_SCALE_MAX);
  const scaleB = clamp(dst.stdB / src.stdB, CHROMA_SCALE_MIN, CHROMA_SCALE_MAX);

  const relA = pixel.a - src.meanA;
  const relB = pixel.b - src.meanB;
  const targetA = dst.meanA + relA * scaleA * CHROMA_TEXTURE;
  const targetB = dst.meanB + relB * scaleB * CHROMA_TEXTURE;

  let a = pixel.a + (targetA - pixel.a) * t;
  let b = pixel.b + (targetB - pixel.b) * t;

  if (opts.cognacEdge || opts.fringeEdge) {
    const snap = clamp(edgeT * 0.75, 0, 0.98);
    a = a + (dst.meanA - a) * snap;
    b = b + (dst.meanB - b) * snap;
  }

  a = clamp(a, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
  b = clamp(b, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);

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
  const { samples: heroes, tier } = filterHeroSwatchPixels(
    data,
    info.width,
    info.height,
    info.channels,
  );

  if (!heroes.length) {
    throw new Error(`No hero swatch pixels (L ${HERO_L_MIN}–${HERO_L_MAX}, sat ≥ ${HERO_SAT_MIN}): ${resolved}`);
  }

  const stats = computeHeroSwatchStats(heroes);
  stats.heroTier = tier;
  const meanRgb = labToRgb(stats.meanL, stats.meanA, stats.meanB);
  return {
    stats,
    overallRGB: [meanRgb.r, meanRgb.g, meanRgb.b],
    pixelCount: heroes.length,
    heroTier: tier,
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
  const nPix = width * height;

  const origLum = new Float32Array(nPix);
  for (let j = 0; j < nPix; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    origLum[j] = pixelBrightness(data[p], data[p + 1], data[p + 2]);
  }

  const blurLum = boxBlurLuminance(origLum, width, height);
  const anchors = computeLuminanceAnchors(origLum, mask, width, height);

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
      let { r, g, b } = transferLabPixel(baseLab, sofaStats, swatchStats, {
        edgeStrength,
        cognacEdge,
        fringeEdge,
        originalRgb: { r: oR, g: oG, b: oB },
      });

      ({ r, g, b } = restoreLeatherDepth(oR, oG, oB, r, g, b, origLum[j], blurLum[j], anchors));

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
    heroAB: [
      Math.round(swatch.stats.meanA * 10) / 10,
      Math.round(swatch.stats.meanB * 10) / 10,
    ],
    heroTier: swatch.heroTier ?? swatch.stats.heroTier,
    chromaGain: Math.round((swatch.stats.chromaGain ?? CHROMA_GAIN_BASE) * 100) / 100,
    satFactor: Math.round((swatch.stats.satFactor ?? 1) * 100) / 100,
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
  console.log('  method: hero swatch chroma (k=3) + depth restore; L preserved');

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
