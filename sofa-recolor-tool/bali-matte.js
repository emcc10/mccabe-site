/**
 * Bali matte: source mask is the ONLY silhouette truth. Supersample AA at edges only.
 * No derived feather, blur, snap, or sharpen on contour.
 */
const MASK_APPLY_THRESH = 128;
export const EXPORT_BG = { r: 255, g: 255, b: 255 };

export const SUPERSAMPLE_SCALE = 4;
export const RIGHT_SIDE_WIDTH_FRAC = 0.25;
export const RIGHT_LEG_OVERRIDE_WIDTH_FRAC = 0.18;
export const RIGHT_LEG_OVERRIDE_HEIGHT_FRAC = 0.22;
export const DECONTAM_ALPHA_LO = 0.02;
export const DECONTAM_ALPHA_HI = 0.98;
export const DECONTAM_MIN_INWARD_PX = 3;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

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

function isMaskInside(mask, j) {
  return mask[j] >= MASK_APPLY_THRESH;
}

/** Inward distance from source silhouette (edge pixels = 0). */
export function buildInwardDistance(mask, width, height) {
  const n = width * height;
  const dist = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (!isMaskInside(mask, j)) {
      dist[j] = 0;
      continue;
    }
    const x = j % width;
    const y = (j / width) | 0;
    let onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (!onEdge) {
      for (const k of [j - 1, j + 1, j - width, j + width]) {
        if (!isMaskInside(mask, k)) onEdge = true;
      }
    }
    dist[j] = onEdge ? 0 : 1e6;
  }
  for (let pass = 0; pass < width + height; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const j = y * width + x;
        if (!isMaskInside(mask, j) || dist[j] === 0) continue;
        let best = dist[j];
        if (x > 0 && isMaskInside(mask, j - 1)) best = Math.min(best, dist[j - 1] + 1);
        if (x < width - 1 && isMaskInside(mask, j + 1)) best = Math.min(best, dist[j + 1] + 1);
        if (y > 0 && isMaskInside(mask, j - width)) best = Math.min(best, dist[j - width] + 1);
        if (y < height - 1 && isMaskInside(mask, j + width)) {
          best = Math.min(best, dist[j + width] + 1);
        }
        dist[j] = best;
      }
    }
  }
  return dist;
}

/** Rightmost 25% of sofa bbox — contour from source mask only. */
export function buildRightSideRegionMask(mask, width, height) {
  const bb = maskBoundingBox(mask, width, height);
  const region = new Uint8Array(width * height);
  if (bb.maxX < bb.minX) return region;
  const xCut = bb.minX + Math.floor((bb.maxX - bb.minX + 1) * (1 - RIGHT_SIDE_WIDTH_FRAC));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (isMaskInside(mask, j) && x >= xCut) region[j] = 255;
    }
  }
  return region;
}

/** Right 18% × bottom 22% — exact source matte geometry, no derived feather. */
export function buildRightLegOverrideMask(mask, width, height) {
  const bb = maskBoundingBox(mask, width, height);
  const patch = new Uint8Array(width * height);
  if (bb.maxX < bb.minX) return patch;
  const xCut = bb.minX + Math.floor((bb.maxX - bb.minX + 1) * (1 - RIGHT_LEG_OVERRIDE_WIDTH_FRAC));
  const yCut = bb.minY + Math.floor((bb.maxY - bb.minY + 1) * (1 - RIGHT_LEG_OVERRIDE_HEIGHT_FRAC));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (isMaskInside(mask, j) && x >= xCut && y >= yCut) patch[j] = 255;
    }
  }
  return patch;
}

/** @deprecated alias */
export function buildRightLegPatchMask(mask, width, height) {
  return buildRightLegOverrideMask(mask, width, height);
}

function supersampleEdgeCoverage(mask, x, y, width, height, ss) {
  let inside = 0;
  for (let sy = 0; sy < ss; sy++) {
    for (let sx = 0; sx < ss; sx++) {
      const px = clamp(Math.floor(x + (sx + 0.5) / ss), 0, width - 1);
      const py = clamp(Math.floor(y + (sy + 0.5) / ss), 0, height - 1);
      if (isMaskInside(mask, py * width + px)) inside++;
    }
  }
  return inside / (ss * ss);
}

/**
 * Final silhouette alpha from ORIGINAL source mask only.
 * Interior = 1; exterior = 0; boundary ring = supersample coverage (no blur feather).
 */
export function buildMasterSilhouetteAlpha(mask, width, height, rightLegOverrideMask) {
  const n = width * height;
  const distIn = buildInwardDistance(mask, width, height);
  const alpha = new Float32Array(n);
  const ss = SUPERSAMPLE_SCALE;

  for (let j = 0; j < n; j++) {
    if (!isMaskInside(mask, j)) {
      alpha[j] = 0;
      continue;
    }
    const x = j % width;
    const y = (j / width) | 0;
    const inOverride = rightLegOverrideMask[j] > 0;

    if (distIn[j] >= 1) {
      alpha[j] = 1;
      continue;
    }

    if (distIn[j] === 0) {
      const cov = supersampleEdgeCoverage(mask, x, y, width, height, ss);
      alpha[j] = inOverride ? cov : cov;
    } else {
      alpha[j] = 1;
    }
  }

  return { alpha, distIn };
}

function bestInwardNeighbor(distIn, mask, j, width, height) {
  const x = j % width;
  const y = (j / width) | 0;
  let best = j;
  let bestD = distIn[j];
  const candidates = [];
  if (x > 0 && isMaskInside(mask, j - 1)) candidates.push(j - 1);
  if (x < width - 1 && isMaskInside(mask, j + 1)) candidates.push(j + 1);
  if (y > 0 && isMaskInside(mask, j - width)) candidates.push(j - width);
  if (y < height - 1 && isMaskInside(mask, j + width)) candidates.push(j + width);
  for (const k of candidates) {
    if (distIn[k] > bestD) {
      bestD = distIn[k];
      best = k;
    }
  }
  return best;
}

/**
 * Replace gray-fringe RGB with interior foreground sampled 2–5 px inward.
 * Contour band only — does not alter upholstery RGB inland.
 */
export function decontaminateEdgeForeground(
  out,
  mask,
  contourAlpha,
  distIn,
  width,
  height,
  channels,
) {
  for (let j = 0; j < width * height; j++) {
    if (!isMaskInside(mask, j)) continue;
    const a = contourAlpha[j];
    if (a <= DECONTAM_ALPHA_LO || a >= DECONTAM_ALPHA_HI) continue;

    let cur = j;
    for (let step = 0; step < 32; step++) {
      if (distIn[cur] >= DECONTAM_MIN_INWARD_PX) break;
      const next = bestInwardNeighbor(distIn, mask, cur, width, height);
      if (next === cur || distIn[next] <= distIn[cur]) break;
      cur = next;
    }

    if (distIn[cur] < 2) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let n = 0;
      const x = j % width;
      const y = (j / width) | 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const k = (y + dy) * width + (x + dx);
          if (!isMaskInside(mask, k) || distIn[k] < DECONTAM_MIN_INWARD_PX) continue;
          const p = k * channels;
          sumR += out[p];
          sumG += out[p + 1];
          sumB += out[p + 2];
          n++;
        }
      }
      if (n > 0) {
        cur = j;
        const p = j * channels;
        out[p] = Math.round(sumR / n);
        out[p + 1] = Math.round(sumG / n);
        out[p + 2] = Math.round(sumB / n);
        continue;
      }
    }

    const p = j * channels;
    const ip = cur * channels;
    out[p] = out[ip];
    out[p + 1] = out[ip + 1];
    out[p + 2] = out[ip + 2];
  }
}

/** Composite recolored sofa over white using source-derived alpha only. */
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
    const p = j * channels;
    const a = clamp(contourAlpha[j], 0, 1);
    if (!isMaskInside(mask, j)) {
      out[p] = bg.r;
      out[p + 1] = bg.g;
      out[p + 2] = bg.b;
      continue;
    }
    if (a >= 0.999) continue;
    out[p] = clamp(Math.round(out[p] * a + bg.r * (1 - a)), 0, 255);
    out[p + 1] = clamp(Math.round(out[p + 1] * a + bg.g * (1 - a)), 0, 255);
    out[p + 2] = clamp(Math.round(out[p + 2] * a + bg.b * (1 - a)), 0, 255);
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

function bufferFromSourceMask(mask, width, height, channels) {
  const buf = Buffer.alloc(width * height * channels);
  for (let j = 0; j < width * height; j++) {
    fillVizGray(buf, j, channels, isMaskInside(mask, j) ? 255 : 0);
  }
  return buf;
}

/**
 * Source-mask silhouette pipeline (after upholstery recolor, before finalize).
 */
export function applyBaliMattePipeline(out, sourceMask, width, height, channels) {
  const rightLegOverrideMask = buildRightLegOverrideMask(sourceMask, width, height);
  const rightSideRegionMask = buildRightSideRegionMask(sourceMask, width, height);
  const { alpha: contourAlpha, distIn } = buildMasterSilhouetteAlpha(
    sourceMask,
    width,
    height,
    rightLegOverrideMask,
  );

  const decontamBand = new Float32Array(width * height);
  for (let j = 0; j < width * height; j++) {
    const a = contourAlpha[j];
    if (isMaskInside(sourceMask, j) && a > DECONTAM_ALPHA_LO && a < DECONTAM_ALPHA_HI) {
      decontamBand[j] = 1;
    }
  }

  decontaminateEdgeForeground(out, sourceMask, contourAlpha, distIn, width, height, channels);
  compositeMatteOverBackground(out, sourceMask, contourAlpha, width, height, channels);

  const sourceMatteViz = bufferFromSourceMask(sourceMask, width, height, channels);
  const finalMatteViz = bufferFromFloatField(contourAlpha, width, height, channels);
  const decontamViz = bufferFromFloatField(decontamBand, width, height, channels);

  const overrideViz = Buffer.alloc(width * height * channels);
  for (let j = 0; j < width * height; j++) {
    fillVizGray(overrideViz, j, channels, rightLegOverrideMask[j] > 0 ? 255 : 0);
  }

  return {
    contourAlpha,
    distIn,
    rightLegPatchMask: rightLegOverrideMask,
    rightLegOverrideMask,
    rightSideRegionMask,
    sourceMatteViz,
    finalMatteViz,
    decontamViz,
    overrideViz,
    alphaBeforeViz: finalMatteViz,
    alphaAfterViz: finalMatteViz,
  };
}

export function getBaliMatteParams() {
  return {
    silhouetteSource: 'input/mask.png (original source matte only)',
    supersample: `×${SUPERSAMPLE_SCALE} edge coverage`,
    maxAaWidth: '≤0.5px (boundary ring only)',
    decontam: `alpha ${DECONTAM_ALPHA_LO}–${DECONTAM_ALPHA_HI}, inward ≥${DECONTAM_MIN_INWARD_PX}px`,
    rightSideRegion: `${RIGHT_SIDE_WIDTH_FRAC * 100}% width (source matte)`,
    rightLegOverride: `${RIGHT_LEG_OVERRIDE_WIDTH_FRAC * 100}% right × ${RIGHT_LEG_OVERRIDE_HEIGHT_FRAC * 100}% bottom`,
    noFeatherBlur: true,
    noSnapSharpen: true,
  };
}
