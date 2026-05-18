/**
 * Photographic leather recolor — swatch H/S + original sofa L (HSL); no cognac bleed in midtones. No AI.
 */
import AdmZip from 'adm-zip';
import {
  mkdirSync,
  readdirSync,
  existsSync,
  writeFileSync,
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
const FLOOR_MARGIN_PX = 18;
const SWATCH_CENTER_CROP = 0.35;
const SWATCH_BLUR_PX = 16;
const SWATCH_CLUSTER_K = 3;
const SWATCH_CLUSTER_SHADOW_L = 0.18;
const SWATCH_CLUSTER_HIGHLIGHT_L = 0.85;
const SWATCH_KMEANS_MAX_PIXELS = 12000;
const SWATCH_SAT_SCALE = 0.9;
const SEAM_HSL_L = 0.12;
const HIGHLIGHT_HSL_L = 0.82;
const HIGHLIGHT_ORIGINAL_BLEND = 0.2;
const MASK_FEATHER_SIGMA = 0.7;
const DEBUG_CHIP_SIZE = 200;

const SWATCH_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function pixelBrightness(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isNearWhite(r, g, b) {
  return r > BG_THRESH && g > BG_THRESH && b > BG_THRESH;
}

function medianOf(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c) {
  const v = clamp(c, 0, 1);
  return v <= 0.0031308 ? v * 12.92 * 255 : (1.055 * v ** (1 / 2.4) - 0.055) * 255;
}

function rgbToLab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  let x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  let y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  let z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;
  x /= 0.95047;
  z /= 1.08883;
  const f = (t) => (t > 0.008856 ? t ** (1 / 3) : (903.3 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
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

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(clamp(hue2rgb(p, q, h + 1 / 3) * 255, 0, 255)),
    Math.round(clamp(hue2rgb(p, q, h) * 255, 0, 255)),
    Math.round(clamp(hue2rgb(p, q, h - 1 / 3) * 255, 0, 255)),
  ];
}

function pixelSaturation(r, g, b) {
  return rgbToHsl(r, g, b).s;
}

function rgbMaxDiff(r, g, b) {
  return Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
}

/** Upholstery midtones only — excludes bg, feet, seams, specular, floor shadow. */
function isUpholsteryMidtone(r, g, b) {
  if (isNearWhite(r, g, b)) return false;
  const bright = pixelBrightness(r, g, b);
  if (bright < 28) return false;
  if (bright > 242) return false;
  const sat = pixelSaturation(r, g, b);
  if (sat < 0.08 && bright > 210) return false;
  if (sat < 0.1) return false;
  return true;
}

/** Low-sat, low-contrast pixels near the floor (ambient / drop shadow). */
function isFloorAmbientPixel(r, g, b) {
  const bright = pixelBrightness(r, g, b);
  if (bright > 200) return false;
  if (pixelSaturation(r, g, b) >= 0.08) return false;
  return rgbMaxDiff(r, g, b) < 22;
}

/** Edge-only mask feather (Gaussian ~0.7px). */
async function featherMask(mask, width, height, sigma = MASK_FEATHER_SIGMA) {
  const { data } = await sharp(Buffer.from(mask), {
    raw: { width, height, channels: 1 },
  })
    .blur(sigma)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

/** @deprecated box blur — use featherMask (sharp) */
function featherMaskBox(mask, width, height, radius = 1) {
  const src = new Float32Array(width * height);
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  for (let j = 0; j < mask.length; j++) src[j] = mask[j];

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

  const result = new Uint8Array(width * height);
  for (let j = 0; j < mask.length; j++) {
    result[j] = Math.round(clamp(out[j], 0, 255));
  }
  return result;
}

function labToRgb(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const finv = (t) => (t > 0.206897 ? t ** 3 : (116 * t - 16) / 903.3);
  let y = finv(fy);
  let x = finv(fx);
  let z = finv(fz);
  x *= 0.95047;
  z *= 1.08883;
  const lr = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const lg = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const lb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return [
    Math.round(clamp(linearToSrgb(lr), 0, 255)),
    Math.round(clamp(linearToSrgb(lg), 0, 255)),
    Math.round(clamp(linearToSrgb(lb), 0, 255)),
  ];
}

/**
 * @returns {Promise<{ data: Buffer, width: number, height: number, channels: number }>}
 */
export async function loadImage(path) {
  const img = sharp(path).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

/** Write via temp file + verify size (OneDrive often blocks large direct writes). */
export async function saveImage(data, path, width, height, channels = 4) {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = join(
    tmpdir(),
    `sofa-recolor-${Date.now()}-${basename(path).replace(/[^\w.-]/g, '_')}`,
  );

  await sharp(data, {
    raw: { width, height, channels },
  })
    .png()
    .toFile(tmpPath);

  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* locked target */
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

  if (!existsSync(path)) {
    throw new Error(`Sofa PNG not created: ${path}`);
  }
  const { size } = statSync(path);
  if (size < 10_000) {
    throw new Error(`Sofa PNG too small (${size} bytes), write likely failed: ${path}`);
  }
  return size;
}

function isSwatchFoldShadow(hsl) {
  return hsl.l < SWATCH_CLUSTER_SHADOW_L;
}

function isSwatchFoldHighlight(hsl) {
  return (
    hsl.l > SWATCH_CLUSTER_HIGHLIGHT_L ||
    (hsl.l > 0.72 && hsl.s < 0.07)
  );
}

function meanHueCircular(pixels) {
  let sumX = 0;
  let sumY = 0;
  for (const p of pixels) {
    const ang = p.h * 2 * Math.PI;
    sumX += Math.cos(ang);
    sumY += Math.sin(ang);
  }
  let h = Math.atan2(sumY, sumX) / (2 * Math.PI);
  if (h < 0) h += 1;
  return h;
}

function distHslFeature(a, b) {
  const dh = a.hx - b.hx;
  const dy = a.hy - b.hy;
  const ds = (a.s - b.s) * 1.4;
  const dl = (a.l - b.l) * 0.65;
  return dh * dh + dy * dy + ds * ds + dl * dl;
}

function pickInitialCentroids(pixels, k) {
  const sorted = [...pixels].sort((a, b) => a.s - b.s);
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.min(
      sorted.length - 1,
      Math.floor(((i + 0.5) / k) * sorted.length),
    );
    const p = sorted[idx];
    centroids.push({ hx: p.hx, hy: p.hy, s: p.s, l: p.l });
  }
  return centroids;
}

function kMeansHsl(pixels, k = SWATCH_CLUSTER_K) {
  let centroids = pickInitialCentroids(pixels, k);
  const assign = new Uint8Array(pixels.length);

  for (let iter = 0; iter < 30; iter++) {
    let moved = false;
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = distHslFeature(pixels[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) moved = true;
      assign[i] = best;
    }

    const next = Array.from({ length: k }, () => ({
      hx: 0,
      hy: 0,
      s: 0,
      l: 0,
      n: 0,
    }));
    for (let i = 0; i < pixels.length; i++) {
      const c = assign[i];
      const p = pixels[i];
      next[c].hx += p.hx;
      next[c].hy += p.hy;
      next[c].s += p.s;
      next[c].l += p.l;
      next[c].n++;
    }
    for (let c = 0; c < k; c++) {
      if (next[c].n === 0) continue;
      centroids[c] = {
        hx: next[c].hx / next[c].n,
        hy: next[c].hy / next[c].n,
        s: next[c].s / next[c].n,
        l: next[c].l / next[c].n,
      };
    }
    if (!moved) break;
  }

  return assign;
}

function summarizeClusters(pixels, assign, k) {
  const groups = Array.from({ length: k }, () => []);
  for (let i = 0; i < pixels.length; i++) {
    groups[assign[i]].push(pixels[i]);
  }

  return groups.map((members, id) => {
    if (!members.length) {
      return { id, count: 0, meanH: 0, meanS: 0, meanL: 0, medianL: 0 };
    }
    const ls = members.map((p) => p.l);
    return {
      id,
      count: members.length,
      meanH: meanHueCircular(members),
      meanS: members.reduce((s, p) => s + p.s, 0) / members.length,
      meanL: members.reduce((s, p) => s + p.l, 0) / members.length,
      medianL: medianOf(ls),
      members,
    };
  });
}

function pickDominantLeatherCluster(clusters) {
  const isValid = (c) =>
    c.count > 12 &&
    c.meanL >= SWATCH_CLUSTER_SHADOW_L &&
    c.meanL <= SWATCH_CLUSTER_HIGHLIGHT_L &&
    !(c.meanL > 0.72 && c.meanS < 0.06);

  const valid = clusters.filter(isValid);
  const pool = valid.length ? valid : clusters.filter((c) => c.count > 0);
  if (!pool.length) {
    throw new Error('No swatch clusters found');
  }

  return pool.reduce((best, c) => (c.meanS > best.meanS ? c : best));
}

/**
 * Center 35% crop → blur 16px → k-means (k=3) → most saturated leather cluster.
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
  const w = info.width;
  const h = info.height;
  const pixels = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a < 20) continue;
      if (isNearWhite(r, g, b)) continue;
      const hsl = rgbToHsl(r, g, b);
      if (isSwatchFoldShadow(hsl) || isSwatchFoldHighlight(hsl)) continue;
      const ang = hsl.h * 2 * Math.PI;
      pixels.push({
        h: hsl.h,
        s: hsl.s,
        l: hsl.l,
        hx: Math.cos(ang),
        hy: Math.sin(ang),
      });
    }
  }

  if (pixels.length < SWATCH_CLUSTER_K * 8) {
    throw new Error(`Too few swatch pixels after fold filter: ${swatchPath}`);
  }

  let sample = pixels;
  if (pixels.length > SWATCH_KMEANS_MAX_PIXELS) {
    sample = [];
    const step = pixels.length / SWATCH_KMEANS_MAX_PIXELS;
    for (let i = 0; i < SWATCH_KMEANS_MAX_PIXELS; i++) {
      sample.push(pixels[Math.floor(i * step)]);
    }
  }

  const assign = kMeansHsl(sample, SWATCH_CLUSTER_K);
  const clusters = summarizeClusters(sample, assign, SWATCH_CLUSTER_K);
  const chosen = pickDominantLeatherCluster(clusters);

  const targetH = chosen.meanH;
  const targetS = chosen.meanS;
  const targetL = chosen.medianL;
  const [r, g, b] = hslToRgb(targetH, targetS, targetL);

  return {
    r,
    g,
    b,
    hsl: { h: targetH, s: targetS, l: targetL },
    cluster: {
      id: chosen.id,
      count: chosen.count,
      meanS: chosen.meanS,
      clusters: clusters.map((c) => ({
        id: c.id,
        count: c.count,
        meanS: Math.round(c.meanS * 1000) / 1000,
        meanL: Math.round(c.meanL * 1000) / 1000,
      })),
    },
  };
}

/** Flat fill = algorithmic target (not a photo of the swatch). */
export async function saveDebugColorChip(swatchName, r, g, b) {
  const path = join(OUTPUT_DIR, `DEBUG-${swatchName}-target-color.png`);
  await sharp({
    create: {
      width: DEBUG_CHIP_SIZE,
      height: DEBUG_CHIP_SIZE,
      channels: 3,
      background: { r, g, b },
    },
  })
    .png()
    .toFile(path);
  return path;
}

/** Center crop of swatch (blurred) for side-by-side QA vs target chip. */
export async function saveDebugSwatchCrop(swatchPath, swatchName) {
  const meta = await sharp(swatchPath).metadata();
  const width = meta.width;
  const height = meta.height;
  const margin = (1 - SWATCH_CENTER_CROP) / 2;
  const x0 = Math.floor(width * margin);
  const y0 = Math.floor(height * margin);
  const cw = Math.max(1, Math.floor(width * SWATCH_CENTER_CROP));
  const ch = Math.max(1, Math.floor(height * SWATCH_CENTER_CROP));
  const path = join(OUTPUT_DIR, `DEBUG-${swatchName}-swatch-crop.png`);
  await sharp(swatchPath)
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .blur(SWATCH_BLUR_PX)
    .resize(DEBUG_CHIP_SIZE, DEBUG_CHIP_SIZE, { fit: 'cover' })
    .png()
    .toFile(path);
  return path;
}


/**
 * Cognac / base leather color from midtone upholstery on the sofa photo.
 */
export function getSourceLeatherColor(baseImage, mask) {
  const { data, width, height, channels } = baseImage;
  const rs = [];
  const gs = [];
  const bs = [];

  for (let j = 0, p = 0; j < width * height; j++, p += channels) {
    if (mask[j] < 200) continue;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (isNearWhite(r, g, b)) continue;
    const bright = pixelBrightness(r, g, b);
    if (bright < 48 || bright > 195) continue;
    rs.push(r);
    gs.push(g);
    bs.push(b);
  }

  if (!rs.length) {
    return { r: 140, g: 85, b: 45 };
  }

  return {
    r: Math.round(medianOf(rs)),
    g: Math.round(medianOf(gs)),
    b: Math.round(medianOf(bs)),
  };
}

/** Lowest row of saturated leather (not gray floor shadow). */
export function getSofaBottomY(baseImage) {
  const { data, width, height, channels } = baseImage;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      if (isNearWhite(r, g, b)) continue;
      if (pixelBrightness(r, g, b) < 35) continue;
      if (pixelSaturation(r, g, b) < 0.12) continue;
      return y;
    }
  }
  return height - 1;
}

/**
 * Upholstery midtone mask (not full silhouette). Edge feather ~0.7px.
 */
export async function createUpholsteryMask(image, optionalMaskPath = null) {
  const { data, width, height, channels } = image;
  const hard = new Uint8Array(width * height);
  let useOptional = false;

  if (optionalMaskPath && existsSync(optionalMaskPath)) {
    const m = await loadImage(optionalMaskPath);
    if (m.width !== width || m.height !== height) {
      throw new Error(
        `mask.png must match sofa size ${width}x${height}, got ${m.width}x${m.height}`,
      );
    }
    useOptional = true;
    for (let j = 0, i = 0; j < width * height; j++, i += m.channels) {
      const lum = pixelBrightness(m.data[i], m.data[i + 1], m.data[i + 2]);
      hard[j] = lum > 127 ? 255 : 0;
    }
  }

  for (let j = 0, p = 0; j < width * height; j++, p += channels) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (useOptional && hard[j] < 128) {
      hard[j] = 0;
      continue;
    }
    hard[j] = isUpholsteryMidtone(r, g, b) ? 255 : 0;
  }

  return featherMask(hard, width, height, MASK_FEATHER_SIGMA);
}

/** @deprecated Use createUpholsteryMask */
export async function createSofaMask(image, optionalMaskPath = null) {
  return createUpholsteryMask(image, optionalMaskPath);
}

export function getSofaBounds(mask, imgWidth, imgHeight) {
  let minX = imgWidth;
  let minY = imgHeight;
  let maxX = 0;
  let maxY = 0;
  let any = false;

  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      if (mask[y * imgWidth + x] < 24) continue;
      any = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!any) {
    return {
      minX: 0,
      minY: 0,
      maxX: imgWidth - 1,
      maxY: imgHeight - 1,
      width: imgWidth,
      height: imgHeight,
    };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * HSL hue replace: swatch H/S, original L; no original hue in midtones.
 */
export function recolorSofa(
  baseImage,
  mask,
  swatchRgb,
  sofaBottomY,
  _sofaBounds = null,
) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const swatchHsl = swatchRgb.hsl ?? rgbToHsl(swatchRgb.r, swatchRgb.g, swatchRgb.b);
  const finalH = swatchHsl.h;
  const finalS = swatchHsl.s * SWATCH_SAT_SCALE;
  const yFloor = sofaBottomY - FLOOR_MARGIN_PX;
  const yFloorAmbient = sofaBottomY - 45;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const maskW = mask[j] / 255;
      if (maskW < 0.004) continue;
      if (y > yFloor) continue;

      const p = j * channels;
      const oR = data[p];
      const oG = data[p + 1];
      const oB = data[p + 2];
      const oA = channels === 4 ? data[p + 3] : 255;

      if (y > yFloorAmbient && isFloorAmbientPixel(oR, oG, oB)) continue;

      const baseHsl = rgbToHsl(oR, oG, oB);

      if (baseHsl.l < SEAM_HSL_L) continue;

      const [nR, nG, nB] = hslToRgb(finalH, finalS, baseHsl.l);

      let t = maskW;
      if (baseHsl.l > HIGHLIGHT_HSL_L) {
        t *= 1 - HIGHLIGHT_ORIGINAL_BLEND;
      }

      out[p] = Math.round(oR + (nR - oR) * t);
      out[p + 1] = Math.round(oG + (nG - oG) * t);
      out[p + 2] = Math.round(oB + (nB - oB) * t);
      if (channels === 4) out[p + 3] = oA;
    }
  }

  return out;
}

export async function processSwatch(
  swatchPath,
  baseSofa,
  mask,
  _sourceColor,
  sofaBottomY,
  sofaBounds,
) {
  const swatchName = basename(swatchPath, extname(swatchPath));
  const targetRgb = await getSwatchTargetRgb(swatchPath);
  console.log({
    swatchName,
    targetRGB: [targetRgb.r, targetRgb.g, targetRgb.b],
    targetHSL: [
      Math.round(targetRgb.hsl.h * 1000) / 1000,
      Math.round(targetRgb.hsl.s * 1000) / 1000,
      Math.round(targetRgb.hsl.l * 1000) / 1000,
    ],
    cluster: targetRgb.cluster.id,
    clusterStats: targetRgb.cluster.clusters,
  });

  const outData = recolorSofa(
    baseSofa,
    mask,
    targetRgb,
    sofaBottomY,
    sofaBounds,
  );
  const outName = `${swatchName}.png`;
  const outPath = join(OUTPUT_DIR, outName);
  const bytes = await saveImage(
    outData,
    outPath,
    baseSofa.width,
    baseSofa.height,
    baseSofa.channels,
  );
  console.log(`  wrote ${outName} (${Math.round(bytes / 1024)} KB)`);

  const debugPath = await saveDebugColorChip(
    swatchName,
    targetRgb.r,
    targetRgb.g,
    targetRgb.b,
  );
  await saveDebugSwatchCrop(swatchPath, swatchName);

  const stampPath = join(OUTPUT_DIR, '_last-render.txt');
  const stamp = `${new Date().toISOString()}\n${swatchName}\nmethod: hsl-hue-replace\nsampling: kmeans-saturated-cluster\ntargetRGB: ${targetRgb.r},${targetRgb.g},${targetRgb.b}\ncluster: ${targetRgb.cluster.id}\ndebugChip: ${basename(debugPath)}\n`;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  try {
    writeFileSync(stampPath, stamp);
  } catch {
    /* OneDrive may lock _last-render.txt */
  }

  return { outPath, targetColor: targetRgb, debugPath };
}

export function zipOutputs(outputDir, zipPath) {
  const zip = new AdmZip();
  const files = readdirSync(outputDir).filter(
    (f) =>
      f.toLowerCase().endsWith('.png') &&
      f !== 'sofa-renders.zip' &&
      !f.startsWith('DEBUG-'),
  );
  if (!files.length) {
    throw new Error(`No PNG files to zip in ${outputDir}`);
  }
  for (const f of files) {
    zip.addLocalFile(join(outputDir, f), '', f);
  }
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
  let zip = false;

  for (const a of args) {
    if (a === '--all') all = true;
    else if (a === '--zip') zip = true;
    else if (a === '--currant' || a === '--current') swatchFile = DEFAULT_PREVIEW_SWATCH;
    else if (a.startsWith('--swatch=')) swatchFile = a.slice('--swatch='.length);
    else if (!a.startsWith('-')) swatchFile = a;
  }

  if (all) return { mode: 'all', zip: true };
  return { mode: 'one', swatchFile: swatchFile || DEFAULT_PREVIEW_SWATCH, zip };
}

export async function main(argv = process.argv) {
  if (!existsSync(SOFA_PATH)) {
    console.error(`Missing base sofa: ${SOFA_PATH}`);
    process.exit(1);
  }
  if (!existsSync(SWATCH_DIR)) {
    console.error(`Missing swatch folder: ${SWATCH_DIR}`);
    process.exit(1);
  }

  const cli = parseCli(argv);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Base sofa: ${SOFA_PATH}`);
  const baseSofa = await loadImage(SOFA_PATH);
  console.log(`  ${baseSofa.width}x${baseSofa.height}`);

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  if (maskPath) console.log(`Optional mask refine: ${maskPath}`);
  const mask = await createUpholsteryMask(baseSofa, maskPath);
  const sofaBounds = getSofaBounds(mask, baseSofa.width, baseSofa.height);
  const sofaBottomY = getSofaBottomY(baseSofa);
  const sourceColor = getSourceLeatherColor(baseSofa, mask);
  console.log(
    `  Source leather (cognac on photo): RGB(${sourceColor.r}, ${sourceColor.g}, ${sourceColor.b})`,
  );
  console.log(
    `  Sofa bounds: ${sofaBounds.width}x${sofaBounds.height} at (${sofaBounds.minX},${sofaBounds.minY})`,
  );
  console.log(
    `  Upholstery only; floor excluded below y=${sofaBottomY - FLOOR_MARGIN_PX} (sofa bottom y=${sofaBottomY})`,
  );

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath, targetColor } = await processSwatch(
      swPath,
      baseSofa,
      mask,
      sourceColor,
      sofaBottomY,
      sofaBounds,
    );
    console.log(
      `  ${basename(swPath)} → preview RGB(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`,
    );
    console.log(`\nDone. 1 PNG: ${outPath}`);
    console.log('Run all swatches: npm run render');
    return;
  }

  const swatches = readdirSync(SWATCH_DIR)
    .filter((f) => SWATCH_EXT.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const written = [];
  for (const file of swatches) {
    const swPath = join(SWATCH_DIR, file);
    const { outPath } = await processSwatch(
      swPath,
      baseSofa,
      mask,
      sourceColor,
      sofaBottomY,
      sofaBounds,
    );
    written.push(outPath);
  }

  const sofaOnDisk = readdirSync(OUTPUT_DIR).filter(
    (f) => f.toLowerCase().endsWith('.png') && !f.startsWith('DEBUG-'),
  );
  console.log(`\nSofa PNGs on disk: ${sofaOnDisk.length} / ${swatches.length}`);
  if (sofaOnDisk.length < swatches.length) {
    console.warn(
      'WARNING: Some sofa renders are missing. Close sofa-renders.zip in Explorer/OneDrive, then run npm run render again.',
    );
  }

  try {
    const n = zipOutputs(OUTPUT_DIR, ZIP_PATH);
    console.log(`Zip: ${ZIP_PATH} (${n} sofa files)`);
  } catch (err) {
    console.warn(`Zip skipped: ${err.message}`);
  }

  console.log(`\nDone. ${written.length} sofa render(s) in:\n  ${OUTPUT_DIR}`);
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
