/**
 * Batch sofa recolor — replace source leather hue with swatch color;
 * keep original luminance (folds, shadows, texture). No AI.
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
const FOOT_BRIGHTNESS = 35;

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

function hueDelta(fromH, toH) {
  let d = toH - fromH;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

/** PIL-style colorize: map grayscale shading → target shadow/mid/highlight. */
function colorFromLuminance(lum, tr, tg, tb) {
  const shadow = [
    Math.round(clamp(tr * 0.5, 0, 255)),
    Math.round(clamp(tg * 0.5, 0, 255)),
    Math.round(clamp(tb * 0.5, 0, 255)),
  ];
  const mid = [tr, tg, tb];
  const highlight = [
    Math.round(clamp(tr * 1.14 + 10, 0, 255)),
    Math.round(clamp(tg * 1.14 + 10, 0, 255)),
    Math.round(clamp(tb * 1.14 + 10, 0, 255)),
  ];
  const t = clamp(lum / 255, 0, 1);
  if (t <= 0.5) {
    const u = t * 2;
    return [
      Math.round(shadow[0] + (mid[0] - shadow[0]) * u),
      Math.round(shadow[1] + (mid[1] - shadow[1]) * u),
      Math.round(shadow[2] + (mid[2] - shadow[2]) * u),
    ];
  }
  const u = (t - 0.5) * 2;
  return [
    Math.round(mid[0] + (highlight[0] - mid[0]) * u),
    Math.round(mid[1] + (highlight[1] - mid[1]) * u),
    Math.round(mid[2] + (highlight[2] - mid[2]) * u),
  ];
}

function isWarmLeather(r, g, b) {
  return r >= g - 4 && r >= b - 6;
}

/** Floor drop shadow / neutral gray only — warm leather highlights are never skipped. */
function isProtectedShadowOrGray(r, g, b) {
  if (isWarmLeather(r, g, b)) return false;

  const bright = pixelBrightness(r, g, b);
  if (bright < FOOT_BRIGHTNESS) return true;

  const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
  if (maxDiff < 26 && bright > 28 && bright < 225) return true;
  if (b >= r - 1 && bright < 200) return true;
  if (g > r + 4 && b > r && bright < 180) return true;

  const { a, b: lb } = rgbToLab(r, g, b);
  if (Math.hypot(a, lb) < 14 && bright > 32 && bright < 210) return true;
  return false;
}

/** Dark wood feet only — not deep leather creases (those stay warm/orange if skipped). */
function isFootPixel(r, g, b) {
  const bright = pixelBrightness(r, g, b);
  if (bright >= 55) return false;
  if (isWarmLeather(r, g, b)) return false;
  return Math.max(r, g, b) < 80;
}

/** Every masked leather pixel — including crease shadows (skipping them caused cognac fringes). */
function shouldRecolorPixel(r, g, b) {
  if (isNearWhite(r, g, b)) return false;
  if (isFootPixel(r, g, b)) return false;
  return true;
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
 * Center 50% crop → Lab median of mid-lightness face pixels (flat leather tone).
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
      samples.push(rgbToLab(r, g, b));
    }
  }

  if (!samples.length) {
    throw new Error(`No usable swatch pixels in center crop: ${swatchPath}`);
  }

  const byL = [...samples].sort((a, b) => a.L - b.L);
  const p30 = byL[Math.floor(byL.length * 0.3)].L;
  const p70 = byL[Math.floor(byL.length * 0.7)].L;
  const face = samples.filter((s) => s.L >= p30 && s.L <= p70);
  const use = face.length > 20 ? face : samples;

  const [r, g, b] = labToRgb(
    medianOf(use.map((s) => s.L)),
    medianOf(use.map((s) => s.a)),
    medianOf(use.map((s) => s.b)),
  );
  return { r, g, b };
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

  return mask;
}

/**
 * Last row that is still upholstery (exclude floor drop shadow below).
 */
export function getLeatherBottomY(baseImage, mask, imgWidth, imgHeight) {
  const { data, channels } = baseImage;

  for (let y = imgHeight - 1; y >= 0; y--) {
    let leather = 0;
    let shadow = 0;
    let counted = 0;

    for (let x = 0; x < imgWidth; x++) {
      const j = y * imgWidth + x;
      if (mask[j] < 128) continue;
      const p = j * channels;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      if (isNearWhite(r, g, b)) continue;
      counted++;
      if (isProtectedShadowOrGray(r, g, b)) shadow++;
      else leather++;
    }

    if (counted > 24 && leather > shadow && leather > counted * 0.2) {
      return Math.min(imgHeight - 1, y + 8);
    }
  }

  return imgHeight - 1;
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

function labShiftStrength(labL) {
  if (labL >= 16) return 1;
  return clamp((labL - 5) / 11, 0, 1);
}

/**
 * Lab anchor: each pixel keeps its offset from cognac → mapped to swatch (real folds/highlights).
 */
export function recolorSofa(
  baseImage,
  mask,
  sourceColor,
  targetColor,
  leatherBottomY = null,
  _sofaBounds = null,
) {
  const { data, width, height, channels } = baseImage;
  const out = Buffer.from(data);

  const srcLab = rgbToLab(sourceColor.r, sourceColor.g, sourceColor.b);
  const tgtLab = rgbToLab(targetColor.r, targetColor.g, targetColor.b);
  const srcChroma = Math.hypot(srcLab.a, srcLab.b);
  const tgtChroma = Math.hypot(tgtLab.a, tgtLab.b);
  const chromaK = clamp(tgtChroma / Math.max(srcChroma, 5), 0.45, 1);

  const yCut =
    leatherBottomY == null ? height - 1 : Math.min(height - 1, leatherBottomY);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = y * width + x;
      if (mask[j] < 128) continue;
      if (y > yCut) continue;

      const p = j * channels;
      const oR = data[p];
      const oG = data[p + 1];
      const oB = data[p + 2];
      const oA = channels === 4 ? data[p + 3] : 255;

      if (!shouldRecolorPixel(oR, oG, oB)) continue;

      const lab = rgbToLab(oR, oG, oB);
      const s = labShiftStrength(lab.L);

      const fullL = tgtLab.L + (lab.L - srcLab.L);
      let fullA = srcLab.a + (tgtLab.a - srcLab.a) * chromaK + (lab.a - srcLab.a);
      let fullB = srcLab.b + (tgtLab.b - srcLab.b) * chromaK + (lab.b - srcLab.b);

      if (lab.L > 50) {
        fullB -= (tgtLab.b - srcLab.b) * chromaK * 0.4;
        fullA -= (tgtLab.a - srcLab.a) * chromaK * 0.08;
      }

      const newL = lab.L + (fullL - lab.L) * s;
      const newA = lab.a + (fullA - lab.a) * s;
      const newB = lab.b + (fullB - lab.b) * s;

      const [nR, nG, nB] = labToRgb(newL, newA, newB);

      out[p] = nR;
      out[p + 1] = nG;
      out[p + 2] = nB;
      if (channels === 4) out[p + 3] = oA;
    }
  }

  return out;
}

export async function processSwatch(
  swatchPath,
  baseSofa,
  mask,
  sourceColor,
  leatherBottomY,
  sofaBounds,
) {
  const targetColor = await getSwatchTargetColor(swatchPath);
  const outData = recolorSofa(
    baseSofa,
    mask,
    sourceColor,
    targetColor,
    leatherBottomY,
    sofaBounds,
  );
  const outName = `${basename(swatchPath, extname(swatchPath))}.png`;
  const outPath = join(OUTPUT_DIR, outName);
  await saveImage(outData, outPath, baseSofa.width, baseSofa.height);

  const stampPath = join(OUTPUT_DIR, '_last-render.txt');
  const stamp = `${new Date().toISOString()}\n${basename(swatchPath)}\nmethod: lab-anchor-v4\ntarget: ${targetColor.r},${targetColor.g},${targetColor.b}\n`;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(stampPath, stamp);

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
  const leatherBottomY = getLeatherBottomY(
    baseSofa,
    mask,
    baseSofa.width,
    baseSofa.height,
  );
  const sourceColor = getSourceLeatherColor(baseSofa, mask);
  console.log(
    `  Source leather (cognac on photo): RGB(${sourceColor.r}, ${sourceColor.g}, ${sourceColor.b})`,
  );
  console.log(
    `  Sofa bounds: ${sofaBounds.width}x${sofaBounds.height} at (${sofaBounds.minX},${sofaBounds.minY})`,
  );
  console.log(`  Recolor stops above floor shadow (y <= ${leatherBottomY})`);

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
      leatherBottomY,
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
      leatherBottomY,
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
