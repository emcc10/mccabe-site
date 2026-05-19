/**
 * Dual pipeline: dark/medium leathers recolor cognac sofa (preserve L);
 * light leathers use a lifted neutral base + swatch chroma.
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
const CHROMA_GAIN_BASE = 2.5;
const LAB_CHROMA_CLAMP = 72;
/** High-frequency a/b texture from sofa; large-scale cognac chroma removed by blur. */
const TEXTURE_BLUR_RADIUS = 15;
const TEXTURE_RESIDUAL_MAX = 4;

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
const LIGHT_SWATCH_RGB = 145;
const LIGHT_HERO_L = 65;
const LIGHT_SWATCH_RGB_STRONG = 170;
const LIGHT_HERO_L_STRONG = 72;
const LIGHT_L_BLEND = 0.55;
const LIGHT_L_BLEND_STRONG = 0.7;
const LIGHT_SHADOW_LOCK_MULT = 0.4;
const LIGHT_NEUTRAL_A_MIN = -3;
const LIGHT_NEUTRAL_A_MAX = 4;
const LIGHT_NEUTRAL_B_MIN = 0;
const LIGHT_NEUTRAL_B_MAX = 10;
/** Lifted neutral sofa base targets (RGB luminance). */
const LIGHT_BASE_SHADOW_MIN = 118;
const LIGHT_BASE_MID_LO = 185;
const LIGHT_BASE_MID_HI = 210;
const LIGHT_BASE_HIGH_LO = 220;
const LIGHT_BASE_HIGH_HI = 235;
const LIGHT_BASE_SEAM_MIN = 115;
const LIGHT_BASE_STRUCTURE_BLUR = 6;
const LIGHT_BASE_DETAIL = 0.18;
const LIGHT_CHROMA_STRENGTH = 0.88;
const LIGHT_TEXTURE_MAX = 2;

const SWATCH_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SWATCH_ID_PATTERN = /^[a-z]+-[a-z]+\.(jpe?g|png|webp)$/i;
const SWATCH_BLOCK_PATTERN = /^(debug|test|chip|palette|cache|flat|target|color-)/i;
/** Always use light-neutral base (even if hero RGB is borderline). */
const LIGHT_LEATHER_STEMS = new Set([
  'bali-silk',
  'rein-eggshell',
  'evoque-frost',
  'solana-tusk',
  'traverse-vanilla',
  'evoque-mist',
  'rein-parchment',
]);

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

export function isLightLeatherPipeline(stats, swatchStem) {
  const stem = swatchStem.toLowerCase();
  if (LIGHT_LEATHER_STEMS.has(stem)) return true;
  return stats.isLightSwatch === true;
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

/** Mean RGB of all non-background swatch pixels — light-neutral lift detection only. */
export function computeFullSwatchRgbAvg(data, width, height, channels) {
  let sum = 0;
  let n = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = channels === 4 ? data[i + 3] : 255;
      if (alpha < 20 || isNearWhite(r, g, b)) continue;
      sum += r + g + b;
      n++;
    }
  }

  return n ? sum / (3 * n) : 0;
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
    pool = collectInteriorSwatchPixels(data, width, height, channels, HERO_L_MIN, HERO_L_MAX, 0);
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

function finishHeroStats(meanA, meanB, meanL, spreadSamples, avgSwatchChroma, swatchRgbAvg = 0) {
  const spread = spreadSamples.length ? computeLabStats(spreadSamples) : computeLabStats([{ L: meanL, a: meanA, b: meanB }]);
  const repRgb = labToRgb(meanL, meanA, meanB);
  const rgbSat = pixelSaturation(repRgb.r, repRgb.g, repRgb.b);
  const chromaMag = Math.hypot(meanA, meanB);
  const isNeutral = avgSwatchChroma < NEUTRAL_CHROMA_AVG;

  let satFactor = 1;
  if (isNeutral) {
    satFactor = 0.95;
  } else if (chromaMag < 4) {
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

  if (isNeutral) {
    chromaGain *= NEUTRAL_GAIN_MULT;
  }

  const heroRgbAvg = (repRgb.r + repRgb.g + repRgb.b) / 3;
  const swatchAvgRgb = swatchRgbAvg > 0 ? swatchRgbAvg : heroRgbAvg;
  let lightLiftTier = 0;
  if (meanL > LIGHT_HERO_L_STRONG || swatchAvgRgb > LIGHT_SWATCH_RGB_STRONG) {
    lightLiftTier = 2;
  } else if (meanL > LIGHT_HERO_L || swatchAvgRgb > LIGHT_SWATCH_RGB) {
    lightLiftTier = 1;
  }

  return {
    meanL,
    meanA,
    meanB,
    heroRgbAvg,
    swatchAvgRgb,
    swatchRgbAvg,
    stdL: spread.stdL,
    stdA: Math.max(spread.stdA, MIN_LAB_STD),
    stdB: Math.max(spread.stdB, MIN_LAB_STD),
    chromaMag,
    avgSwatchChroma,
    satFactor,
    chromaGain,
    isNeutral,
    neutralAbClamp: isNeutral ? NEUTRAL_AB_CLAMP : 0,
    isLightSwatch: lightLiftTier > 0,
    isNeutralLight: lightLiftTier > 0 && isNeutral,
    lightLiftTier,
    shadowLockStrength:
      lightLiftTier > 0 ? DEPTH_SHADOW_LOCK_STRENGTH * LIGHT_SHADOW_LOCK_MULT : DEPTH_SHADOW_LOCK_STRENGTH,
  };
}

/** Light leathers: render in swatch luminance, not cognac L (dark swatches keep original L). */
export function computeFinalLabL(originalL, dst) {
  const heroL = dst.meanL;
  const swatchAvgRgb = dst.swatchAvgRgb ?? dst.swatchRgbAvg ?? dst.heroRgbAvg ?? 0;

  if (swatchAvgRgb > LIGHT_SWATCH_RGB_STRONG || heroL > LIGHT_HERO_L_STRONG) {
    return originalL * (1 - LIGHT_L_BLEND_STRONG) + heroL * LIGHT_L_BLEND_STRONG;
  }
  if (swatchAvgRgb > LIGHT_SWATCH_RGB || heroL > LIGHT_HERO_L) {
    return originalL * (1 - LIGHT_L_BLEND) + heroL * LIGHT_L_BLEND;
  }
  return originalL;
}

/**
 * Hero color: k=4 clusters; highest population + mid-L score (not max saturation).
 */
export function computeHeroSwatchStats(heroSamples, swatchRgbAvg = 0) {
  if (!heroSamples.length) {
    return finishHeroStats(0, 0, 50, [], 0, swatchRgbAvg);
  }

  const avgSwatchChroma =
    heroSamples.reduce((s, p) => s + Math.hypot(p.a, p.b), 0) / heroSamples.length;

  if (heroSamples.length < HERO_K_MEANS) {
    const s = computeLabStats(heroSamples);
    return finishHeroStats(s.meanA, s.meanB, s.meanL, heroSamples, avgSwatchChroma, swatchRgbAvg);
  }

  const { labels } = kMeansLabAB(heroSamples, HERO_K_MEANS);
  let bestCluster = 0;
  let bestScore = -Infinity;

  for (let c = 0; c < HERO_K_MEANS; c++) {
    const members = heroSamples.filter((_, i) => labels[i] === c);
    const score = scoreHeroCluster(members, heroSamples.length);
    if (score > bestScore) {
      bestScore = score;
      bestCluster = c;
    }
  }

  const heroMembers = heroSamples.filter((_, i) => labels[i] === bestCluster);
  const pool = heroMembers.length ? heroMembers : heroSamples;
  const meanA = pool.reduce((s, p) => s + p.a, 0) / pool.length;
  const meanB = pool.reduce((s, p) => s + p.b, 0) / pool.length;
  const meanL = medianOf(pool.map((p) => p.L));

  const stats = finishHeroStats(meanA, meanB, meanL, heroSamples, avgSwatchChroma, swatchRgbAvg);
  stats.heroClusterScore = bestScore;
  return stats;
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

/** Map cognac upholstery luminance → lifted neutral gray (structure preserved). */
export function mapLightNeutralLuminance(origLum, black, white) {
  const range = Math.max(white - black, 16);
  const t = clamp((origLum - black) / range, 0, 1);
  if (t <= 0.38) {
    const u = smoothstep(0, 0.38, t);
    return LIGHT_BASE_SHADOW_MIN + u * (LIGHT_BASE_MID_LO - LIGHT_BASE_SHADOW_MIN);
  }
  if (t <= 0.78) {
    const u = (t - 0.38) / 0.4;
    return LIGHT_BASE_MID_LO + u * (LIGHT_BASE_MID_HI - LIGHT_BASE_MID_LO);
  }
  const u = (t - 0.78) / 0.22;
  return LIGHT_BASE_HIGH_LO + u * (LIGHT_BASE_HIGH_HI - LIGHT_BASE_HIGH_LO);
}

/**
 * Desaturated, lifted neutral sofa for light-leather pipeline (not cognac L).
 */
export function buildLightNeutralSofaBase(cognacImage, mask, sofaBottomY) {
  const { data, width, height, channels } = cognacImage;
  const out = Buffer.from(data);
  const yMax = sofaBottomY - BODY_RECOLOR_MARGIN_ABOVE_BOTTOM_PX;
  const nPix = width * height;
  const origLum = new Float32Array(nPix);

  for (let j = 0; j < nPix; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const p = j * channels;
    origLum[j] = pixelBrightness(data[p], data[p + 1], data[p + 2]);
  }

  const anchors = computeLuminanceAnchors(origLum, mask, width, height);
  const blurLum = gaussianBlurFloat(origLum, width, height, LIGHT_BASE_STRUCTURE_BLUR);

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const p = j * channels;
      const lum = origLum[j];
      let mapped = mapLightNeutralLuminance(lum, anchors.black, anchors.white);
      mapped += (lum - blurLum[j]) * LIGHT_BASE_DETAIL;

      const seamDepth = blurLum[j] - lum;
      if (seamDepth > 10) {
        const seamTarget = clamp(blurLum[j] - 14, LIGHT_BASE_SEAM_MIN, mapped - 4);
        mapped = mapped * 0.55 + seamTarget * 0.45;
        mapped = clamp(mapped, LIGHT_BASE_SEAM_MIN, blurLum[j] - 5);
      }

      mapped = clamp(mapped, LIGHT_BASE_SEAM_MIN, LIGHT_BASE_HIGH_HI);
      const g = Math.round(mapped);
      out[p] = g;
      out[p + 1] = g;
      out[p + 2] = g;
    }
  }

  return { data: out, width, height, channels };
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

function makeGaussianKernel1D(radius) {
  const sigma = Math.max(radius / 2.5, 1);
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const v = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}

export function gaussianBlurFloat(src, width, height, radius = TEXTURE_BLUR_RADIUS) {
  const kernel = makeGaussianKernel1D(radius);
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = clamp(x + k, 0, width - 1);
        sum += src[y * width + xx] * kernel[k + radius];
      }
      tmp[y * width + x] = sum;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = clamp(y + k, 0, height - 1);
        sum += tmp[yy * width + x] * kernel[k + radius];
      }
      out[y * width + x] = sum;
    }
  }

  return out;
}

/** Original sofa a/b and blurred a/b for high-frequency texture residual only. */
export function buildSofaAbTextureMaps(baseImage, width, height, channels) {
  const n = width * height;
  const { data } = baseImage;
  const origA = new Float32Array(n);
  const origB = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    const p = j * channels;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    origA[j] = lab.a;
    origB[j] = lab.b;
  }

  return {
    origA,
    origB,
    blurA: gaussianBlurFloat(origA, width, height, TEXTURE_BLUR_RADIUS),
    blurB: gaussianBlurFloat(origB, width, height, TEXTURE_BLUR_RADIUS),
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

function scaleRgbToLuminance(r, g, b, targetLum) {
  const curL = pixelBrightness(r, g, b);
  if (curL < 1) {
    return { r, g, b };
  }
  const scale = targetLum / curL;
  return {
    r: clamp(Math.round(r * scale), 0, 255),
    g: clamp(Math.round(g * scale), 0, 255),
    b: clamp(Math.round(b * scale), 0, 255),
  };
}

/**
 * Light leather: grain, specular sheen, crease/seam structure (no global lift).
 */
export function restoreLightLeatherDepth(oR, oG, oB, r, g, b, origLum, detailBlurLum, localMeanLum) {
  let nL = pixelBrightness(r, g, b);
  const detail = origLum - detailBlurLum;
  let finalL = nL + detail * LIGHT_DETAIL_STRENGTH;

  if (origLum > LIGHT_SPECULAR_LUM) {
    const t = smoothstep(LIGHT_SPECULAR_LUM, 248, origLum) * LIGHT_SPECULAR_BLEND;
    finalL = finalL * (1 - t) + origLum * t;
  }

  if (origLum < LIGHT_CREASE_LUM) {
    const t = clamp((LIGHT_CREASE_LUM - origLum) / LIGHT_CREASE_LUM, 0, 1) * LIGHT_CREASE_BLEND;
    finalL = finalL * (1 - t) + origLum * t;
  }

  const seamDepth = localMeanLum - origLum;
  if (seamDepth > LIGHT_SEAM_DEPTH_MIN) {
    const seamW = clamp((seamDepth - LIGHT_SEAM_DEPTH_MIN) / 24, 0, 1);
    const seamCap = localMeanLum - 5;
    finalL = finalL * (1 - seamW * 0.5) + origLum * (seamW * 0.5);
    finalL = Math.min(finalL, seamCap);
  }

  const curL = pixelBrightness(r, g, b);
  if (curL < 1) {
    return { r: oR, g: oG, b: oB };
  }
  return scaleRgbToLuminance(r, g, b, clamp(finalL, 0, 255));
}

function buildClippedTileLut(hist, count, clipLimit) {
  if (count < 16) return null;
  const maxBin = (clipLimit * count) / 256;
  const clipped = new Float32Array(256);
  let excess = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > maxBin) {
      excess += hist[i] - maxBin;
      clipped[i] = maxBin;
    } else {
      clipped[i] = hist[i];
    }
  }
  const redist = excess / 256;
  for (let i = 0; i < 256; i++) {
    clipped[i] += redist;
  }
  const lut = new Uint8Array(256);
  let cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += clipped[i];
    lut[i] = clamp(Math.round((cum / count) * 255), 0, 255);
  }
  return lut;
}

function sampleTileLut(luts, tilesX, tilesY, tileW, tileH, x, y, lumVal) {
  const fx = clamp(x / tileW - 0.5, 0, tilesX - 1);
  const fy = clamp(y / tileH - 0.5, 0, tilesY - 1);
  const tx0 = Math.floor(fx);
  const ty0 = Math.floor(fy);
  const tx1 = Math.min(tx0 + 1, tilesX - 1);
  const ty1 = Math.min(ty0 + 1, tilesY - 1);
  const wx = fx - tx0;
  const wy = fy - ty0;
  const v = clamp(Math.round(lumVal), 0, 255);

  const l00 = luts[ty0 * tilesX + tx0];
  const l10 = luts[ty0 * tilesX + tx1];
  const l01 = luts[ty1 * tilesX + tx0];
  const l11 = luts[ty1 * tilesX + tx1];
  if (!l00 || !l10 || !l01 || !l11) return lumVal;

  const top = l00[v] * (1 - wx) + l10[v] * wx;
  const bot = l01[v] * (1 - wx) + l11[v] * wx;
  return top * (1 - wy) + bot * wy;
}

/** Gentle bilateral-style smooth on masked upholstery; skips edges/seams. */
export function applyLightLeatherSurfaceSmooth(
  outData,
  mask,
  width,
  height,
  channels,
  yMax,
  origLum,
  localMeanLum,
) {
  const n = width * height;
  const smoothR = new Float32Array(n);
  const smoothG = new Float32Array(n);
  const smoothB = new Float32Array(n);
  const sigmaS = LIGHT_SURFACE_SIGMA_SPATIAL;
  const sigmaR = LIGHT_SURFACE_SIGMA_RANGE;
  const sigmaS2 = 2 * sigmaS * sigmaS;
  const sigmaR2 = 2 * sigmaR * sigmaR;
  const radius = 1;

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const p = j * channels;
      const cr = outData[p];
      const cg = outData[p + 1];
      const cb = outData[p + 2];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let wsum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const jj = yy * width + xx;
          if (mask[jj] < MASK_APPLY_THRESH) continue;
          const pp = jj * channels;
          const nr = outData[pp];
          const ng = outData[pp + 1];
          const nb = outData[pp + 2];
          const spatialW = Math.exp(-(dx * dx + dy * dy) / sigmaS2);
          const dr = nr - cr;
          const dg = ng - cg;
          const db = nb - cb;
          const rangeW = Math.exp(-(dr * dr + dg * dg + db * db) / sigmaR2);
          const w = spatialW * rangeW;
          sr += nr * w;
          sg += ng * w;
          sb += nb * w;
          wsum += w;
        }
      }

      if (wsum > 0) {
        smoothR[j] = sr / wsum;
        smoothG[j] = sg / wsum;
        smoothB[j] = sb / wsum;
      } else {
        smoothR[j] = cr;
        smoothG[j] = cg;
        smoothB[j] = cb;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const seamDepth = localMeanLum[j] - origLum[j];
      const edgeW = clamp(seamDepth / 18, 0, 1);
      const gradW = clamp(Math.abs(origLum[j] - localMeanLum[j]) / 14, 0, 1);
      const preserve = Math.max(edgeW, gradW);
      const blend = LIGHT_SURFACE_BLEND * (1 - preserve);
      if (blend < 0.01) continue;

      const p = j * channels;
      outData[p] = clamp(Math.round(outData[p] * (1 - blend) + smoothR[j] * blend), 0, 255);
      outData[p + 1] = clamp(Math.round(outData[p + 1] * (1 - blend) + smoothG[j] * blend), 0, 255);
      outData[p + 2] = clamp(Math.round(outData[p + 2] * (1 - blend) + smoothB[j] * blend), 0, 255);
    }
  }
}

/** Local CLAHE on upholstery luminance only (masked pixels). */
export function applyClaheOnMask(
  outData,
  mask,
  width,
  height,
  channels,
  yMax,
  origLum,
  localMeanLum,
  tiles = 8,
  clipLimit = 1.5,
) {
  const tilesX = tiles;
  const tilesY = tiles;
  const tileW = width / tilesX;
  const tileH = height / tilesY;
  const nTiles = tilesX * tilesY;
  const luts = new Array(nTiles);
  const hist = new Uint32Array(256);

  for (let ty = 0; ty < tilesY; ty++) {
    const y0 = Math.floor(ty * tileH);
    const y1 = Math.floor((ty + 1) * tileH);
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = Math.floor(tx * tileW);
      const x1 = Math.floor((tx + 1) * tileW);
      hist.fill(0);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        if (y > yMax) continue;
        for (let x = x0; x < x1; x++) {
          const j = y * width + x;
          if (mask[j] < MASK_APPLY_THRESH) continue;
          const p = j * channels;
          const lum = pixelBrightness(outData[p], outData[p + 1], outData[p + 2]);
          const bin = clamp(Math.round(lum), 0, 255);
          hist[bin]++;
          count++;
        }
      }
      luts[ty * tilesX + tx] = buildClippedTileLut(hist, count, clipLimit);
    }
  }

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      const p = j * channels;
      const curL = pixelBrightness(outData[p], outData[p + 1], outData[p + 2]);
      let mapped = sampleTileLut(luts, tilesX, tilesY, tileW, tileH, x, y, curL);

      const seamDepth = localMeanLum[j] - origLum[j];
      if (seamDepth > LIGHT_SEAM_DEPTH_MIN) {
        mapped = Math.min(mapped, localMeanLum[j] - 4);
      }

      const scale = mapped / Math.max(curL, 1);
      outData[p] = clamp(Math.round(outData[p] * scale), 0, 255);
      outData[p + 1] = clamp(Math.round(outData[p + 1] * scale), 0, 255);
      outData[p + 2] = clamp(Math.round(outData[p + 2] * scale), 0, 255);
    }
  }
}

/**
 * Contrast-only leather depth: original micro-detail, shadows, speculars.
 */
export function restoreLeatherDepth(oR, oG, oB, r, g, b, origLum, blurLum, anchors, depthOpts = {}) {
  if (depthOpts.lightLeatherMode === true) {
    const detailBlur = depthOpts.detailBlurLum ?? blurLum;
    const localMean = depthOpts.localMeanLum ?? detailBlur;
    return restoreLightLeatherDepth(oR, oG, oB, r, g, b, origLum, detailBlur, localMean);
  }

  const shadowLock = depthOpts.shadowLockStrength ?? DEPTH_SHADOW_LOCK_STRENGTH;
  const detail = origLum - blurLum;
  let nL = pixelBrightness(r, g, b);

  nL = applySubtleSCurve(nL, anchors.black, anchors.white);

  if (origLum < DEPTH_SHADOW_LOCK_LUM) {
    const t = clamp((DEPTH_SHADOW_LOCK_LUM - origLum) / DEPTH_SHADOW_LOCK_LUM, 0, 1);
    nL = nL + (origLum - nL) * t * shadowLock;
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

  const curL = pixelBrightness(r, g, b);
  if (curL < 1) {
    return { r: oR, g: oG, b: oB };
  }
  return scaleRgbToLuminance(r, g, b, clamp(finalL, 0, 255));
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
 * L fixed; hero a/b + clamped high-frequency texture residual (no cognac large-scale chroma).
 */
export function transferLabPixel(pixel, src, dst, opts = {}) {
  const lightPipeline = opts.lightPipeline === true;
  const finalL = lightPipeline ? pixel.L : computeFinalLabL(pixel.L, dst);
  const texMax = lightPipeline ? LIGHT_TEXTURE_MAX : TEXTURE_RESIDUAL_MAX;

  let resA = 0;
  let resB = 0;
  if (opts.textureResidual) {
    resA = clamp(opts.textureResidual.a, -texMax, texMax);
    resB = clamp(opts.textureResidual.b, -texMax, texMax);
    if (dst.isNeutralLight) {
      resA = clamp(resA, -2, 2);
      resB = clamp(resB, -2, 2);
    } else if (dst.isNeutral) {
      const nLim = Math.min(texMax, 3);
      resA = clamp(resA, -nLim, nLim);
      resB = clamp(resB, -nLim, nLim);
    }
  }

  let a = dst.meanA * (lightPipeline ? LIGHT_CHROMA_STRENGTH : 1) + resA;
  let b = dst.meanB * (lightPipeline ? LIGHT_CHROMA_STRENGTH : 1) + resB;

  if (opts.cognacEdge || opts.fringeEdge) {
    const snap = clamp((opts.edgeStrength ?? 0) * 0.92, 0, 1);
    a = a + (targetA - a) * snap;
    b = b + (targetB - b) * snap;
  }

  a = clamp(a, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);
  b = clamp(b, -LAB_CHROMA_CLAMP, LAB_CHROMA_CLAMP);

  if (dst.isNeutralLight) {
    a = clamp(a, LIGHT_NEUTRAL_A_MIN, LIGHT_NEUTRAL_A_MAX);
    b = clamp(b, LIGHT_NEUTRAL_B_MIN, LIGHT_NEUTRAL_B_MAX);
  }

  const { r, g, b: bOut } = labToRgb(finalL, a, b);
  const orig = opts.originalRgb;
  if (orig && !lightPipeline && !dst.isLightSwatch) {
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
    throw new Error(
      `No hero swatch pixels (L ${HERO_L_MIN}–${HERO_L_MAX}, sat ≥ ${HERO_SAT_MIN}, trimmed): ${resolved}`,
    );
  }

  const swatchRgbAvg = computeFullSwatchRgbAvg(data, info.width, info.height, info.channels);
  const stats = computeHeroSwatchStats(heroes, swatchRgbAvg);
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

export function recolorSofa(baseImage, mask, sofaStats, swatchStats, sofaBottomY, recolorOpts = {}) {
  const lightPipeline = recolorOpts.lightPipeline === true;
  const cognacData = recolorOpts.cognacImage?.data ?? baseImage.data;
  const cognacChannels = recolorOpts.cognacImage?.channels ?? baseImage.channels;
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
  const abMaps = buildSofaAbTextureMaps(baseImage, width, height, channels);

  for (let y = 0; y < height; y++) {
    if (y > yMax) continue;
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;

      const p = j * channels;
      const oR = data[p];
      const oG = data[p + 1];
      const oB = data[p + 2];
      const cP = j * cognacChannels;
      if (isCastShadowPixel(cognacData[cP], cognacData[cP + 1], cognacData[cP + 2], y, sofaBottomY)) {
        continue;
      }

      const edgeDist = distanceToBackground(mask, width, height, x, y, EDGE_RECOLOR_DISTANCE);
      const edgeStrength = edgeDist <= EDGE_RECOLOR_DISTANCE ? (EDGE_RECOLOR_DISTANCE - edgeDist + 1) / (EDGE_RECOLOR_DISTANCE + 1) : 0;
      const fringeEdge = edgeStrength > 0 && isEdgeFringePixel(oR, oG, oB);
      const cognacEdge =
        !lightPipeline &&
        edgeStrength > 0 &&
        (isCognacFringePixel(cognacData[cP], cognacData[cP + 1], cognacData[cP + 2]) || fringeEdge);

      const baseLab = rgbToLab(oR, oG, oB);
      let { r, g, b } = transferLabPixel(baseLab, sofaStats, swatchStats, {
        lightPipeline,
        edgeStrength,
        cognacEdge,
        fringeEdge,
        originalRgb: { r: oR, g: oG, b: oB },
        textureResidual: {
          a: abMaps.origA[j] - abMaps.blurA[j],
          b: abMaps.origB[j] - abMaps.blurB[j],
        },
      });

      if (!lightPipeline) {
        ({ r, g, b } = restoreLeatherDepth(oR, oG, oB, r, g, b, origLum[j], blurLum[j], anchors, {
          shadowLockStrength: swatchStats.shadowLockStrength,
        }));
      }

      out[p] = r;
      out[p + 1] = g;
      out[p + 2] = b;
      if (channels === 4) out[p + 3] = data[p + 3];
    }
  }

  return out;
}

export async function processSwatch(
  swatchPath,
  cognacSofa,
  lightSofa,
  mask,
  cognacSofaStats,
  sofaBottomY,
) {
  const resolved = resolveOriginalSwatchPath(swatchPath);
  if (!resolved) throw new Error(`Not an original swatch: ${swatchPath}`);

  const swatchName = basename(resolved, extname(resolved));
  const swatch = await getSwatchLabStats(resolved);
  const lightPipeline = isLightLeatherPipeline(swatch.stats, swatchName);
  const renderBase = lightPipeline ? lightSofa : cognacSofa;
  const pipelineSofaStats = lightPipeline
    ? computeSofaLabStats(lightSofa, mask, sofaBottomY)
    : cognacSofaStats;

  console.log({
    swatchName,
    pipeline: lightPipeline ? 'light-neutral-base' : 'cognac-preserve-L',
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
    neutral: swatch.stats.isNeutral ?? false,
    lightLift: swatch.stats.lightLiftTier ?? 0,
    heroRgbAvg: Math.round(swatch.stats.heroRgbAvg ?? 0),
    swatchAvgRgb: Math.round(swatch.stats.swatchAvgRgb ?? swatch.stats.swatchRgbAvg ?? 0),
    neutralLight: swatch.stats.isNeutralLight === true,
    chromaGain: Math.round((swatch.stats.chromaGain ?? CHROMA_GAIN_BASE) * 100) / 100,
    satFactor: Math.round((swatch.stats.satFactor ?? 1) * 100) / 100,
  });

  const outData = recolorSofa(renderBase, mask, pipelineSofaStats, swatch.stats, sofaBottomY, {
    lightPipeline,
    cognacImage: cognacSofa,
  });
  const outPath = join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(outData, outPath, renderBase.width, renderBase.height, renderBase.channels);
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
  console.log('  pipelines: dark=cognac+L preserve | light=lifted neutral base + chroma');

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  const mask = await createUpholsteryMask(baseSofa, maskPath);
  const sofaBottomY = getSofaBottomY(baseSofa);
  const cognacSofaStats = computeSofaLabStats(baseSofa, mask, sofaBottomY);
  const lightSofa = buildLightNeutralSofaBase(baseSofa, mask, sofaBottomY);
  const lightSofaStats = computeSofaLabStats(lightSofa, mask, sofaBottomY);
  console.log(
    `  cognac LAB L ${Math.round(cognacSofaStats.meanL)} | light-base RGB ~${Math.round(lightSofaStats.meanL)}`,
  );

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath } = await processSwatch(
      swPath,
      baseSofa,
      lightSofa,
      mask,
      cognacSofaStats,
      sofaBottomY,
    );
    console.log(`\nDone: ${outPath}`);
    return;
  }

  for (const file of swatchFiles) {
    await processSwatch(
      join(SWATCH_DIR, file),
      baseSofa,
      lightSofa,
      mask,
      cognacSofaStats,
      sofaBottomY,
    );
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
