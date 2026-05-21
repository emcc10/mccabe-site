import type { MaskData } from './types.js';
import { maskBoundingBox } from './masks.js';

export type FailedMaskName = 'upholstery' | 'legs' | 'alpha' | 'trim' | 'combined';

export interface MaskValidationFailure {
  rule: string;
  mask: FailedMaskName;
  message: string;
  metric: number;
  limit: number;
}

export interface MaskValidationResult {
  passed: boolean;
  failures: MaskValidationFailure[];
}

const UPHOLSTERY_LEG_OVERLAP_MAX = 0.005;
const UPHOLSTERY_OUTSIDE_ALPHA_MAX = 0.001;
const DETACHED_COMPONENT_MIN_AREA = 800;
const DETACHED_DIST_FRAC = 0.22;
const LEG_MIN_COMPONENTS = 2;
const LEG_MIN_AREA_EACH = 120;
const RIGHT_JOIN_UPHOLSTERY_MAX = 0.02;

function countOn(mask: MaskData): number {
  let n = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i] >= 128) n++;
  return n;
}

function connectedComponents(mask: MaskData): { label: number; area: number; cx: number; cy: number }[] {
  const w = mask.width;
  const h = mask.height;
  const labels = new Int32Array(mask.data.length);
  const comps: { label: number; area: number; cx: number; cy: number }[] = [];
  let next = 1;

  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128 || labels[j] !== 0) continue;
    const stack = [j];
    labels[j] = next;
    let area = 0;
    let sx = 0;
    let sy = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      area++;
      const x = cur % w;
      const y = (cur / w) | 0;
      sx += x;
      sy += y;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx;
        if (mask.data[k] < 128 || labels[k] !== 0) continue;
        labels[k] = next;
        stack.push(k);
      }
    }
    comps.push({ label: next, area, cx: sx / area, cy: sy / area });
    next++;
  }
  return comps;
}

export function validateProductMasks(
  alpha: MaskData,
  upholstery: MaskData,
  legs: MaskData,
  trim: MaskData,
): MaskValidationResult {
  const failures: MaskValidationFailure[] = [];
  const upArea = countOn(upholstery);
  const legArea = countOn(legs);

  if (upArea === 0) {
    failures.push({
      rule: 'upholstery-nonempty',
      mask: 'upholstery',
      message: 'Upholstery mask is empty',
      metric: 0,
      limit: 1,
    });
  }

  if (legArea === 0) {
    failures.push({
      rule: 'legs-nonempty',
      mask: 'legs',
      message: 'Leg mask is empty — both feet must be captured',
      metric: 0,
      limit: 1,
    });
  }

  let overlap = 0;
  let upOutsideAlpha = 0;
  for (let i = 0; i < upholstery.data.length; i++) {
    if (upholstery.data[i] < 128) continue;
    if (legs.data[i] >= 128) overlap++;
    if (alpha.data[i] < 128) upOutsideAlpha++;
  }

  if (upArea > 0) {
    const overlapRatio = overlap / upArea;
    if (overlapRatio > UPHOLSTERY_LEG_OVERLAP_MAX) {
      failures.push({
        rule: 'upholstery-leg-overlap',
        mask: 'combined',
        message: `Upholstery overlaps leg mask (${(overlapRatio * 100).toFixed(2)}% of upholstery pixels)`,
        metric: overlapRatio,
        limit: UPHOLSTERY_LEG_OVERLAP_MAX,
      });
    }

    const outsideRatio = upOutsideAlpha / upArea;
    if (outsideRatio > UPHOLSTERY_OUTSIDE_ALPHA_MAX) {
      failures.push({
        rule: 'upholstery-inside-alpha',
        mask: 'upholstery',
        message: `Upholstery extends outside source alpha (${(outsideRatio * 100).toFixed(2)}%)`,
        metric: outsideRatio,
        limit: UPHOLSTERY_OUTSIDE_ALPHA_MAX,
      });
    }
  }

  const upComps = connectedComponents(upholstery).filter((c) => c.area >= DETACHED_COMPONENT_MIN_AREA);
  if (upComps.length > 1) {
    const main = upComps.reduce((a, b) => (a.area >= b.area ? a : b));
    const bb = maskBoundingBox(alpha);
    const span = bb ? Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) : upholstery.width;
    for (const c of upComps) {
      if (c.label === main.label) continue;
      const dist = Math.hypot(c.cx - main.cx, c.cy - main.cy) / span;
      if (dist > DETACHED_DIST_FRAC) {
        failures.push({
          rule: 'upholstery-detached-regions',
          mask: 'upholstery',
          message: `Detached upholstery region (area ${c.area}, ${(dist * 100).toFixed(0)}% span from main body)`,
          metric: dist,
          limit: DETACHED_DIST_FRAC,
        });
        break;
      }
    }
  }

  const bb = maskBoundingBox(alpha);
  if (bb && legArea > 0) {
    const legComps = connectedComponents(legs).filter((c) => c.area >= LEG_MIN_AREA_EACH);
    const yFoot = bb.minY + Math.floor((bb.maxY - bb.minY) * 0.72);
    const footComps = legComps.filter((c) => c.cy >= yFoot);
    if (footComps.length < LEG_MIN_COMPONENTS) {
      failures.push({
        rule: 'legs-both-feet',
        mask: 'legs',
        message: `Leg mask must include both feet (found ${footComps.length} foot components, need ${LEG_MIN_COMPONENTS})`,
        metric: footComps.length,
        limit: LEG_MIN_COMPONENTS,
      });
    }

    const xRight = bb.minX + Math.floor((bb.maxX - bb.minX) * 0.68);
    const yJoin = bb.minY + Math.floor((bb.maxY - bb.minY) * 0.78);
    let zone = 0;
    let upInZone = 0;
    for (let y = yJoin; y <= bb.maxY; y++) {
      for (let x = xRight; x <= bb.maxX; x++) {
        const i = y * alpha.width + x;
        if (alpha.data[i] < 128) continue;
        zone++;
        if (upholstery.data[i] >= 128) upInZone++;
      }
    }
    if (zone > 0) {
      const joinRatio = upInZone / zone;
      if (joinRatio > RIGHT_JOIN_UPHOLSTERY_MAX) {
        failures.push({
          rule: 'right-leg-join-exclusion',
          mask: 'upholstery',
          message: `Right leg join zone still has upholstery (${(joinRatio * 100).toFixed(2)}% of join zone)`,
          metric: joinRatio,
          limit: RIGHT_JOIN_UPHOLSTERY_MAX,
        });
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

export function formatMaskValidationReport(result: MaskValidationResult): string {
  if (result.passed) return 'Mask validation: PASSED';
  const lines = ['Mask validation: FAILED', ''];
  for (const f of result.failures) {
    lines.push(`  [${f.mask}] ${f.rule}`);
    lines.push(`    ${f.message}`);
    lines.push(`    metric=${f.metric.toFixed(6)} limit=${f.limit}`);
  }
  return lines.join('\n');
}

export function assertMasksValidForRecolor(
  alpha: MaskData,
  upholstery: MaskData,
  legs: MaskData,
  trim: MaskData,
): MaskValidationResult {
  const result = validateProductMasks(alpha, upholstery, legs, trim);
  if (!result.passed) {
    const report = formatMaskValidationReport(result);
    throw new Error(`Recolor blocked — fix masks before rendering.\n${report}`);
  }
  return result;
}
