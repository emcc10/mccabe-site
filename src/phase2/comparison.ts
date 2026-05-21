import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';

const LABEL_HEIGHT = 44;
const STAGE2_LABELS = ['SOURCE', 'MASK OVERLAY', 'STAGE 2 PROOF RECOLOR'];

function labelSvg(text: string, width: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#fff">${text}</text>
    </svg>`,
  );
}

async function panelWithLabel(imagePath: string, label: string): Promise<Buffer> {
  const meta = await sharp(imagePath).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const img = await sharp(imagePath).png().toBuffer();
  return sharp({
    create: { width: w, height: h + LABEL_HEIGHT, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: labelSvg(label, w), top: h, left: 0 },
    ])
    .png()
    .toBuffer();
}

export async function writeLabeledComparisonWithLabels(
  outPath: string,
  sourcePath: string,
  overlayPath: string,
  renderPath: string,
  labels: string[],
): Promise<void> {
  mkdirSync(dirname(outPath), { recursive: true });
  const paths = [sourcePath, overlayPath, renderPath];
  const panels = await Promise.all(
    paths.map((p, i) => panelWithLabel(p, labels[i] ?? `PANEL ${i + 1}`)),
  );
  const metas = await Promise.all(panels.map((b) => sharp(b).metadata()));
  const maxH = Math.max(...metas.map((m) => m.height ?? 0), 1);
  const resized = await Promise.all(
    panels.map((buf, i) => {
      const w = metas[i].width ?? 1;
      const h = metas[i].height ?? 1;
      return sharp(buf).resize(Math.round((w * maxH) / h), maxH).toBuffer();
    }),
  );
  const widths = await Promise.all(resized.map((b) => sharp(b).metadata().then((m) => m.width ?? 0)));
  const totalW = widths.reduce((a, b) => a + b, 0);
  const composites = resized.map((input, i) => ({
    input,
    left: widths.slice(0, i).reduce((a, b) => a + b, 0),
    top: 0,
  }));
  await sharp({
    create: { width: totalW, height: maxH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
}

export async function writeLabeledComparison(
  outPath: string,
  sourcePath: string,
  overlayPath: string,
  renderPath: string,
): Promise<void> {
  return writeLabeledComparisonWithLabels(outPath, sourcePath, overlayPath, renderPath, STAGE2_LABELS);
}
