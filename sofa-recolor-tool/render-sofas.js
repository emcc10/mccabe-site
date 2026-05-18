/**
 * Photographic leather recolor — upholstery midtones only; Lab a/b transfer; original L kept. No AI.
 */
import AdmZip from 'adm-zip';
import { mkdirSync, readdirSync, existsSync, writeFileSync } from 'fs';
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
const SPECULAR_BRIGHT = 215;
const SPECULAR_ORIGINAL_BLEND = 0.7;

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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Post-LAB: saturation boost only (no contrast/sharpen). */
function applySaturationBoost(r, g, b, factor = 1.08) {
  const hsl = rgbToHsl(r, g, b);
  const ns = clamp(hsl.s * factor, 0, 1);
  return hslToRgb(hsl.h, ns, hsl.l);
}

const SHADOW_LAB_L = 70;

/** Separable box blur (~0.8px feather) — sharp.blur() collapses sparse upholstery masks. */
function featherMask(mask, width, height, radius = 1) {
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

export async function saveImage(data, path, width, height) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(path);
}

/**
 * Center 40% crop, 8px blur, mean L/a/b (full swatch chroma for transfer).
 */
export async function getSwatchLabStats(swatchPath) {
  const meta = await sharp(swatchPath).metadata();
  const width = meta.width;
  const height = meta.height;
  const x0 = Math.floor(width * 0.3);
  const y0 = Math.floor(height * 0.3);
  const cw = Math.max(1, Math.ceil(width * 0.7) - x0);
  const ch = Math.max(1, Math.ceil(height * 0.7) - y0);

  const { data, info } = await sharp(swatchPath)
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .blur(8)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const w = info.width;
  const h = info.height;
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a < 20) continue;
      if (isNearWhite(r, g, b)) continue;
      const lab = rgbToLab(r, g, b);
      sumL += lab.L;
      sumA += lab.a;
      sumB += lab.b;
      count++;
    }
  }

  if (!count) {
    throw new Error(`No usable swatch pixels in center crop: ${swatchPath}`);
  }

  return {
    meanL: sumL / count,
    meanA: sumA / count,
    meanB: sumB / count,
  };
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
 * Upholstery midtone mask (not full silhouette). Feathered 0.8px.
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

  return featherMask(hard, width, height, 1);
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
 * Neutralize cognac chroma → apply swatch a/b; keep L; shadow + floor protected.
 */
export function recolorSofa(
  baseImage,
  mask,
  swatchLab,
  sofaBottomY,
  _sofaBounds = null,
) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const swatchA = swatchLab.meanA;
  const swatchB = swatchLab.meanB;
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

      const { L: origL, a: As, b: Bs } = rgbToLab(oR, oG, oB);
      const finalL = origL;

      const neutralA = lerp(As, 0, 0.92);
      const neutralB = lerp(Bs, 0, 0.92);
      const blendedA = neutralA * 0.08 + swatchA * 0.92;
      const blendedB = neutralB * 0.08 + swatchB * 0.92;

      const shadowBlend = clamp(origL / SHADOW_LAB_L, 0, 1);
      const finalA = swatchA * (1 - shadowBlend) + blendedA * shadowBlend;
      const finalB = swatchB * (1 - shadowBlend) + blendedB * shadowBlend;

      let [nR, nG, nB] = labToRgb(finalL, finalA, finalB);
      [nR, nG, nB] = applySaturationBoost(nR, nG, nB, 1.08);

      let t = maskW;
      const bright = pixelBrightness(oR, oG, oB);
      if (bright > SPECULAR_BRIGHT) {
        t *= 1 - SPECULAR_ORIGINAL_BLEND;
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
  const swatchLab = await getSwatchLabStats(swatchPath);
  console.log({
    swatchName,
    meanLAB: [
      Math.round(swatchLab.meanL * 100) / 100,
      Math.round(swatchLab.meanA * 100) / 100,
      Math.round(swatchLab.meanB * 100) / 100,
    ],
  });
  const outData = recolorSofa(
    baseSofa,
    mask,
    swatchLab,
    sofaBottomY,
    sofaBounds,
  );
  const outName = `${basename(swatchPath, extname(swatchPath))}.png`;
  const outPath = join(OUTPUT_DIR, outName);
  await saveImage(outData, outPath, baseSofa.width, baseSofa.height);

  const [r, g, b] = labToRgb(swatchLab.meanL, swatchLab.meanA, swatchLab.meanB);
  const targetColor = { r, g, b };

  const stampPath = join(OUTPUT_DIR, '_last-render.txt');
  const stamp = `${new Date().toISOString()}\n${swatchName}\nmethod: lab-neutralize-chroma\ntargetLab: ${swatchLab.meanL.toFixed(2)},${swatchLab.meanA.toFixed(2)},${swatchLab.meanB.toFixed(2)}\n`;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  try {
    writeFileSync(stampPath, stamp);
  } catch {
    /* OneDrive may lock _last-render.txt */
  }

  return { outPath, targetColor, swatchLab };
}

export function zipOutputs(outputDir, zipPath) {
  const zip = new AdmZip();
  const files = readdirSync(outputDir).filter(
    (f) => f.toLowerCase().endsWith('.png') && f !== 'sofa-renders.zip',
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
    const { outPath, targetColor } = await processSwatch(
      swPath,
      baseSofa,
      mask,
      sourceColor,
      sofaBottomY,
      sofaBounds,
    );
    console.log(`  → ${basename(outPath)}`);
    written.push(outPath);
  }

  const n = zipOutputs(OUTPUT_DIR, ZIP_PATH);
  console.log(`\nDone. ${written.length} PNG(s), zip: ${ZIP_PATH} (${n} files)`);
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
