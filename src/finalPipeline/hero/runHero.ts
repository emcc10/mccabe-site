import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import { SOURCE_OUT } from '../../phase1/paths.js';
import { HERO_DIR } from '../shared/paths.js';
import { buildSharedRenderContext } from '../shared/context.js';
import { buildHeroInputBundle } from './buildHeroInputs.js';
import { resolveHeroGenerativeProvider } from './generativeProvider.js';
import { verifyOpenAiApiKey } from './providers/openaiImageEdit.js';
import { blendGenerativeUpholstery } from './blendUpholstery.js';
import {
  compositeHeroFromGenerative,
  loadGenerativeRgbAsRgba,
  writeHeroRgba,
} from './compositeHero.js';
import { runHeroQa } from './qa.js';
import { HERO_VARIANTS } from './variants.js';
import type { HeroPipelineResult, HeroVariantRunResult } from './spec.js';
import {
  heroGridPath,
  heroSpecPath,
  heroStatusPath,
  heroVariantPath,
} from '../shared/paths.js';

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

async function writeHeroGrid(
  outPath: string,
  panels: { path: string; label: string }[],
): Promise<void> {
  const labeled = await Promise.all(panels.map((p) => panelWithLabel(p.path, p.label)));
  const metas = await Promise.all(labeled.map((b) => sharp(b).metadata()));
  const maxH = Math.max(...metas.map((m) => m.height ?? 0), 1);
  const resized = await Promise.all(
    labeled.map((buf, i) => {
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

function writeHeroStatusMd(
  result: HeroPipelineResult,
  providerConfigured: boolean,
): string {
  const slug = result.swatchCode.toUpperCase().replace(/\s+/g, '-');
  const path = heroStatusPath(result.swatchCode);
  const best = result.variants.find((v) => v.id === result.bestVariantId);

  const lines = [
    `# Hero render status — ${slug}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Pipeline',
    `- **Provider:** ${result.providerId}`,
    `- **Generative ran:** ${result.skippedGenerative ? 'no' : 'yes'}`,
    `- **Message:** ${result.message}`,
    '',
    '## Best variant',
    best
      ? `- **${best.id}** (${best.label}) — QA ${best.qa.verdict}`
      : '- **None** — generative step did not complete or all variants failed QA',
    '',
    '## Variants',
    ...result.variants.map(
      (v) =>
        `- **${v.id}:** ${v.qa.verdict}${v.qa.failures.length ? ` (${v.qa.failures.join('; ')})` : ''}`,
    ),
    '',
    '## Outputs',
    `- \`hero-variant-A-${slug}.png\``,
    `- \`hero-variant-B-${slug}.png\``,
    `- \`hero-grid-${slug}.png\``,
    `- \`hero-spec-${slug}.json\``,
    '',
    '## Configuration',
    providerConfigured
      ? '- OpenAI credentials detected (`OPENAI_API_KEY` or `HERO_GENERATIVE_API_KEY`).'
      : '- **No API key** — set `HERO_GENERATIVE_PROVIDER=openai` and `OPENAI_API_KEY` to run generative edits.',
    '',
    '## Post-processing',
    '- Generative output is feather-blended into upholstery only, then legs/background are locked from source via `compositePhase2`.',
    '',
  ];

  writeFileSync(path, lines.join('\n'));
  return path;
}

export interface RunHeroOptions {
  /** If false, only write input bundle (no API calls) */
  runGenerative?: boolean;
}

export async function runHeroPipeline(
  swatchCode: string,
  options: RunHeroOptions = {},
): Promise<HeroPipelineResult> {
  mkdirSync(HERO_DIR, { recursive: true });
  const runGenerative = options.runGenerative !== false;

  console.log(`[hero] Shared context (${swatchCode})`);
  const ctx = await buildSharedRenderContext(swatchCode);

  console.log('[hero] Input bundle');
  const inputBundle = await buildHeroInputBundle(ctx);

  let provider;
  try {
    provider = resolveHeroGenerativeProvider();
  } catch (err) {
    const specPath = heroSpecPath(ctx.profile.code);
    const failResult: HeroPipelineResult = {
      swatchCode: ctx.profile.code,
      profile: ctx.profile,
      inputBundle,
      providerId: 'openai',
      variants: [],
      bestVariantId: null,
      outputs: {
        grid: '',
        spec: specPath,
        status: '',
        variantPaths: {
          A: heroVariantPath('A', ctx.profile.code),
          B: heroVariantPath('B', ctx.profile.code),
        },
        bestMaster: '',
      },
      skippedGenerative: true,
      message: err instanceof Error ? err.message : String(err),
    };
    writeFileSync(
      specPath,
      JSON.stringify(
        { pipeline: 'hero-pipeline-v2', error: failResult.message, inputBundle: inputBundle.paths },
        null,
        2,
      ),
    );
    failResult.outputs.status = writeHeroStatusMd(failResult, false);
    throw err;
  }
  const providerConfigured = provider.isConfigured();

  const variantResults: HeroVariantRunResult[] = [];
  let skippedGenerative = true;
  let message = 'Input bundle written only.';

  if (runGenerative && providerConfigured) {
    if (provider.id === 'openai') {
      console.log('[hero] Verifying OpenAI API key...');
      await verifyOpenAiApiKey();
    }

    skippedGenerative = false;
    message = `Running generative edits via ${provider.id}.`;

    for (const variant of HERO_VARIANTS) {
      console.log(`[hero] Variant ${variant.id} — ${variant.intent}`);
      const rawPath = `${inputBundle.paths.bundleDir}/generative-raw-${variant.id}.png`;
      const outPath = heroVariantPath(variant.id, ctx.profile.code);

      try {
        const gen = await provider.generate(
          {
            profile: ctx.profile,
            bundle: inputBundle,
            sourcePath: SOURCE_OUT,
            upholstery: ctx.upholstery,
            variant,
          },
          rawPath,
        );

        const rawRgba = await loadGenerativeRgbAsRgba(
          gen.generativeRgbPath,
          ctx.source.width,
          ctx.source.height,
        );
        const blended = blendGenerativeUpholstery(
          ctx.base.image,
          rawRgba,
          ctx.upholstery,
          variant.upholsteryBlend,
        );
        const final = compositeHeroFromGenerative(ctx, blended);
        await writeHeroRgba(outPath, final);

        const qa = runHeroQa(
          ctx.source,
          ctx.base.image,
          final,
          ctx.profile,
          ctx.alpha,
          ctx.upholstery,
          ctx.legs,
        );
        console.log(`  QA: ${qa.verdict}`);

        variantResults.push({
          id: variant.id,
          label: variant.label,
          variant,
          generativeRawPath: gen.generativeRgbPath,
          outputPath: outPath,
          qa,
          providerId: gen.providerId,
          metadata: gen.metadata,
        });
      } catch (err) {
        console.error(`[hero] Variant ${variant.id} failed:`, err);
        throw err;
      }
    }
  } else if (runGenerative && !providerConfigured) {
    message =
      'Generative step skipped — configure HERO_GENERATIVE_PROVIDER=openai and OPENAI_API_KEY.';
  }

  const passing = variantResults.filter((v) => v.qa.passed);
  const best =
    passing.find((v) => v.id === 'B') ??
    passing.find((v) => v.id === 'A') ??
    (variantResults.length
      ? variantResults.reduce((a, b) => (b.qa.failures.length < a.qa.failures.length ? b : a))
      : null);

  const bestVariantId = best?.id ?? null;
  const gridPath = heroGridPath(ctx.profile.code);
  const specPath = heroSpecPath(ctx.profile.code);

  if (variantResults.length >= 2) {
    await writeHeroGrid(gridPath, [
      { path: SOURCE_OUT, label: 'SOURCE' },
      { path: ctx.base.path, label: 'BASE RECOLOR' },
      { path: variantResults[0].outputPath, label: 'HERO A' },
      { path: variantResults[1].outputPath, label: 'HERO B' },
    ]);
  }

  const specBody = {
    pipeline: 'hero-pipeline-v2',
    swatchCode: ctx.profile.code,
    profile: ctx.profile,
    providerId: provider.id,
    skippedGenerative,
    message,
    inputBundle: inputBundle.paths,
    variants: variantResults.map((v) => ({
      id: v.id,
      label: v.label,
      outputPath: v.outputPath,
      generativeRawPath: v.generativeRawPath,
      providerId: v.providerId,
      metadata: v.metadata,
      qa: v.qa,
      variantParams: v.variant,
    })),
    bestVariantId,
  };
  writeFileSync(specPath, JSON.stringify(specBody, null, 2));

  const result: HeroPipelineResult = {
    swatchCode: ctx.profile.code,
    profile: ctx.profile,
    inputBundle,
    providerId: provider.id,
    variants: variantResults,
    bestVariantId,
    outputs: {
      grid: variantResults.length >= 2 ? gridPath : '',
      spec: specPath,
      status: '',
      variantPaths: {
        A: heroVariantPath('A', ctx.profile.code),
        B: heroVariantPath('B', ctx.profile.code),
      },
      bestMaster: best ? best.outputPath : '',
    },
    skippedGenerative,
    message,
  };

  result.outputs.status = writeHeroStatusMd(result, providerConfigured);

  return result;
}
