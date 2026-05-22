import type { Mask } from '../phase1/masks.js';
import { erode } from '../phase1/masks.js';
import type { RgbaImage } from '../phase1/segment.js';
import { boxBlur, buildLinearL, clamp } from '../phase5/labUtil.js';

const BLUR_FORM_PX = 22;
const BLUR_FINE_PX = 5;

export interface SourceStructureGates {
  /** 0–1: preserve seams/creases — swatch material suppressed here */
  seamEdge: Float32Array;
  /** 0–1: extreme highlight zones — reduce swatch mottle/grain */
  highlight: Float32Array;
  /** Zero-mean broad form from source L (gentle geometry anchor) */
  formLow: Float32Array;
}

export function buildSourceStructureGates(source: RgbaImage, upholstery: Mask): SourceStructureGates {
  const { width, height } = source;
  const n = width * height;
  const sourceL = buildLinearL(source);
  const blurForm = boxBlur(sourceL, width, height, BLUR_FORM_PX);
  const blurFine = boxBlur(sourceL, width, height, BLUR_FINE_PX);

  const seamEdge = new Float32Array(n);
  const highlight = new Float32Array(n);
  const formLow = new Float32Array(n);

  const interior = erode(upholstery, 3);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (upholstery.data[j] < 128) continue;

      formLow[j] = blurForm[j];

      const gradX = Math.abs(sourceL[j + 1] - sourceL[j - 1]);
      const gradY = Math.abs(sourceL[(y + 1) * width + x] - sourceL[(y - 1) * width + x]);
      const grad = gradX + gradY;
      const fine = Math.abs(sourceL[j] - blurFine[j]);
      const seamRaw = clamp((grad - 3) / 18, 0, 1) * 0.55 + clamp((fine - 1.5) / 8, 0, 1) * 0.45;
      if (interior.data[j] >= 128) seamEdge[j] = clamp(seamRaw, 0, 1);

      const bright = clamp((sourceL[j] - 72) / 22, 0, 1);
      highlight[j] = bright * bright;
    }
  }

  let formSum = 0;
  let formN = 0;
  for (let j = 0; j < n; j++) {
    if (upholstery.data[j] < 128) continue;
    formSum += formLow[j];
    formN++;
  }
  if (formN) {
    const formMean = formSum / formN;
    for (let j = 0; j < n; j++) {
      if (upholstery.data[j] < 128) continue;
      formLow[j] -= formMean;
    }
  }

  return { seamEdge, highlight, formLow };
}
