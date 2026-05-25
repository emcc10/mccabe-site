import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import type { Mask } from '../phase1/masks.js';
import { bbox, dilate, erode, intersect, subtract, union } from '../phase1/masks.js';
import { DEBUG_DIR } from '../phase1/paths.js';
import type { RgbaImage } from '../phase1/segment.js';
import { buildPhase6aBase } from '../phase6a/run.js';
import { boxBlur, clamp, labToRgb, meanUpholsteryLab, rgbToLab } from '../phase5/labUtil.js';
import { buildSourceStructureGates } from '../phase9/sourceStructure.js';
import { compareUpholsteryImages } from '../phase95/imageCompare.js';
import { loadImageRGBA } from '../recolor/imageIO.js';

const REALLEATHER2_B_PATH = join(DEBUG_DIR, 'phaseRealLeather2-variant-B.png');
const REALLEATHER_REF_B_PATH = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch-variant-B.png');
const REALLEATHER_REF2_B_PATH = join(DEBUG_DIR, 'phaseRealLeatherReferenceMatch2-variant-B.png');

export const PHASE_REALLEATHER_FINAL_COMPARE_GRID = join(DEBUG_DIR, 'phaseRealLeatherFinal-compare-grid.png');
export const PHASE_REALLEATHER_FINAL_SPEC = join(DEBUG_DIR, 'phaseRealLeatherFinal-spec.json');

export function phaseRealLeatherFinalVariantPath(id: string) {
  return join(DEBUG_DIR, `phaseRealLeatherFinal-variant-${id}.png`);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian1d(x: number, center: number, sigma: number): number {
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

function buildBottomGuard(upholstery: Mask, lower12: Mask): Mask {
  const bb = bbox(upholstery);
  if (!bb) {
    return {
      data: new Uint8Array(upholstery.width * upholstery.height),
      width: upholstery.width,
      height: upholstery.height,
    };
  }
  const bottom = {
    data: new Uint8Array(upholstery.width * upholstery.height),
    width: upholstery.width,
    height: upholstery.height,
  };
  const yStart = bb.minY + Math.floor((bb.maxY - bb.minY + 1) * 0.84);
  for (let y = yStart; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * upholstery.width + x;
      if (upholstery.data[j] >= 128) bottom.data[j] = 255;
    }
  }
  return union(intersect(dilate(lower12, 6), upholstery), bottom);
}

function buildUpperBackPolishMask(
  source: RgbaImage,
  ref2B: RgbaImage,
  upholstery: Mask,
  lower12: Mask,
): { mask: Float32Array; bottomGuard: Mask } {
  const { width, height } = source;
  const n = width * height;
  const mask = new Float32Array(n);
  const bottomGuard = buildBottomGuard(upholstery, lower12);
  const bb = bbox(upholstery);
  if (!bb) return { mask, bottomGuard };

  const spanX = Math.max(bb.maxX - bb.minX, 1);
  const spanY = Math.max(bb.maxY - bb.minY, 1);
  const gates = buildSourceStructureGates(source, upholstery);
  const seamWide = boxBlur(gates.seamEdge, width, height, 10);
  const highlightWide = boxBlur(gates.highlight, width, height, 12);

  const edgeMask = subtract(upholstery, erode(upholstery, 4));
  const edgeField = new Float32Array(n);
  for (let j = 0; j < n; j++) edgeField[j] = edgeMask.data[j] >= 128 ? 1 : 0;
  const edgeBlur = boxBlur(edgeField, width, height, 5);

  const ref2L = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * ref2B.channels;
    ref2L[j] = rgbToLab(ref2B.data[p], ref2B.data[p + 1], ref2B.data[p + 2]).L;
  }

  for (let y = bb.minY; y <= bb.maxY; y++) {
    for (let x = bb.minX; x <= bb.maxX; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128 || bottomGuard.data[j] >= 128) continue;

      const xNorm = (x - bb.minX) / spanX;
      const yNorm = (y - bb.minY) / spanY;
      const inBack = yNorm < 0.5 && xNorm > 0.14 && xNorm < 0.86;
      if (!inBack) continue;

      const backCenters =
        gaussian1d(xNorm, 0.2, 0.09) + gaussian1d(xNorm, 0.5, 0.09) + gaussian1d(xNorm, 0.8, 0.09);
      const upperBand = smoothstep(0.1, 0.18, yNorm) * (1 - smoothstep(0.38, 0.5, yNorm));
      const midtoneBand = smoothstep(61, 67, ref2L[j]) * (1 - smoothstep(85, 89, ref2L[j]));
      const seamSuppress = 1 - seamWide[j] * 0.995;
      const edgeSuppress = 1 - edgeBlur[j] * 0.995;
      const highlightSuppress = 1 - highlightWide[j] * 0.38;

      mask[j] = clamp(backCenters * upperBand * midtoneBand * seamSuppress * edgeSuppress * highlightSuppress, 0, 1);
    }
  }

  const blurred = boxBlur(mask, width, height, 5);
  for (let i = 0; i < n; i++) mask[i] = clamp(blurred[i], 0, 1);
  return { mask, bottomGuard };
}

function applyFinalPolish(ref2B: RgbaImage, polishMask: Float32Array): RgbaImage {
  const { width, height, channels } = ref2B;
  const n = width * height;
  const out = Buffer.from(ref2B.data);

  const L = new Float32Array(n);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const p = j * channels;
    const lab = rgbToLab(ref2B.data[p], ref2B.data[p + 1], ref2B.data[p + 2]);
    L[j] = lab.L;
    a[j] = lab.a;
    b[j] = lab.b;
  }

  const blurL = boxBlur(L, width, height, 2);
  for (let j = 0; j < n; j++) {
    const amount = 0.22 * polishMask[j];
    if (amount <= 0) continue;
    const residual = L[j] - blurL[j];
    const newL = blurL[j] + residual * (1 - amount);
    const rgb = labToRgb(newL, a[j], b[j]);
    const p = j * channels;
    out[p] = rgb.r;
    out[p + 1] = rgb.g;
    out[p + 2] = rgb.b;
    if (channels === 4) out[p + 3] = ref2B.data[p + 3];
  }

  return { data: out, width, height, channels };
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

async function panelWithLabel(imagePath: string, label: string): Promise<Buffer> {
  const labelHeight = 44;
  const meta = await sharp(imagePath).metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  const img = await sharp(imagePath).png().toBuffer();
  const labelSvg = Buffer.from(
    `<svg width="${width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#fff">${label}</text>
    </svg>`,
  );
  return sharp({
    create: { width, height: height + labelHeight, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: labelSvg, top: height, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function writeCompareGrid(outPath: string, panels: { path: string; label: string }[]) {
  const labeled = await Promise.all(panels.map((panel) => panelWithLabel(panel.path, panel.label)));
  const metas = await Promise.all(labeled.map((buf) => sharp(buf).metadata()));
  const cellW = Math.max(...metas.map((meta) => meta.width ?? 0));
  const cellH = Math.max(...metas.map((meta) => meta.height ?? 0));
  const resized = await Promise.all(
    labeled.map((buf) => sharp(buf).resize(cellW, cellH, { fit: 'contain', background: '#ffffff' }).png().toBuffer()),
  );
  await sharp({
    create: { width: cellW * panels.length, height: cellH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(resized.map((input, i) => ({ input, left: i * cellW, top: 0 })))
    .png()
    .toFile(outPath);
}

export async function runPhaseRealLeatherFinal() {
  const { source, image: base6a, upholstery, lower12 } = await buildPhase6aBase();
  const realLeather2B = await loadImageRGBA(REALLEATHER2_B_PATH);
  const refB = await loadImageRGBA(REALLEATHER_REF_B_PATH);
  const ref2B = await loadImageRGBA(REALLEATHER_REF2_B_PATH);
  const { mask: polishMask } = buildUpperBackPolishMask(source, ref2B, upholstery, lower12);

  const finalAPath = phaseRealLeatherFinalVariantPath('A');
  const finalBPath = phaseRealLeatherFinalVariantPath('B');
  await writeRgbaPng(finalAPath, ref2B);

  const finalB = applyFinalPolish(ref2B, polishMask);
  await writeRgbaPng(finalBPath, finalB);

  const base6aTmp = join(DEBUG_DIR, '_phaseRealLeatherFinal-base6a.png');
  await writeRgbaPng(base6aTmp, base6a);

  await writeCompareGrid(PHASE_REALLEATHER_FINAL_COMPARE_GRID, [
    { path: base6aTmp, label: '6A' },
    { path: REALLEATHER2_B_PATH, label: 'REALLEATHER2-B' },
    { path: REALLEATHER_REF_B_PATH, label: 'REALLEATHER-REF-B' },
    { path: REALLEATHER_REF2_B_PATH, label: 'REALLEATHER-REF2-B' },
    { path: finalBPath, label: 'REALLEATHER-FINAL-B' },
  ]);

  const spec = {
    phase: 'RealLeather Final Polish',
    purpose: 'Export REF2-B unchanged plus one selectively smoothed upper-back-cushion variant',
    base: 'REALLEATHER-REF2-B',
    preservesExactly: ['arms', 'seams', 'cushion breaks', 'lower rail', 'global tone intent'],
    outputs: {
      finalA: finalAPath,
      finalB: finalBPath,
      compareGrid: PHASE_REALLEATHER_FINAL_COMPARE_GRID,
      spec: PHASE_REALLEATHER_FINAL_SPEC,
    },
    finalA: {
      exactCopyOf: REALLEATHER_REF2_B_PATH,
      vsRef2B: compareUpholsteryImages(ref2B, ref2B, upholstery).stats,
      meanLab: meanUpholsteryLab(ref2B, upholstery),
    },
    finalB: {
      smoothingMethod: 'Reduce fine L residual by 22% inside upper back cushion open fields only',
      vsRef2B: compareUpholsteryImages(ref2B, finalB, upholstery).stats,
      vsRealLeather2B: compareUpholsteryImages(realLeather2B, finalB, upholstery).stats,
      meanLab: meanUpholsteryLab(finalB, upholstery),
    },
  };

  writeFileSync(PHASE_REALLEATHER_FINAL_SPEC, JSON.stringify(spec, null, 2));
  return { compareGrid: PHASE_REALLEATHER_FINAL_COMPARE_GRID, spec: PHASE_REALLEATHER_FINAL_SPEC, finalAPath, finalBPath };
}
