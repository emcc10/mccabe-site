/**
 * Soft HSL leather transfer — original L preserved; hue/sat from swatch only.
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
const FLOOR_MARGIN_PX = 28;
const SWATCH_CENTER_CROP = 0.35;
const SWATCH_BLUR_PX = 12;
const MASK_DILATE_RADIUS = 1;
const MASK_FEATHER_RADIUS = 0;
const MASK_APPLY_THRESH = 220;
const SAT_BASE_WEIGHT = 0.72;
const SAT_TARGET_WEIGHT = 0.28;
const HUE_MIX_MAX = 0.35;
const SAT_MIX_MAX = 0.25;
const SHADOW_PROTECT_LO = 0.05;
const SHADOW_PROTECT_HI = 0.28;
const WARM_HUE_LO = 15 / 360;
const WARM_HUE_HI = 40 / 360;
const WARM_SAT_SCALE = 0.82;
const L_SHADOW_BUMP = 0.015;
const L_HIGHLIGHT_TRIM = 0.01;
const RECOLOR_BLEND = 0.96;
const ORIGINAL_BLEND = 0.04;

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

function isLegPixel(r, g, b, y, sofaBottomY) {
  if (y < sofaBottomY - 6) return false;
  const lum = pixelBrightness(r, g, b);
  if (lum > 52) return false;
  return pixelSaturation(r, g, b) < 0.14;
}

function isFloorAmbientPixel(r, g, b) {
  const bright = pixelBrightness(r, g, b);
  if (bright > 200) return false;
  if (pixelSaturation(r, g, b) >= 0.08) return false;
  return rgbMaxDiff(r, g, b) < 22;
}

function isEdgeGlowPixel(r, g, b) {
  const lum = pixelBrightness(r, g, b);
  if (lum > 228) return true;
  const sat = pixelSaturation(r, g, b);
  return sat < 0.06 && lum > 175;
}

function isUpholsteryPixel(r, g, b, y, sofaBottomY) {
  if (isNearWhite(r, g, b)) return false;
  if (isEdgeGlowPixel(r, g, b)) return false;
  const lum = pixelBrightness(r, g, b);
  if (lum > 250) return false;
  if (isLegPixel(r, g, b, y, sofaBottomY)) return false;
  if (y > sofaBottomY - 12 && isFloorAmbientPixel(r, g, b)) return false;
  const sat = pixelSaturation(r, g, b);
  if (sat >= 0.06) return true;
  if (lum >= 8 && lum <= 120) return true;
  return false;
}

function boxBlurChannel(src, width, height, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

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

function featherMask(mask, width, height, radius = 1) {
  const blurred = boxBlurChannel(
    Float32Array.from(mask, (v) => v),
    width,
    height,
    radius,
  );
  const result = new Uint8Array(mask.length);
  for (let j = 0; j < mask.length; j++) {
    result[j] = Math.round(clamp(blurred[j], 0, 255));
  }
  return result;
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

/** Center 35% crop, blur 12px, median RGB → HSL. */
export async function getSwatchTargetHsl(swatchPath) {
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
  const rs = [];
  const gs = [];
  const bs = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a < 20 || isNearWhite(r, g, b)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }

  if (!rs.length) throw new Error(`No swatch pixels: ${swatchPath}`);

  const r = Math.round(medianOf(rs));
  const g = Math.round(medianOf(gs));
  const b = Math.round(medianOf(bs));
  const hsl = rgbToHsl(r, g, b);
  return { r, g, b, hsl };
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
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (useOptional && hard[j] < 128) {
      hard[j] = 0;
      continue;
    }
    hard[j] = isUpholsteryPixel(r, g, b, y, sofaBottomY) ? 255 : 0;
  }

  let m = morphologyDilate(hard, width, height, MASK_DILATE_RADIUS);
  if (MASK_FEATHER_RADIUS > 0) {
    m = featherMask(m, width, height, MASK_FEATHER_RADIUS);
  }
  return m;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hueDelta(h1, h2) {
  let d = h2 - h1;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

function mixHue(baseH, targetH, t) {
  let h = baseH + hueDelta(baseH, targetH) * t;
  if (h < 0) h += 1;
  if (h >= 1) h -= 1;
  return h;
}

function mixLinear(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Gentle soft HSL nudge — original L and lighting preserved; dark shadows protected.
 */
export function recolorSofa(baseImage, mask, targetHsl, sofaBottomY) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const targetH = targetHsl.h;
  const targetS = targetHsl.s;
  const yFloor = sofaBottomY - FLOOR_MARGIN_PX;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < MASK_APPLY_THRESH) continue;
      if (y > yFloor) continue;

      const p = j * channels;
      const oR = data[p];
      const oG = data[p + 1];
      const oB = data[p + 2];

      const base = rgbToHsl(oR, oG, oB);
      let baseH = base.h;
      let baseS = base.s;

      if (baseH >= WARM_HUE_LO && baseH <= WARM_HUE_HI) {
        baseS *= WARM_SAT_SCALE;
      }

      const shadowProtect = smoothstep(SHADOW_PROTECT_LO, SHADOW_PROTECT_HI, base.l);
      const workS = clamp(baseS * SAT_BASE_WEIGHT + targetS * SAT_TARGET_WEIGHT, 0, 1);

      const finalH = mixHue(baseH, targetH, shadowProtect * HUE_MIX_MAX);
      const finalS = mixLinear(baseS, workS, shadowProtect * SAT_MIX_MAX);

      let finalL = base.l;
      if (finalL < 0.18) finalL = clamp(finalL + L_SHADOW_BUMP, 0, 1);
      if (finalL > 0.88) finalL = clamp(finalL - L_HIGHLIGHT_TRIM, 0, 1);

      const [nR, nG, nB] = hslToRgb(finalH, finalS, finalL);
      const recR = nR * RECOLOR_BLEND + oR * ORIGINAL_BLEND;
      const recG = nG * RECOLOR_BLEND + oG * ORIGINAL_BLEND;
      const recB = nB * RECOLOR_BLEND + oB * ORIGINAL_BLEND;

      const mw = mask[j] / 255;
      out[p] = Math.round(oR + (recR - oR) * mw);
      out[p + 1] = Math.round(oG + (recG - oG) * mw);
      out[p + 2] = Math.round(oB + (recB - oB) * mw);
      if (channels === 4) out[p + 3] = data[p + 3];
    }
  }

  return out;
}

export async function processSwatch(swatchPath, baseSofa, mask, sofaBottomY) {
  const swatchName = basename(swatchPath, extname(swatchPath));
  const target = await getSwatchTargetHsl(swatchPath);
  console.log({
    swatchName,
    targetRGB: [target.r, target.g, target.b],
    targetHSL: [
      Math.round(target.hsl.h * 1000) / 1000,
      Math.round(target.hsl.s * 1000) / 1000,
      Math.round(target.hsl.l * 1000) / 1000,
    ],
  });

  const outData = recolorSofa(baseSofa, mask, target.hsl, sofaBottomY);
  const outPath = join(OUTPUT_DIR, `${swatchName}.png`);
  const bytes = await saveImage(outData, outPath, baseSofa.width, baseSofa.height, baseSofa.channels);
  console.log(`  wrote ${swatchName}.png (${Math.round(bytes / 1024)} KB)`);
  return { outPath, target };
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
  if (!existsSync(SOFA_PATH)) {
    console.error(`Missing: ${SOFA_PATH}`);
    process.exit(1);
  }
  if (!existsSync(SWATCH_DIR)) {
    console.error(`Missing: ${SWATCH_DIR}`);
    process.exit(1);
  }

  const cli = parseCli(argv);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Base sofa: ${SOFA_PATH}`);
  const baseSofa = await loadImage(SOFA_PATH);
  console.log(`  ${baseSofa.width}x${baseSofa.height}`);
  console.log('  method: soft-hsl-gentle');

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  if (maskPath) console.log(`  mask: ${maskPath}`);
  const mask = await createUpholsteryMask(baseSofa, maskPath);
  const sofaBottomY = getSofaBottomY(baseSofa);
  console.log(`  floor cut y=${sofaBottomY - FLOOR_MARGIN_PX} (bottom y=${sofaBottomY})`);

  if (cli.mode === 'one') {
    const swPath = resolveSwatchArg(cli.swatchFile);
    if (!swPath) {
      console.error(`Swatch not found: ${cli.swatchFile}`);
      process.exit(1);
    }
    const { outPath } = await processSwatch(swPath, baseSofa, mask, sofaBottomY);
    console.log(`\nDone: ${outPath}`);
    return;
  }

  const swatches = readdirSync(SWATCH_DIR)
    .filter((f) => SWATCH_EXT.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  for (const file of swatches) {
    await processSwatch(join(SWATCH_DIR, file), baseSofa, mask, sofaBottomY);
  }

  const onDisk = readdirSync(OUTPUT_DIR).filter(
    (f) => f.endsWith('.png') && !f.startsWith('DEBUG-') && !f.startsWith('TEST-'),
  );
  console.log(`\nSofa PNGs: ${onDisk.length} / ${swatches.length}`);

  try {
    const n = zipOutputs(OUTPUT_DIR, ZIP_PATH);
    console.log(`Zip: ${ZIP_PATH} (${n} files)`);
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
