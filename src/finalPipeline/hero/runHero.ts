import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { SOURCE_OUT } from '../../phase1/paths.js';
import { HERO_DIR } from '../shared/paths.js';
import { buildSharedRenderContext } from '../shared/context.js';
import { buildHeroInputBundle } from './buildHeroInputs.js';
import { buildHeroExportManifest } from './exportHero.js';
import {
  compositeHeroFromGenerative,
  loadGenerativeRgbAsRgba,
  writeHeroRgba,
} from './compositeHero.js';
import { resolveHeroGenerativeProvider, HeroProviderNotConfiguredError } from './generativeProvider.js';
import type { HeroPipelineResult } from './spec.js';
import { heroComparisonPath, heroMasterPath, heroStatusPath } from '../shared/paths.js';

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

async function writeHeroComparison(basePath: string, heroPath: string, outPath: string) {
  const panels = await Promise.all([
    panelWithLabel(basePath, 'BASE RECOLOR'),
    panelWithLabel(heroPath, 'HERO'),
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
  mkdirSync(dirname(outPath), { recursive: true });
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

function writeHeroStatus(
  result: Omit<HeroPipelineResult, 'outputs'> & { outputs: HeroPipelineResult['outputs'] },
): string {
  const slug = result.profile.code.toUpperCase().replace(/\s+/g, '-');
  const path = heroStatusPath(result.profile.code);
  const lines = [
    `# Hero render status — ${slug}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Generative step',
    `- **Skipped:** ${result.skippedGenerative ? 'yes' : 'no'}`,
    `- **Message:** ${result.message}`,
    '',
    '## Input bundle',
    `- Directory: \`${result.inputBundle.paths.bundleDir}\``,
    `- Edit mask: \`upholstery-edit-mask.png\` (white = upholstery to edit)`,
    `- Protected mask: \`protected-mask.png\` (white = do not edit)`,
    '',
    '## Outputs',
    result.outputs.heroMaster
      ? `- Hero master: \`${result.outputs.heroMaster}\``
      : '- Hero master: *(not generated)*',
    `- Comparison: \`${result.outputs.heroComparison}\``,
    '',
    '## When this file shows "skipped"',
    'Configure `HERO_GENERATIVE_PROVIDER` and `HERO_GENERATIVE_API_KEY`, implement the provider, then re-run `npm run render:hero-pipeline`.',
    '',
  ];
  writeFileSync(path, lines.join('\n'));
  return path;
}

export interface RunHeroOptions {
  /** Run shared stages 1–3 even if preview was not run first */
  buildShared?: boolean;
}

/**
 * Optional hero pipeline: shared prep/base/swatch + generative upholstery edit.
 * Does not modify preview outputs. Default mode writes input bundle only.
 */
export async function runHeroPipeline(
  swatchCode: string,
  options: RunHeroOptions = {},
): Promise<HeroPipelineResult> {
  mkdirSync(HERO_DIR, { recursive: true });

  console.log(`[hero] Shared context (${swatchCode})`);
  const ctx = await buildSharedRenderContext(swatchCode);

  console.log('[hero] Build generative input bundle');
  const inputBundle = await buildHeroInputBundle(ctx);

  const provider = resolveHeroGenerativeProvider();
  const generativeRawPath = `${inputBundle.paths.bundleDir}/generative-raw.png`;
  let generative: HeroPipelineResult['generative'] = null;
  let skippedGenerative = true;
  let message =
    'Input bundle written. Generative step skipped (HERO_GENERATIVE_PROVIDER=bundle-only).';

  if (provider.isConfigured()) {
    try {
      console.log(`[hero] Generative provider: ${provider.id}`);
      generative = await provider.generate(
        {
          profile: ctx.profile,
          bundle: inputBundle,
          sourcePath: SOURCE_OUT,
        },
        generativeRawPath,
      );
      skippedGenerative = false;
      message = `Generative edit completed via ${provider.id}.`;
    } catch (err) {
      if (err instanceof HeroProviderNotConfiguredError) {
        message = err.message;
      } else {
        throw err;
      }
    }
  }

  let heroMaster = '';
  let heroComparison = heroComparisonPath(ctx.profile.code);

  if (generative) {
    console.log('[hero] Composite legs/background from source');
    const raw = await loadGenerativeRgbAsRgba(
      generative.generativeRgbPath,
      ctx.source.width,
      ctx.source.height,
    );
    const composited = compositeHeroFromGenerative(ctx, raw);
    heroMaster = heroMasterPath(ctx.profile.code);
    await writeHeroRgba(heroMaster, composited);
    await writeHeroComparison(ctx.base.path, heroMaster, heroComparison);
  } else {
    heroComparison = '';
  }

  const outputs = {
    heroMaster,
    heroComparison,
    status: '',
  };

  const result: HeroPipelineResult = {
    swatchCode: ctx.profile.code,
    profile: ctx.profile,
    inputBundle,
    generative,
    outputs,
    skippedGenerative,
    message,
  };

  outputs.status = writeHeroStatus(result);

  const manifest = buildHeroExportManifest(ctx, result);
  writeFileSync(
    `${inputBundle.paths.bundleDir}/hero-export-manifest.json`,
    JSON.stringify(manifest, null, 2),
  );

  console.log(`[hero] ${message}`);
  console.log(`[hero] Bundle: ${inputBundle.paths.bundleDir}`);

  return result;
}
