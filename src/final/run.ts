import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { DEBUG_DIR, SOURCE_OUT } from '../phase1/paths.js';
import { LOCKED_5B } from '../phase5b/spec.js';
import { LOCKED_5C_C, LOCKED_5C_C_PARAMS } from '../phase5c/spec.js';
import { buildLocked5cCFinal, deltaFrom5b, locked5bParams } from '../phase5c/run.js';
import type { RgbaImage } from '../phase1/segment.js';
import { meanUpholsteryLab } from '../phase5/labUtil.js';

export const FINAL_CANDIDATE = join(DEBUG_DIR, 'final-bali-silk-candidate.png');
export const FINAL_COMPARISON = join(DEBUG_DIR, 'final-bali-silk-comparison.png');
export const FINAL_SPEC = join(DEBUG_DIR, 'final-bali-silk-spec.json');

const LABEL_H = 44;

function labelSvg(text: string, width: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">${text}</text>
    </svg>`,
  );
}

async function writeRgbaPng(path: string, image: RgbaImage) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    .png()
    .toFile(path);
}

async function panelWithLabel(imagePath: string, label: string): Promise<Buffer> {
  const meta = await sharp(imagePath).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const img = await sharp(imagePath).png().toBuffer();
  return sharp({
    create: { width: w, height: h + LABEL_H, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: labelSvg(label, w), top: h, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function writeTwoPanelComparison(
  outPath: string,
  leftPath: string,
  rightPath: string,
  leftLabel: string,
  rightLabel: string,
) {
  const panels = await Promise.all([
    panelWithLabel(leftPath, leftLabel),
    panelWithLabel(rightPath, rightLabel),
  ]);
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
  await sharp({
    create: { width: totalW, height: maxH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(
      resized.map((input, i) => ({
        input,
        left: widths.slice(0, i).reduce((a, b) => a + b, 0),
        top: 0,
      })),
    )
    .png()
    .toFile(outPath);
}

export async function runFinalBaliSilkCandidate() {
  const { final, upholstery, stage5b } = await buildLocked5cCFinal();
  const stage5bLab = meanUpholsteryLab(stage5b, upholstery);
  const finalLab = meanUpholsteryLab(final, upholstery);

  await writeRgbaPng(FINAL_CANDIDATE, final);
  await writeTwoPanelComparison(
    FINAL_COMPARISON,
    SOURCE_OUT,
    FINAL_CANDIDATE,
    'SOURCE',
    'FINAL BALI SILK CANDIDATE',
  );

  writeFileSync(
    FINAL_SPEC,
    JSON.stringify(
      {
        ...LOCKED_5C_C,
        pipeline: [
          'Stage 4B-v3 (color + edge cleanup)',
          'Stage 5B realism (locked baseline)',
          'Stage 5C-C micro-refinement delta',
        ],
        locked5b: locked5bParams(),
        locked5cC: LOCKED_5C_C_PARAMS,
        deltaFrom5b: deltaFrom5b(LOCKED_5C_C_PARAMS),
        upholsteryMeanLab: { stage5b: stage5bLab, final: finalLab },
        postRgbPasses: [],
        outputs: { candidate: FINAL_CANDIDATE, comparison: FINAL_COMPARISON },
      },
      null,
      2,
    ),
  );

  return { candidate: FINAL_CANDIDATE, comparison: FINAL_COMPARISON, spec: FINAL_SPEC, finalLab, stage5bLab };
}
