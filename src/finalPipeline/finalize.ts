import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import type { RgbaImage } from '../phase1/segment.js';
import { SOURCE_OUT } from '../phase1/paths.js';
import type { FinalPipelineResult, SwatchProfile, VariantResult } from './spec.js';
import {
  bestComparisonPath,
  bestPreviewPath,
  finalPath,
  statusPath,
} from './paths.js';

const LABEL_H = 40;

function labelSvg(text: string, width: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#fff">${text}</text>
    </svg>`,
  );
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

export function pickBestVariant(variants: VariantResult[]): VariantResult | null {
  const integrityOk = (v: VariantResult) =>
    !v.qa.feetChanged &&
    !v.qa.backgroundContaminated &&
    !v.qa.bottomSeamRegression &&
    !v.qa.silhouetteChanged;
  const pool = variants.filter(integrityOk);
  if (!pool.length) return null;
  return pool.reduce((best, v) => (v.score > best.score ? v : best));
}

export async function writeFinalGrid(
  profile: SwatchProfile,
  basePath: string,
  variantPaths: { id: string; path: string }[],
): Promise<string> {
  const out = finalPath(`final-grid-${profile.code.toUpperCase().replace(/\s+/g, '-')}.png`);
  const panels = await Promise.all([
    panelWithLabel(SOURCE_OUT, 'SOURCE'),
    panelWithLabel(basePath, 'BASE RECOLOR'),
    ...variantPaths.map((v) => panelWithLabel(v.path, `VARIANT ${v.id}`)),
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
  mkdirSync(dirname(out), { recursive: true });
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
    .toFile(out);
  return out;
}

export async function copyBestMaster(best: VariantResult, profile: SwatchProfile): Promise<string> {
  const dest = bestPreviewPath(profile.code);
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(best.path).png().toFile(dest);
  return dest;
}

export async function writeBestComparison(
  profile: SwatchProfile,
  basePath: string,
  bestPath: string,
): Promise<string> {
  const out = bestComparisonPath(profile.code);
  const panels = await Promise.all([
    panelWithLabel(basePath, 'BASE RECOLOR'),
    panelWithLabel(bestPath, 'BEST PREVIEW'),
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
  mkdirSync(dirname(out), { recursive: true });
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
    .toFile(out);
  return out;
}

export function writeStatusMarkdown(
  profile: SwatchProfile,
  best: VariantResult | null,
  variants: VariantResult[],
  variantsTooClose: boolean,
  prepOk: boolean,
): string {
  const slug = profile.code.toUpperCase().replace(/\s+/g, '-');
  const allFailed = !best;

  const previewQuality = Boolean(best) && !best.qa.feetChanged && !best.qa.backgroundContaminated;
  const finalPhotoQuality = false;
  const realismMeaningful = Boolean(best?.compare.visuallyMeaningful);

  const lines = [
    `# Best preview status — ${slug}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Selected best variant',
    best
      ? `- **${best.id}** (${best.label}) — score ${best.score.toFixed(1)}`
      : '- **None** — all variants failed QA or were trivial',
    '',
    '## Why',
    best
      ? `- Highest-scoring variant that passed integrity checks (feet, background, bottom seam). Realism delta vs base recolor is ${realismMeaningful ? 'meaningful by metric' : 'still subtle/trivial by metric — see QA'}.`
      : `- No variant passed integrity requirements.`,
    `- Mean |ΔL| vs base recolor: **${best?.compare.meanAbsDeltaL.toFixed(2) ?? 'n/a'}**`,
    `- QA verdict: **${best?.qa.verdict ?? 'FAIL'}**`,
    '',
    '## Quality tier',
    `- **Preview-quality:** ${previewQuality ? 'yes' : 'no'}`,
    `- **Near-catalog-quality:** no`,
    `- **Final-photo-quality:** ${finalPhotoQuality ? 'yes' : 'no'}`,
    '',
    '## What remains imperfect',
    '- Deterministic clean-swatch apply cannot reach generated-reference photo realism on this source.',
    `- Swatch material pass mean |ΔL| vs base recolor: **${best?.compare.meanAbsDeltaL.toFixed(2) ?? 'n/a'}** (Phase 10 on same method also scored trivial vs prior baseline).`,
    '- Grain/mottle read as subtle upholstery texture, not full photographic relight.',
    '- Arm curvature / cushion modeling vs reference still limited without generative upholstery pass.',
    variantsTooClose ? '- Variants A/B/C were very close in delta metrics — distinguish mainly by strength tuning.' : '',
    '',
    '## vs old deterministic pipeline (Phases 5–10 / Relight)',
    '- **Materially different architecture:** product-level stages with swatch profiles, sanitized swatch maps, region weights.',
    '- **Outperforms old stack on:** reuse, clarity, QA honesty, no phase churn.',
    '- **Does not yet outperform** old stack on final-photo realism (same fundamental ceiling without generative step).',
    '',
    '## Reusability',
    `- **Reusable for other leathers on TEST-SOFA:** yes — add profile row + run \`npm run render:final-pipeline -- <CODE>\``,
    '',
    '## Recommended future work',
    '- **Add new swatch profiles** for each leather color (targetLab + strength tuning).',
    '- **Use same pipeline** for batch previews.',
    '- **Manual / generative hero-render** for top catalog SKUs where final-photo quality is required.',
    '',
    '## Variants',
    ...variants.map(
      (v) =>
        `- **${v.id}:** mean |ΔL|=${v.compare.meanAbsDeltaL.toFixed(2)}, meaningful=${v.compare.visuallyMeaningful}, failures=${v.qa.failures.length ? v.qa.failures.join('; ') : 'none'}`,
    ),
    '',
    '## Prep validation',
    `- Masks OK: **${prepOk ? 'yes' : 'no'}**`,
    '',
    '## Outputs',
    `- Master: \`best-preview-master-${slug}.png\``,
    `- Metrics: \`qa-metrics-${slug}.json\``,
    !realismMeaningful && best
      ? '\n> **Realism variants did not pass meaningful-change threshold — best master is base+subtle material only, not production hero quality.**\n'
      : '',
    allFailed ? '\n> **No variant passed integrity QA — do not use outputs.**\n' : '',
  ];

  const path = statusPath(profile.code);
  writeFileSync(path, lines.filter((l) => l !== undefined).join('\n'));
  return path;
}

export type { FinalPipelineResult };
