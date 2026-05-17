/**
 * Batch sofa recolor — replace source leather hue with swatch color;
 * keep original luminance (folds, shadows, texture). No AI.
 */
import AdmZip from 'adm-zip';
import { mkdirSync, readdirSync, existsSync } from 'fs';
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
const FOOT_BRIGHTNESS = 35;
const MASK_BLUR_SIGMA = 1.2;

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
 * Center 50% crop → median & average RGB → targetColor = median*0.75 + average*0.25
 */
export async function getSwatchTargetColor(swatchPath) {
  const { data, width, height, channels } = await loadImage(swatchPath);
  const x0 = Math.floor(width * 0.25);
  const y0 = Math.floor(height * 0.25);
  const x1 = Math.ceil(width * 0.75);
  const y1 = Math.ceil(height * 0.75);

  const samples = [];

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a < 20) continue;
      if (isNearWhite(r, g, b)) continue;
      const { L } = rgbToLab(r, g, b);
      samples.push({ r, g, b, L });
    }
  }

  if (!samples.length) {
    throw new Error(`No usable swatch pixels in center crop: ${swatchPath}`);
  }

  const rs = samples.map((s) => s.r);
  const gs = samples.map((s) => s.g);
  const bs = samples.map((s) => s.b);
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const midR = medianOf(rs) * 0.75 + avg(rs) * 0.25;
  const midG = medianOf(gs) * 0.75 + avg(gs) * 0.25;
  const midB = medianOf(bs) * 0.75 + avg(bs) * 0.25;

  const byL = [...samples].sort((a, b) => a.L - b.L);
  const darkN = Math.max(1, Math.floor(byL.length * 0.35));
  const darkSlice = byL.slice(0, darkN);
  const darkR = avg(darkSlice.map((s) => s.r));
  const darkG = avg(darkSlice.map((s) => s.g));
  const darkB = avg(darkSlice.map((s) => s.b));

  const r = Math.round(midR * 0.4 + darkR * 0.6);
  const g = Math.round(midG * 0.4 + darkG * 0.6);
  const b = Math.round(midB * 0.4 + darkB * 0.6);

  const tl = rgbToLab(r, g, b);
  const [dr, dg, db] = labToRgb(tl.L - 4, tl.a, tl.b);
  return { r: dr, g: dg, b: db };
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

export async function createSofaMask(image, optionalMaskPath = null) {
  const { data, width, height, channels } = image;
  let mask = new Uint8Array(width * height);

  if (optionalMaskPath && existsSync(optionalMaskPath)) {
    const m = await loadImage(optionalMaskPath);
    if (m.width !== width || m.height !== height) {
      throw new Error(
        `mask.png must match sofa size ${width}x${height}, got ${m.width}x${m.height}`,
      );
    }
    for (let j = 0, i = 0; j < width * height; j++, i += m.channels) {
      const lum = pixelBrightness(m.data[i], m.data[i + 1], m.data[i + 2]);
      mask[j] = lum > 127 ? 255 : 0;
    }
  } else {
    for (let j = 0, p = 0; j < width * height; j++, p += channels) {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      mask[j] = isNearWhite(r, g, b) ? 0 : 255;
    }
  }

  return featherMask(mask, width, height, MASK_BLUR_SIGMA);
}

function featherMask(mask, width, height, sigma) {
  const radius = Math.max(1, Math.round(sigma));
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = clamp(y + dy, 0, height - 1);
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = clamp(x + dx, 0, width - 1);
          sum += mask[yy * width + xx];
          count++;
        }
      }
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return out;
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

/** How much to apply swatch color (fade in deep shadows to avoid painted creases). */
function colorShiftStrength(labL, y, sofaBounds) {
  let s = clamp((labL - 12) / 40, 0, 1);
  if (!sofaBounds) return s;

  const yBack0 = sofaBounds.minY + sofaBounds.height * 0.2;
  const yBack1 = sofaBounds.minY + sofaBounds.height * 0.55;
  if (y >= yBack0 && y <= yBack1 && labL < 48) {
    const t = (y - yBack0) / Math.max(1, yBack1 - yBack0);
    const lowerBand = t > 0.5 ? (t - 0.5) / 0.5 : 0;
    s *= 1 - lowerBand * 0.7;
    if (labL < 38) s *= clamp((labL - 8) / 30, 0, 1);
  }
  return s;
}

/**
 * Lab shift: keep each pixel's L; move a,b toward swatch. Shadows keep structure, not flat color fill.
 */
export function recolorSofa(baseImage, mask, sourceColor, targetColor, sofaBounds = null) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);

  const srcLab = rgbToLab(sourceColor.r, sourceColor.g, sourceColor.b);
  const tgtLab = rgbToLab(targetColor.r, targetColor.g, targetColor.b);
  const deltaA = tgtLab.a - srcLab.a;
  const deltaB = tgtLab.b - srcLab.b;
  const deltaL = tgtLab.L - srcLab.L;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      const m = mask[j] / 255;
      if (m < 0.004) continue;

      const p = j * channels;
      const oR = data[p];
      const oG = data[p + 1];
      const oB = data[p + 2];
      const oA = channels === 4 ? data[p + 3] : 255;

      if (isNearWhite(oR, oG, oB)) continue;

      if (pixelBrightness(oR, oG, oB) < FOOT_BRIGHTNESS) continue;

      const lab = rgbToLab(oR, oG, oB);

      if (sofaBounds && y > sofaBounds.maxY - 28 && Math.hypot(lab.a, lab.b) < 10 && lab.L < 88) {
        continue;
      }

      const s = colorShiftStrength(lab.L, y, sofaBounds);
      const midW = clamp((lab.L - 28) / 55, 0, 1);
      const newL = lab.L + deltaL * 0.18 * s * midW;
      const shifted = labToRgb(newL, lab.a + deltaA * s, lab.b + deltaB * s);

      let keepOrig = 0;
      if (lab.L < 32) keepOrig = ((32 - lab.L) / 32) * 0.55;
      const nR = shifted[0] * (1 - keepOrig) + oR * keepOrig;
      const nG = shifted[1] * (1 - keepOrig) + oG * keepOrig;
      const nB = shifted[2] * (1 - keepOrig) + oB * keepOrig;

      out[p] = Math.round(clamp(oR * (1 - m) + nR * m, 0, 255));
      out[p + 1] = Math.round(clamp(oG * (1 - m) + nG * m, 0, 255));
      out[p + 2] = Math.round(clamp(oB * (1 - m) + nB * m, 0, 255));
      if (channels === 4) out[p + 3] = oA;
    }
  }

  return out;
}

export async function processSwatch(swatchPath, baseSofa, mask, sourceColor, sofaBounds) {
  const targetColor = await getSwatchTargetColor(swatchPath);
  const outData = recolorSofa(baseSofa, mask, sourceColor, targetColor, sofaBounds);
  const outName = `${basename(swatchPath, extname(swatchPath))}.png`;
  const outPath = join(OUTPUT_DIR, outName);
  await saveImage(outData, outPath, baseSofa.width, baseSofa.height);
  return { outPath, targetColor };
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
  if (maskPath) console.log(`Using mask: ${maskPath}`);
  const mask = await createSofaMask(baseSofa, maskPath);
  const sofaBounds = getSofaBounds(mask, baseSofa.width, baseSofa.height);
  const sourceColor = getSourceLeatherColor(baseSofa, mask);
  console.log(
    `  Source leather (cognac on photo): RGB(${sourceColor.r}, ${sourceColor.g}, ${sourceColor.b})`,
  );
  console.log(
    `  Sofa bounds: ${sofaBounds.width}x${sofaBounds.height} at (${sofaBounds.minX},${sofaBounds.minY})`,
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
      sofaBounds,
    );
    console.log(
      `  ${basename(swPath)} → target RGB(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`,
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
      sofaBounds,
    );
    console.log(
      `  ${file} → RGB(${targetColor.r}, ${targetColor.g}, ${targetColor.b}) → ${basename(outPath)}`,
    );
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
