/**
 * Bali matte / composite: dual contour feather, right-leg patch, decontamination.
 */
const MASK_APPLY_THRESH = 128;
export const EXPORT_BG = { r: 255, g: 255, b: 255 };

export const GLOBAL_HARD_MATTE_AA = 0.35;
export const GLOBAL_SOFT_FEATHER = 0.65;
export const RIGHT_LEG_HARD_MATTE_AA = 0.25;
export const RIGHT_LEG_SOFT_FEATHER = 0.35;
export const RIGHT_LEG_SNAP_HI = 0.6;
export const RIGHT_LEG_SNAP_LO = 0.08;
export const RIGHT_LEG_SHARPEN_RADIUS = 0.55;
export const RIGHT_LEG_SHARPEN_AMOUNT = 0.32;
export const RIGHT_LEG_WIDTH_FRAC = 0.22;
export const RIGHT_LEG_HEIGHT_FRAC = 0.28;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rec709Lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Inward distance from silhouette (edge = 0). */
export function buildInwardDistance(mask, width, height) {
  const n = width * height;
  const dist = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      dist[j] = 0;
      continue;
    }
    const x = j % width;
    const y = (j / width) | 0;
    let onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (!onEdge) {
      for (const k of [j - 1, j + 1, j - width, j + width]) {
        if (mask[k] < MASK_APPLY_THRESH) onEdge = true;
      }
    }
    dist[j] = onEdge ? 0 : 1e6;
  }
  for (let pass = 0; pass < width + height; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const j = y * width + x;
        if (mask[j] < MASK_APPLY_THRESH || dist[j] === 0) continue;
        let best = dist[j];
        if (x > 0 && mask[j - 1] >= MASK_APPLY_THRESH) best = Math.min(best, dist[j - 1] + 1);
        if (x < width - 1 && mask[j + 1] >= MASK_APPLY_THRESH) best = Math.min(best, dist[j + 1] + 1);
        if (y > 0 && mask[j - width] >= MASK_APPLY_THRESH) best = Math.min(best, dist[j - width] + 1);
        if (y < height - 1 && mask[j + width] >= MASK_APPLY_THRESH) {
          best = Math.min(best, dist[j + width] + 1);
        }
        dist[j] = best;
      }
    }
  }
  return dist;
}

/** Sofa bbox for patch placement. */
function maskBoundingBox(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] < MASK_APPLY_THRESH) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Rightmost 22% × bottom 28% of sofa mask bbox (intersected with mask).
 */
export function buildRightLegPatchMask(mask, width, height) {
  const bb = maskBoundingBox(mask, width, height);
  const patch = new Uint8Array(width * height);
  if (bb.maxX < bb.minX) return patch;
  const xCut = bb.minX + Math.floor((bb.maxX - bb.minX + 1) * (1 - RIGHT_LEG_WIDTH_FRAC));
  const yCut = bb.minY + Math.floor((bb.maxY - bb.minY + 1) * (1 - RIGHT_LEG_HEIGHT_FRAC));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] >= MASK_APPLY_THRESH && x >= xCut && y >= yCut) patch[j] = 255;
    }
  }
  return patch;
}

/** Linear matte: hard AA + soft feather spans. */
export function buildMatteAlphaFromDist(distIn, hardAaPx, softFeatherPx) {
  const total = hardAaPx + softFeatherPx;
  if (total <= 0) return 1;
  if (distIn >= total) return 1;
  return clamp(distIn / total, 0, 1);
}

export function buildMatteComponents(distIn, hardAaPx, softFeatherPx) {
  const total = hardAaPx + softFeatherPx;
  if (total <= 0) return { hard: 1, soft: 1, combined: 1 };
  if (distIn >= total) return { hard: 1, soft: 1, combined: 1 };
  const combined = clamp(distIn / total, 0, 1);
  const hardEnd = hardAaPx;
  const hard = hardEnd <= 0 ? 1 : clamp(distIn / hardEnd, 0, 1);
  const soft =
    distIn <= hardEnd ? 0 : clamp((distIn - hardEnd) / Math.max(softFeatherPx, 1e-6), 0, 1);
  return { hard, soft, combined };
}

/**
 * Global + right-leg patch contour alphas.
 */
export function buildDualContourAlpha(mask, width, height, rightLegPatchMask) {
  const n = width * height;
  const distIn = buildInwardDistance(mask, width, height);
  const contourAlpha = new Float32Array(n);
  const hardMatteViz = new Float32Array(n);
  const softMatteViz = new Float32Array(n);

  for (let j = 0; j < n; j++) {
    if (mask[j] < MASK_APPLY_THRESH) {
      contourAlpha[j] = 0;
      hardMatteViz[j] = 0;
      softMatteViz[j] = 0;
      continue;
    }
    const inPatch = rightLegPatchMask[j] > 0;
    const hard = inPatch ? RIGHT_LEG_HARD_MATTE_AA : GLOBAL_HARD_MATTE_AA;
    const soft = inPatch ? RIGHT_LEG_SOFT_FEATHER : GLOBAL_SOFT_FEATHER;
    const parts = buildMatteComponents(distIn[j], hard, soft);
    contourAlpha[j] = parts.combined;
    hardMatteViz[j] = parts.hard;
    softMatteViz[j] = parts.soft;
  }
  return { contourAlpha, distIn, hardMatteViz, softMatteViz };
}

export function snapAlphaInRightLegPatch(contourAlpha, rightLegPatchMask) {
  const out = new Float32Array(contourAlpha.length);
  for (let j = 0; j < contourAlpha.length; j++) {
    let a = contourAlpha[j];
    if (rightLegPatchMask[j] > 0) {
      if (a > RIGHT_LEG_SNAP_HI) a = 1;
      else if (a < RIGHT_LEG_SNAP_LO) a = 0;
    }
    out[j] = a;
  }
  return out;
}

/** Remove 1px soft fringe islands inside right-leg patch only. */
export function cleanupFringeIslands(contourAlpha, rightLegPatchMask, mask, width, height) {
  const out = new Float32Array(contourAlpha);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      if (rightLegPatchMask[j] === 0 || mask[j] < MASK_APPLY_THRESH) continue;
      const a = out[j];
      if (a <= 0.02 || a >= 0.98) continue;
      let nLo = 0;
      let nHi = 0;
      for (const k of [j - 1, j + 1, j - width, j + width]) {
        if (rightLegPatchMask[k] === 0) continue;
        if (out[k] < 0.12) nLo++;
        if (out[k] > 0.88) nHi++;
      }
      if (nLo >= 3) out[j] = 0;
      else if (nHi >= 3) out[j] = 1;
    }
  }
  return out;
}

function bestInwardNeighbor(distIn, mask, j, width, height) {
  const x = j % width;
  const y = (j / width) | 0;
  let best = j;
  let bestD = distIn[j];
  const candidates = [];
  if (x > 0 && mask[j - 1] >= MASK_APPLY_THRESH) candidates.push(j - 1);
  if (x < width - 1 && mask[j + 1] >= MASK_APPLY_THRESH) candidates.push(j + 1);
  if (y > 0 && mask[j - width] >= MASK_APPLY_THRESH) candidates.push(j - width);
  if (y < height - 1 && mask[j + width] >= MASK_APPLY_THRESH) candidates.push(j + width);
  for (const k of candidates) {
    if (distIn[k] > bestD) {
      bestD = distIn[k];
      best = k;
    }
  }
  return best;
}

/**
 * Edge decontamination: replace gray-fringe RGB with interior sofa color (inward normal).
 * Previously missing — this is the right-leg matte fix.
 */
export function decontaminateEdgeForeground(
  out,
  mask,
  contourAlpha,
  rightLegPatchMask,
  distIn,
  width,
  height,
  channels,
) {
  const minInteriorDist = 2.5;
  for (let j = 0; j < width * height; j++) {
    if (rightLegPatchMask[j] === 0 || mask[j] < MASK_APPLY_THRESH) continue;
    const a = contourAlpha[j];
    if (a <= 0.05 || a >= 0.95) continue;
    let cur = j;
    for (let step = 0; step < 24; step++) {
      const next = bestInwardNeighbor(distIn, mask, cur, width, height);
      if (next === cur || distIn[next] <= distIn[cur]) break;
      cur = next;
      if (distIn[cur] >= minInteriorDist) break;
    }
    const p = j * channels;
    const ip = cur * channels;
    out[p] = out[ip];
    out[p + 1] = out[ip + 1];
    out[p + 2] = out[ip + 2];
  }
}

export function compositeMatteOverBackground(
  out,
  mask,
  contourAlpha,
  width,
  height,
  channels,
  bg = EXPORT_BG,
) {
  for (let j = 0; j < width * height; j++) {
    if (mask[j] < MASK_APPLY_THRESH) continue;
    const a = clamp(contourAlpha[j], 0, 1);
    if (a >= 0.999) continue;
    const p = j * channels;
    out[p] = clamp(Math.round(out[p] * a + bg.r * (1 - a)), 0, 255);
    out[p + 1] = clamp(Math.round(out[p + 1] * a + bg.g * (1 - a)), 0, 255);
    out[p + 2] = clamp(Math.round(out[p + 2] * a + bg.b * (1 - a)), 0, 255);
  }
}

function outwardNormal(mask, distIn, j, width, height) {
  const x = j % width;
  const y = (j / width) | 0;
  let nx = 0;
  let ny = 0;
  if (x > 0 && mask[j - 1] < MASK_APPLY_THRESH) nx -= 1;
  if (x < width - 1 && mask[j + 1] < MASK_APPLY_THRESH) nx += 1;
  if (y > 0 && mask[j - width] < MASK_APPLY_THRESH) ny -= 1;
  if (y < height - 1 && mask[j + width] < MASK_APPLY_THRESH) ny += 1;
  if (nx === 0 && ny === 0) {
    let best = j;
    let minD = distIn[j];
    const cands = [];
    if (x > 0 && mask[j - 1] >= MASK_APPLY_THRESH) cands.push(j - 1);
    if (x < width - 1 && mask[j + 1] >= MASK_APPLY_THRESH) cands.push(j + 1);
    if (y > 0 && mask[j - width] >= MASK_APPLY_THRESH) cands.push(j - width);
    if (y < height - 1 && mask[j + width] >= MASK_APPLY_THRESH) cands.push(j + width);
    for (const k of cands) {
      if (distIn[k] < minD) {
        minD = distIn[k];
        best = k;
      }
    }
    const bx = best % width;
    const by = (best / width) | 0;
    nx = x - bx;
    ny = y - by;
  }
  const len = Math.hypot(nx, ny) || 1;
  return { nx: nx / len, ny: ny / len };
}

function sampleBilinear(data, width, height, channels, fx, fy) {
  const x = clamp(fx, 0, width - 1);
  const y = clamp(fy, 0, height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = x - x0;
  const ty = y - y0;
  const lum = (ix, iy) => {
    const p = (iy * width + ix) * channels;
    return rec709Lum(data[p], data[p + 1], data[p + 2]);
  };
  const l00 = lum(x0, y0);
  const l10 = lum(x1, y0);
  const l01 = lum(x0, y1);
  const l11 = lum(x1, y1);
  const l0 = l00 * (1 - tx) + l10 * tx;
  const l1 = l01 * (1 - tx) + l11 * tx;
  return l0 * (1 - ty) + l1 * ty;
}

/** Directional sharpen along contour normal — right-leg patch contour band only. */
export function applyRightLegNormalSharpen(
  out,
  mask,
  contourAlpha,
  rightLegPatchMask,
  distIn,
  width,
  height,
  channels,
) {
  const featherTotal = RIGHT_LEG_HARD_MATTE_AA + RIGHT_LEG_SOFT_FEATHER;
  const step = 1.2;
  const amount = RIGHT_LEG_SHARPEN_AMOUNT;
  const Y = new Float32Array(width * height);
  const band = new Uint8Array(width * height);

  for (let j = 0; j < width * height; j++) {
    if (rightLegPatchMask[j] === 0 || mask[j] < MASK_APPLY_THRESH) continue;
    const a = contourAlpha[j];
    if (a <= 0.02 || a >= 0.99) continue;
    if (distIn[j] > featherTotal + 0.5) continue;
    band[j] = 1;
    const p = j * channels;
    Y[j] = rec709Lum(out[p], out[p + 1], out[p + 2]);
  }

  for (let j = 0; j < width * height; j++) {
    if (!band[j]) continue;
    const x = j % width;
    const y = (j / width) | 0;
    const { nx, ny } = outwardNormal(mask, distIn, j, width, height);
    const lumC = Y[j];
    const lumOut = sampleBilinear(out, width, height, channels, x + nx * step, y + ny * step);
    const lumIn = sampleBilinear(out, width, height, channels, x - nx * step, y - ny * step);
    const blur1d = (lumOut + lumIn) * 0.5;
    const sharpY = lumC + (lumC - blur1d) * amount;
    const scale = lumC > 0.5 ? sharpY / lumC : 1;
    const p = j * channels;
    out[p] = clamp(Math.round(out[p] * scale), 0, 255);
    out[p + 1] = clamp(Math.round(out[p + 1] * scale), 0, 255);
    out[p + 2] = clamp(Math.round(out[p + 2] * scale), 0, 255);
  }
}

function fillVizGray(buf, j, channels, value) {
  const p = j * channels;
  const v = clamp(Math.round(value), 0, 255);
  buf[p] = v;
  buf[p + 1] = v;
  buf[p + 2] = v;
  if (channels === 4) buf[p + 3] = 255;
}

function bufferFromFloatField(field, width, height, channels, scale = 255) {
  const buf = Buffer.alloc(width * height * channels);
  for (let j = 0; j < width * height; j++) {
    fillVizGray(buf, j, channels, field[j] * scale);
  }
  return buf;
}

/**
 * Full matte pipeline (after upholstery recolor, before finalize).
 */
export function applyBaliMattePipeline(out, mask, width, height, channels) {
  const rightLegPatchMask = buildRightLegPatchMask(mask, width, height);
  const { contourAlpha: alphaBeforeSnap, distIn, hardMatteViz, softMatteViz } =
    buildDualContourAlpha(mask, width, height, rightLegPatchMask);

  decontaminateEdgeForeground(
    out,
    mask,
    alphaBeforeSnap,
    rightLegPatchMask,
    distIn,
    width,
    height,
    channels,
  );

  let alpha = cleanupFringeIslands(alphaBeforeSnap, rightLegPatchMask, mask, width, height);
  alpha = snapAlphaInRightLegPatch(alpha, rightLegPatchMask);
  compositeMatteOverBackground(out, mask, alpha, width, height, channels);

  const patchViz = Buffer.alloc(width * height * channels);
  const alphaBeforeViz = bufferFromFloatField(alphaBeforeSnap, width, height, channels);
  const alphaAfterViz = bufferFromFloatField(alpha, width, height, channels);
  const hardViz = bufferFromFloatField(hardMatteViz, width, height, channels);
  const softViz = bufferFromFloatField(softMatteViz, width, height, channels);

  for (let j = 0; j < width * height; j++) {
    fillVizGray(patchViz, j, channels, rightLegPatchMask[j] > 0 ? 255 : 0);
  }

  return {
    contourAlpha: alpha,
    distIn,
    rightLegPatchMask,
    alphaBeforeSnap,
    patchViz,
    alphaBeforeViz,
    alphaAfterViz,
    hardMatteViz: hardViz,
    softMatteViz: softViz,
  };
}

export function getBaliMatteParams() {
  return {
    globalHardMatteAa: GLOBAL_HARD_MATTE_AA,
    globalSoftFeather: GLOBAL_SOFT_FEATHER,
    rightLegHardMatteAa: RIGHT_LEG_HARD_MATTE_AA,
    rightLegSoftFeather: RIGHT_LEG_SOFT_FEATHER,
    rightLegSnapHi: RIGHT_LEG_SNAP_HI,
    rightLegSnapLo: RIGHT_LEG_SNAP_LO,
    rightLegSharpen: `r${RIGHT_LEG_SHARPEN_RADIUS}×${RIGHT_LEG_SHARPEN_AMOUNT}`,
    rightLegPatch: `${Math.round(RIGHT_LEG_WIDTH_FRAC * 100)}% right × ${Math.round(RIGHT_LEG_HEIGHT_FRAC * 100)}% bottom`,
  };
}
