import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { loadPhase1Masks } from '../../phase1/loadMasks.js';
import { bbox, dilate, erode, intersect, subtract, union } from '../../phase1/masks.js';
import { buildStage4bCoverageMasks } from '../../phase4b/coverage.js';
import { buildBottomCleanupBandFromImage, buildLower12Region } from '../../phase6a/bottomSeam.js';
import type { Mask } from '../../phase1/masks.js';
import { loadRgba, type RgbaImage } from '../../phase1/segment.js';
import { buildLinearL, boxBlur, labToRgb, rgbToLab } from '../../phase5/labUtil.js';
import { enforceLegExclusion } from '../../recolor/cleanup.js';
import type { SwatchProfile } from '../spec.js';
import {
  bestPreviewPath,
  cleanupDebugBottomLinesPath,
  cleanupDebugLegZonesPath,
  cleanupSpecV2Path,
  cleanupV2ComparisonPath,
  cleanupV2MasterPath,
} from '../paths.js';
import { writeTwoPanelComparison } from './cleanupV2Comparison.js';

const BOTTOM_LINE_LIFT = 0.42;
const BOTTOM_CHROMA_PULL = 0.18;
const LEG_ZONE_DILATE_PX = 4;
const LEG_SAMPLE_INNER = 12;
const LEG_SAMPLE_OUTER = 28;
const LEG_MAX_BLEND = 0.28;

type LabTriplet = { L: number; a: number; b: number };

function targetLabTriplet(target: { l: number; a: number; b: number }): LabTriplet {
  return { L: target.l, a: target.a, b: target.b };
}

function writeLabPixel(
  data: Buffer,
  p: number,
  L: number,
  a: number,
  b: number,
): void {
  if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return;
  const rgb = labToRgb(L, a, b);
  data[p] = rgb.r;
  data[p + 1] = rgb.g;
  data[p + 2] = rgb.b;
}

function isWarmPixel(r: number, g: number, b: number, lab: LabTriplet, target: LabTriplet): boolean {
  if (lab.b > target.b + 3 && lab.a > target.a - 2) return true;
  return r > g + 3 && r - b > 16 && r > 85;
}

export interface CleanupV2Result {
  masterPath: string;
  comparisonPath: string;
  debugBottomPath: string;
  debugLegPath: string;
  specPath: string;
  spec: CleanupV2Spec;
}

export interface CleanupV2Spec {
  swatchCode: string;
  inputMaster: string;
  outputMaster: string;
  pass: 'preview-cleanup-v2';
  bottomLine: {
    pixelsTouched: number;
    meanWeight: number;
    meanLBefore: number;
    meanLAfter: number;
    frontRailPixels: number;
    seamBandPixels: number;
    detectionMaskPixels: number;
    detectionWeightPixels: number;
  };
  legZone: {
    zonePixels: number;
    pixelsTouched: number;
    pixelsContaminated: number;
    meanContamScore: number;
  };
  integrity: {
    feetPixelsChanged: number;
    backgroundPixelsChanged: number;
    pixelsChangedOutsideZones: number;
  };
}

function emptyMask(w: number, h: number): Mask {
  return { data: new Uint8Array(w * h), width: w, height: h };
}

function cloneImage(img: RgbaImage): RgbaImage {
  return { ...img, data: Buffer.from(img.data) };
}

/** Lower front rail: bottom ~10% of silhouette, alpha-on, non-leg (includes seam trim). */
function buildFrontRailRegion(alpha: Mask, legs: Mask): Mask {
  const bb = bbox(alpha);
  if (!bb) return emptyMask(alpha.width, alpha.height);
  const h = bb.maxY - bb.minY + 1;
  const yStart = bb.minY + Math.floor(h * (1 - 0.1));
  const xPad = Math.floor((bb.maxX - bb.minX + 1) * 0.04);
  const nonLeg = subtract(alpha, legs);
  const out = emptyMask(alpha.width, alpha.height);
  const { width } = alpha;
  for (let y = yStart; y <= bb.maxY; y++) {
    for (let x = bb.minX + xPad; x <= bb.maxX - xPad; x++) {
      const j = y * width + x;
      if (nonLeg.data[j] < 128) continue;
      out.data[j] = 255;
    }
  }
  return out;
}

/**
 * Horizontal dark seam bands: pixel darker than vertical neighbors on both sides.
 */
function buildBottomDarkLineWeights(
  image: RgbaImage,
  frontRail: Mask,
  seamBand: Mask,
): { weights: Float32Array; mask: Mask } {
  const { width, height } = image;
  const L = buildLinearL(image);
  const weights = new Float32Array(width * height);
  const mask = emptyMask(width, height);

  for (let i = 0; i < seamBand.data.length; i++) {
    if (seamBand.data[i] < 128) continue;
    weights[i] = Math.max(weights[i], 0.48);
    mask.data[i] = 255;
  }

  const blurred = boxBlur(weights, width, height, 1);
  for (let i = 0; i < blurred.length; i++) {
    if (frontRail.data[i] < 128) blurred[i] = 0;
    else blurred[i] = Math.min(1, blurred[i] * 1.2);
  }
  return { weights: blurred, mask };
}

function applyBottomLineCleanup(
  image: RgbaImage,
  weights: Float32Array,
  alpha: Mask,
  legs: Mask,
  target: LabTriplet,
): { image: RgbaImage; stats: CleanupV2Spec['bottomLine'] } {
  const out = cloneImage(image);
  const { width, height, channels } = out;
  const Lmap = buildLinearL(image);
  let touched = 0;
  let sumW = 0;
  let sumLBefore = 0;
  let sumLAfter = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const w = weights[j];
      if (w < 0.03) continue;

      const p = j * channels;
      const cur = rgbToLab(out[p], out[p + 1], out[p + 2]);
      if (Number.isFinite(cur.L)) sumLBefore += cur.L;

      let refL = Lmap[j];
      let refA = cur.a;
      let refB = cur.b;
      let n = 0;
      for (let dy = -12; dy <= 12; dy++) {
        if (dy === 0) continue;
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        const jj = yy * width + x;
        if (legs.data[jj] >= 128 || weights[jj] > 0.55) continue;
        if (alpha.data[jj] < 128) continue;
        const lab = rgbToLab(out[jj * channels], out[jj * channels + 1], out[jj * channels + 2]);
        refL += lab.L;
        refA += lab.a;
        refB += lab.b;
        n++;
      }
      if (n > 0) {
        refL /= n + 1;
        refA /= n + 1;
        refB /= n + 1;
      } else {
        refL = Math.max(cur.L, target.L - 4);
        refA = target.a;
        refB = target.b;
      }

      const lift = w * BOTTOM_LINE_LIFT;
      let L = cur.L * (1 - lift) + refL * lift;
      L = Math.min(L, refL + 1.8);
      const a = cur.a * (1 - lift * BOTTOM_CHROMA_PULL) + refA * (lift * BOTTOM_CHROMA_PULL);
      const b = cur.b * (1 - lift * BOTTOM_CHROMA_PULL) + refB * (lift * BOTTOM_CHROMA_PULL);
      writeLabPixel(out.data, p, L, a, b);
      touched++;
      sumW += w;
      if (Number.isFinite(L)) sumLAfter += L;
    }
  }

  return {
    image: out,
    stats: {
      pixelsTouched: touched,
      meanWeight: touched ? sumW / touched : 0,
      meanLBefore: touched ? sumLBefore / touched : 0,
      meanLAfter: touched ? sumLAfter / touched : 0,
    },
  };
}

function buildLegCleanupZone(coverage: ReturnType<typeof buildStage4bCoverageMasks>): Mask {
  return dilate(coverage.footCornerRing, 2);
}

function contaminationScore(
  r: number,
  g: number,
  b: number,
  lab: LabTriplet,
  target: LabTriplet,
): number {
  if (!isWarmPixel(r, g, b, lab, target)) return 0;
  const da = Math.max(0, lab.a - target.a);
  const db = Math.max(0, lab.b - target.b - 3);
  return da + db * 0.9 + Math.max(0, r - g - 4) * 0.15;
}

function sampleCleanUpholsteryNearLeg(
  image: RgbaImage,
  upholstery: Mask,
  legs: Mask,
  legZone: Mask,
  x: number,
  y: number,
  target: LabTriplet,
): LabTriplet | null {
  const { width, height, channels } = image;
  const ls: number[] = [];
  const as: number[] = [];
  const bs: number[] = [];

  for (let dy = -LEG_SAMPLE_OUTER; dy <= -LEG_SAMPLE_INNER; dy++) {
    for (let dx = -14; dx <= 14; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const j = yy * width + xx;
      if (upholstery.data[j] < 128 || legs.data[j] >= 128 || legZone.data[j] >= 128) continue;
      const lab = rgbToLab(
        image.data[j * channels],
        image.data[j * channels + 1],
        image.data[j * channels + 2],
      );
      if (contaminationScore(image.data[j * channels], image.data[j * channels + 1], image.data[j * channels + 2], lab, target) > 2) continue;
      ls.push(lab.L);
      as.push(lab.a);
      bs.push(lab.b);
    }
  }
  if (ls.length < 8) return null;
  const mid = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[(s.length / 2) | 0];
  };
  return { L: mid(ls), a: mid(as), b: mid(bs) };
}

function applyLegContaminationCleanup(
  image: RgbaImage,
  upholstery: Mask,
  legs: Mask,
  legZone: Mask,
  target: LabTriplet,
): { image: RgbaImage; stats: CleanupV2Spec['legZone']; contamMask: Mask } {
  const out = cloneImage(image);
  const { width, height, channels } = out;
  const contamMask = emptyMask(width, height);
  let touched = 0;
  let contaminated = 0;
  let sumScore = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (legZone.data[j] < 128 || legs.data[j] >= 128) continue;
      const p = j * channels;
      const cr = out[p];
      const cg = out[p + 1];
      const cb = out[p + 2];
      const cur = rgbToLab(cr, cg, cb);
      const score = contaminationScore(cr, cg, cb, cur, target);
      if (score < 1.8) continue;
      contaminated++;
      sumScore += score;
      contamMask.data[j] = 255;

      const sample = sampleCleanUpholsteryNearLeg(out, upholstery, legs, legZone, x, y, target);
      const blend = Math.min(LEG_MAX_BLEND, 0.1 + score / 22);
      const ref = sample ?? target;
      const a = cur.a * (1 - blend) + ref.a * blend;
      const b = cur.b * (1 - blend) + ref.b * blend;
      writeLabPixel(out.data, p, cur.L, a, b);
      touched++;
    }
  }

  return {
    image: out,
    contamMask,
    stats: {
      zonePixels: countMaskOn(legZone),
      pixelsTouched: touched,
      pixelsContaminated: contaminated,
      meanContamScore: contaminated > 0 ? sumScore / contaminated : 0,
    },
  };
}

function countOutsideZoneChanges(
  before: RgbaImage,
  after: RgbaImage,
  allowed: Mask,
  alpha: Mask,
): number {
  let n = 0;
  const { channels } = before;
  for (let j = 0; j < before.data.length; j += channels) {
    const i = j / channels;
    if (alpha.data[i] < 128) continue;
    if (allowed.data[i] >= 128) continue;
    const dr = Math.abs(before.data[j] - after.data[j]);
    const dg = Math.abs(before.data[j + 1] - after.data[j + 1]);
    const db = Math.abs(before.data[j + 2] - after.data[j + 2]);
    if (dr + dg + db > 4) n++;
  }
  return n;
}

async function writeRgbPng(path: string, width: number, height: number, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

function buildDebugOverlay(
  image: RgbaImage,
  zoneMask: Mask,
  tint: [number, number, number],
): Buffer {
  const { width, height, channels } = image;
  const buf = Buffer.alloc(width * height * 3);
  for (let j = 0; j < width * height; j++) {
    const p = j * channels;
    const o = j * 3;
    let r = image.data[p];
    let g = image.data[p + 1];
    let b = image.data[p + 2];
    if (zoneMask.data[j] >= 128) {
      r = Math.round(r * 0.55 + tint[0] * 0.45);
      g = Math.round(g * 0.55 + tint[1] * 0.45);
      b = Math.round(b * 0.55 + tint[2] * 0.45);
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  return buf;
}

function maskFromWeights(weights: Float32Array, threshold: number, w: number, h: number): Mask {
  const m = emptyMask(w, h);
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] >= threshold) m.data[i] = 255;
  }
  return m;
}

export async function runPreviewCleanupV2(profile: SwatchProfile): Promise<CleanupV2Result> {
  const inputPath = bestPreviewPath(profile.code);
  const source = await loadRgba(inputPath);
  const original = cloneImage(source);
  const { alpha, upholstery, legs } = await loadPhase1Masks(source);

  const coverage = buildStage4bCoverageMasks(alpha, upholstery, legs);
  const { mask: lower12 } = buildLower12Region(alpha, legs);
  const frontRail = buildFrontRailRegion(alpha, legs);
  const seamBand = buildBottomCleanupBandFromImage(
    source,
    alpha,
    upholstery,
    legs,
    lower12,
    coverage,
  );
  const { weights: bottomWeights, mask: bottomMask } = buildBottomDarkLineWeights(
    source,
    frontRail,
    seamBand,
  );
  const bottomMaskPx = countMaskOn(bottomMask);
  const bottomWeightPx = countWeightsAbove(bottomWeights, 0.03);
  const target = targetLabTriplet(profile.targetLab);

  const legZone = buildLegCleanupZone(coverage);
  // v2.2: passes disabled until detection is validated — prior v2 had a LAB typo causing black pixels.
  const legPass = applyLegContaminationCleanup(source, upholstery, legs, legZone, target);
  const bottomPass = applyBottomLineCleanup(source, bottomWeights, alpha, legs, target);
  const enableLegPass = false;
  const enableBottomPass = false;
  let cleaned = source;
  if (enableLegPass) cleaned = legPass.image;
  if (enableBottomPass) cleaned = bottomPass.image;
  enforceLegExclusion(cleaned, original, legs);

  const { width, height, channels } = cleaned;
  for (let j = 0; j < width * height; j++) {
    if (alpha.data[j] >= 128) continue;
    const p = j * channels;
    cleaned.data[p] = original.data[p];
    cleaned.data[p + 1] = original.data[p + 1];
    cleaned.data[p + 2] = original.data[p + 2];
  }

  const bottomAllowed = dilate(maskFromWeights(bottomWeights, 0.06, width, height), 3);
  const allowed = intersect(
    unionMasks(bottomAllowed, bottomMask, legZone, legPass.contamMask, dilate(legPass.contamMask, 2)),
    alpha,
  );
  const feetChanged = countMaskDiff(original, cleaned, legs);
  let backgroundChanged = 0;
  for (let j = 0; j < width * height; j++) {
    if (alpha.data[j] >= 128) continue;
    const p = j * channels;
    if (
      Math.abs(original.data[p] - cleaned.data[p]) > 2 ||
      Math.abs(original.data[p + 1] - cleaned.data[p + 1]) > 2 ||
      Math.abs(original.data[p + 2] - cleaned.data[p + 2]) > 2
    ) {
      backgroundChanged++;
    }
  }
  const outsideZones = countOutsideZoneChanges(original, cleaned, allowed, alpha);

  const masterPath = cleanupV2MasterPath(profile.code);
  const comparisonPath = cleanupV2ComparisonPath(profile.code);
  const debugBottomPath = cleanupDebugBottomLinesPath(profile.code);
  const debugLegPath = cleanupDebugLegZonesPath(profile.code);
  const specPath = cleanupSpecV2Path(profile.code);

  mkdirSync(dirname(masterPath), { recursive: true });
  await sharp(cleaned.data, { raw: { width, height, channels } }).png().toFile(masterPath);

  await writeTwoPanelComparison(comparisonPath, inputPath, masterPath, 'CURRENT PREVIEW', 'CLEANUP V2');

  const bottomDebugMask = maskFromWeights(bottomWeights, 0.08, width, height);
  await writeRgbPng(
    debugBottomPath,
    width,
    height,
    buildDebugOverlay(original, bottomDebugMask, [255, 60, 200]),
  );
  await writeRgbPng(
    debugLegPath,
    width,
    height,
    buildDebugOverlay(original, intersect(unionMasks(legZone, legPass.contamMask), alpha), [40, 180, 255]),
  );

  const spec: CleanupV2Spec = {
    swatchCode: profile.code,
    inputMaster: inputPath,
    outputMaster: masterPath,
    pass: 'preview-cleanup-v2.2',
    bottomLine: {
      ...bottomPass.stats,
      frontRailPixels: countMaskOn(frontRail),
      seamBandPixels: countMaskOn(seamBand),
      detectionMaskPixels: bottomMaskPx,
      detectionWeightPixels: bottomWeightPx,
    },
    legZone: legPass.stats,
    integrity: {
      feetPixelsChanged: feetChanged,
      backgroundPixelsChanged: backgroundChanged,
      pixelsChangedOutsideZones: outsideZones,
    },
  };
  writeFileSync(specPath, JSON.stringify(spec, null, 2));

  return {
    masterPath,
    comparisonPath,
    debugBottomPath,
    debugLegPath,
    specPath,
    spec,
  };
}

function unionMasks(...masks: Mask[]): Mask {
  const base = masks[0];
  const out = new Uint8Array(base.data.length);
  for (let i = 0; i < out.length; i++) {
    for (const m of masks) {
      if (m.data[i] >= 128) {
        out[i] = 255;
        break;
      }
    }
  }
  return { ...base, data: out };
}

function countMaskOn(m: Mask): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) if (m.data[i] >= 128) n++;
  return n;
}

function countWeightsAbove(w: Float32Array, t: number): number {
  let n = 0;
  for (let i = 0; i < w.length; i++) if (w[i] >= t) n++;
  return n;
}

function countMaskDiff(a: RgbaImage, b: RgbaImage, mask: Mask): number {
  let n = 0;
  const { channels } = a;
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128) continue;
    const p = j * channels;
    if (
      Math.abs(a.data[p] - b.data[p]) > 1 ||
      Math.abs(a.data[p + 1] - b.data[p + 1]) > 1 ||
      Math.abs(a.data[p + 2] - b.data[p + 2]) > 1
    ) {
      n++;
    }
  }
  return n;
}
