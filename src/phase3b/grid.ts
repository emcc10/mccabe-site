import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';

const LABEL_HEIGHT = 56;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function variantLabelSvg(title: string, settings: string, width: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="34%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#fff">${escapeXml(title)}</text>
      <text x="50%" y="72%" dominant-baseline="middle" text-anchor="middle"
        font-family="ui-monospace,monospace" font-size="10" fill="#ddd">${escapeXml(settings)}</text>
    </svg>`,
  );
}

async function panelWithLabel(imagePath: string, title: string, settings: string): Promise<Buffer> {
  const meta = await sharp(imagePath).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const img = await sharp(imagePath).png().toBuffer();
  return sharp({
    create: { width: w, height: h + LABEL_HEIGHT, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: variantLabelSvg(title, settings, w), top: h, left: 0 },
    ])
    .png()
    .toBuffer();
}

/** 3 columns × 2 rows grid */
export async function writeVariantGrid(
  outPath: string,
  panels: { imagePath: string; title: string; settings: string }[],
  cols = 3,
): Promise<void> {
  mkdirSync(dirname(outPath), { recursive: true });
  const labeled = await Promise.all(
    panels.map((p) => panelWithLabel(p.imagePath, p.title, p.settings)),
  );
  const metas = await Promise.all(labeled.map((b) => sharp(b).metadata()));
  const cellW = Math.max(...metas.map((m) => m.width ?? 0));
  const cellH = Math.max(...metas.map((m) => m.height ?? 0));
  const resized = await Promise.all(
    labeled.map((buf) => sharp(buf).resize(cellW, cellH, { fit: 'contain', background: '#ffffff' }).png().toBuffer()),
  );
  const rows = Math.ceil(panels.length / cols);
  const gridW = cellW * cols;
  const gridH = cellH * rows;
  const composites = resized.map((input, i) => ({
    input,
    left: (i % cols) * cellW,
    top: Math.floor(i / cols) * cellH,
  }));
  await sharp({
    create: { width: gridW, height: gridH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
}
