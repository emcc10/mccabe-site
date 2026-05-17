/**
 * Batch sofa recolor — deterministic, same dimensions as base, no AI.
 *
 * Input:
 *   input/sofa.png
 *   input/swatches/*.jpg|png|webp
 *   input/mask.png (optional; white = recolor, black = keep)
 *
 * Output:
 *   output/<swatch-filename>.png
 *   output/sofa-renders.zip
 */
import AdmZip from 'adm-zip';
import { mkdirSync, readdirSync, existsSync, readFileSync } from 'fs';
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

/**
 * @param {Buffer} data RGBA
 */
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
 * @returns {{ r: number, g: number, b: number }}
 */
export async function getSwatchTargetColor(swatchPath) {
  const { data, width, height, channels } = await loadImage(swatchPath);
  const x0 = Math.floor(width * 0.25);
  const y0 = Math.floor(height * 0.25);
  const x1 = Math.ceil(width * 0.75);
  const y1 = Math.ceil(height * 0.75);

  const rs = [];
  const gs = [];
  const bs = [];

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a < 20) continue;
      if (isNearWhite(r, g, b)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }

  if (!rs.length) {
    throw new Error(`No usable swatch pixels in center crop: ${swatchPath}`);
  }

  const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const medR = median(rs);
  const medG = median(gs);
  const medB = median(bs);
  const avgR = avg(rs);
  const avgG = avg(gs);
  const avgB = avg(bs);

  return {
    r: Math.round(medR * 0.75 + avgR * 0.25),
    g: Math.round(medG * 0.75 + avgG * 0.25),
    b: Math.round(medB * 0.75 + avgB * 0.25),
  };
}

/**
 * Sofa mask 0–255 (feathered). Optional input/mask.png overrides auto mask.
 * @returns {Promise<Uint8Array>}
 */
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
      if (isNearWhite(r, g, b)) {
        mask[j] = 0;
      } else {
        mask[j] = 255;
      }
    }
  }

  const blurred = await sharp(Buffer.from(mask), {
    raw: { width, height, channels: 1 },
  })
    .blur(MASK_BLUR_SIGMA)
    .raw()
    .toBuffer();

  return new Uint8Array(blurred);
}

/**
 * @param {Uint8Array} mask
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
 */
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
    return { minX: 0, minY: 0, maxX: imgWidth - 1, maxY: imgHeight - 1, width: imgWidth, height: imgHeight };
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
 * Optional 5–8% grain from swatch center (color only, no fold tiling).
 */
function sampleSwatchGrainRgb(swatchPath, swatchW, swatchH, swatchChannels, swatchData) {
  const cx0 = Math.floor(swatchW * 0.35);
  const cy0 = Math.floor(swatchH * 0.35);
  const cx1 = Math.ceil(swatchW * 0.65);
  const cy1 = Math.ceil(swatchH * 0.65);
  const grains = [];
  for (let y = cy0; y < cy1; y += 2) {
    for (let x = cx0; x < cx1; x += 2) {
      const i = (y * swatchW + x) * swatchChannels;
      grains.push([swatchData[i], swatchData[i + 1], swatchData[i + 2]]);
    }
  }
  return grains.length ? grains : [[128, 128, 128]];
}

let grainCache = null;

function getGrainOffset(x, y, grains) {
  const g = grains[(x * 17 + y * 31) % grains.length];
  return g;
}

/**
 * @param {{ data: Buffer, width: number, height: number, channels: number }} baseImage
 * @param {Uint8Array} mask
 * @param {{ r: number, g: number, b: number }} targetColor
 * @param {ReturnType<typeof getSofaBounds>} sofaBounds
 * @param {string} [swatchPath] for subtle grain
 * @returns {Buffer} RGBA output
 */
export function recolorSofa(baseImage, mask, targetColor, sofaBounds, swatchPath = null) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);
  const { r: tR, g: tG, b: tB } = targetColor;

  const yBack0 = sofaBounds.minY + sofaBounds.height * 0.2;
  const yBack1 = sofaBounds.minY + sofaBounds.height * 0.55;

  if (swatchPath && !grainCache) {
    // lazy; set per swatch in processSwatch
  }

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

      if (isNearWhite(oR, oG, oB)) {
        out[p] = oR;
        out[p + 1] = oG;
        out[p + 2] = oB;
        if (channels === 4) out[p + 3] = oA;
        continue;
      }

      const bright = pixelBrightness(oR, oG, oB);

      if (bright < FOOT_BRIGHTNESS) {
        continue;
      }

      let lum = bright;
      let shade = lum / 128;
      shade = clamp(shade, 0.55, 1.35);

      if (y >= yBack0 && y <= yBack1 && shade < 0.82) {
        shade = shade * 0.75 + 0.82 * 0.25;
      }

      let nR = tR * shade;
      let nG = tG * shade;
      let nB = tB * shade;

      nR = nR * 0.82 + oR * 0.18;
      nG = nG * 0.82 + oG * 0.18;
      nB = nB * 0.82 + oB * 0.18;

      if (grainCache?.grains?.length) {
        const [gR, gG, gB] = getGrainOffset(x, y, grainCache.grains);
        const grainAmt = 0.065 * m;
        nR = nR * (1 - grainAmt) + gR * grainAmt;
        nG = nG * (1 - grainAmt) + gG * grainAmt;
        nB = nB * (1 - grainAmt) + gB * grainAmt;
      }

      const w = m;

      out[p] = Math.round(clamp(oR * (1 - w) + nR * w, 0, 255));
      out[p + 1] = Math.round(clamp(oG * (1 - w) + nG * w, 0, 255));
      out[p + 2] = Math.round(clamp(oB * (1 - w) + nB * w, 0, 255));
      if (channels === 4) out[p + 3] = oA;
    }
  }

  return out;
}

/**
 * @returns {Promise<string>} output png path
 */
export async function processSwatch(swatchPath, baseSofa, mask, sofaBounds) {
  const targetColor = await getSwatchTargetColor(swatchPath);
  const sw = await loadImage(swatchPath);
  grainCache = {
    grains: sampleSwatchGrainRgb(swatchPath, sw.width, sw.height, sw.channels, sw.data),
  };

  const outData = recolorSofa(baseSofa, mask, targetColor, sofaBounds, swatchPath);
  grainCache = null;

  const outName = `${basename(swatchPath, extname(swatchPath))}.png`;
  const outPath = join(OUTPUT_DIR, outName);
  await saveImage(outData, outPath, baseSofa.width, baseSofa.height);
  return outPath;
}

export function zipOutputs(outputDir, zipPath) {
  const zip = new AdmZip();
  const files = readdirSync(outputDir).filter((f) => f.toLowerCase().endsWith('.png') && f !== 'sofa-renders.zip');
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

export async function main() {
  if (!existsSync(SOFA_PATH)) {
    console.error(`Missing base sofa: ${SOFA_PATH}`);
    console.error('Place your clean sofa image at input/sofa.png');
    process.exit(1);
  }
  if (!existsSync(SWATCH_DIR)) {
    console.error(`Missing swatch folder: ${SWATCH_DIR}`);
    process.exit(1);
  }

  const swatches = readdirSync(SWATCH_DIR)
    .filter((f) => SWATCH_EXT.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  if (!swatches.length) {
    console.error(`No swatch images in ${SWATCH_DIR}`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Base sofa: ${SOFA_PATH}`);
  const baseSofa = await loadImage(SOFA_PATH);
  console.log(`  ${baseSofa.width}x${baseSofa.height}`);

  const maskPath = existsSync(MASK_PATH) ? MASK_PATH : null;
  if (maskPath) console.log(`Using mask: ${maskPath}`);
  const mask = await createSofaMask(baseSofa, maskPath);
  const sofaBounds = getSofaBounds(mask, baseSofa.width, baseSofa.height);
  console.log(
    `  Sofa bounds: ${sofaBounds.width}x${sofaBounds.height} at (${sofaBounds.minX},${sofaBounds.minY})`,
  );

  const written = [];
  for (const file of swatches) {
    const swPath = join(SWATCH_DIR, file);
    const target = await getSwatchTargetColor(swPath);
    console.log(
      `  ${file} → target RGB(${target.r}, ${target.g}, ${target.b})`,
    );
    const outPath = await processSwatch(swPath, baseSofa, mask, sofaBounds);
    written.push(outPath);
    console.log(`    wrote ${outPath}`);
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
