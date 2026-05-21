export const ON = 255;
export const OFF = 0;

export interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
}

export function dilate(mask: Mask, px: number): Mask {
  if (px <= 0) return { ...mask, data: new Uint8Array(mask.data) };
  const out = new Uint8Array(mask.data.length);
  const { width: w, height: h, data } = mask;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] < 128) continue;
      for (let dy = -px; dy <= px; dy++) {
        for (let dx = -px; dx <= px; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = ON;
        }
      }
    }
  }
  return { width: w, height: h, data: out };
}

export function erode(mask: Mask, px: number): Mask {
  if (px <= 0) return { ...mask, data: new Uint8Array(mask.data) };
  const out = new Uint8Array(mask.data.length);
  const { width: w, height: h, data } = mask;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = y * w + x;
      if (data[j] < 128) {
        out[j] = OFF;
        continue;
      }
      let keep = true;
      for (let dy = -px; dy <= px && keep; dy++) {
        for (let dx = -px; dx <= px; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || data[yy * w + xx] < 128) {
            keep = false;
            break;
          }
        }
      }
      out[j] = keep ? ON : OFF;
    }
  }
  return { width: w, height: h, data: out };
}

export function subtract(a: Mask, b: Mask): Mask {
  const out = new Uint8Array(a.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = a.data[i] >= 128 && b.data[i] < 128 ? ON : OFF;
  }
  return { ...a, data: out };
}

export function intersect(a: Mask, b: Mask): Mask {
  const out = new Uint8Array(a.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = a.data[i] >= 128 && b.data[i] >= 128 ? ON : OFF;
  }
  return { ...a, data: out };
}

export function union(...masks: Mask[]): Mask {
  if (!masks.length) throw new Error('union() requires at least one mask');
  const base = masks[0];
  const out = new Uint8Array(base.data.length);
  for (let i = 0; i < out.length; i++) {
    let on = false;
    for (const m of masks) {
      if (m.data[i] >= 128) {
        on = true;
        break;
      }
    }
    out[i] = on ? ON : OFF;
  }
  return { width: base.width, height: base.height, data: out };
}

export function bbox(mask: Mask) {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x] < 128) continue;
      any = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return any ? { minX, minY, maxX, maxY } : null;
}

export function dropSmall(mask: Mask, minArea: number): Mask {
  const w = mask.width;
  const h = mask.height;
  const labels = new Int32Array(mask.data.length);
  const areas = new Map<number, number>();
  let next = 1;

  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] < 128 || labels[j] !== 0) continue;
    const stack = [j];
    labels[j] = next;
    let area = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      area++;
      const x = cur % w;
      const y = (cur / w) | 0;
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
    areas.set(next, area);
    next++;
  }

  const out = new Uint8Array(mask.data.length);
  for (let j = 0; j < mask.data.length; j++) {
    const lab = labels[j];
    if (lab === 0) {
      out[j] = OFF;
      continue;
    }
    out[j] = (areas.get(lab) ?? 0) >= minArea ? ON : OFF;
  }
  return { ...mask, data: out };
}
