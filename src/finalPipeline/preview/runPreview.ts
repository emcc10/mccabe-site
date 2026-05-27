import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { FINAL_PIPELINE_DIR } from '../paths.js';
import { buildSharedRenderContext } from '../shared/context.js';
import { buildBaseRecolor } from '../baseRecolor.js';
import { runSwatchClean } from '../swatchClean.js';
import { runPrep } from '../prep.js';
import { buildUpholsteryRegionMaps, writeRegionDebug } from '../regionLogic.js';
import { applyRealismVariant } from '../applyRealism.js';
import {
  buildVariantResult,
  runArtifactChecks,
  writeAggregateQa,
  writeVariantQaOutputs,
} from '../qa.js';
import {
  copyBestMaster,
  pickBestVariant,
  writeBestComparison,
  writeFinalGrid,
  writeStatusMarkdown,
} from '../finalize.js';
import { getSwatchProfile, REALISM_VARIANTS } from '../swatchProfiles.js';
import type { FinalPipelineResult as PreviewPipelineResult } from '../spec.js';
import { buildPreviewExportManifest, previewExportDestPath } from './exportPreview.js';

export interface RunPreviewOptions {
  /** Skip stages 1–3 if shared assets already exist on disk (faster re-runs). */
  reuseSharedAssets?: boolean;
  /** Copy best master to stable preview-export-{SWATCH}.png */
  writeExportCopy?: boolean;
}

/**
 * Deterministic preview pipeline (Stages 1–7).
 * Fast, reusable batch previews — not final-photo hero quality.
 */
export async function runPreviewPipeline(
  swatchCode: string,
  options: RunPreviewOptions = {},
): Promise<PreviewPipelineResult> {
  mkdirSync(FINAL_PIPELINE_DIR, { recursive: true });
  const profile = getSwatchProfile(swatchCode);

  let ctx;
  if (options.reuseSharedAssets) {
    console.log(`[preview] Reusing shared context where possible (${profile.code})`);
    const prep = await runPrep();
    const base = await buildBaseRecolor(profile);
    const swatch = await runSwatchClean(profile);
    ctx = {
      profile,
      prep,
      base,
      swatch,
      source: prep.source,
      alpha: prep.alpha,
      upholstery: prep.upholstery,
      legs: prep.legs,
    };
  } else {
    console.log(`[preview] Building shared context (${profile.code})`);
    ctx = await buildSharedRenderContext(swatchCode);
  }

  if (!ctx.prep.validation.ok) {
    console.warn('[preview] Prep warnings:', ctx.prep.validation.messages);
  }

  console.log('[preview] Stage 4 — region logic');
  const regionMaps = buildUpholsteryRegionMaps(
    ctx.source,
    ctx.upholstery,
    ctx.alpha,
    ctx.legs,
    ctx.profile.highlightSoftness,
  );
  const regionDebug = await writeRegionDebug(ctx.source, ctx.upholstery, regionMaps);

  console.log('[preview] Stage 5 — deterministic material variants A/B/C');
  const variants = [];
  for (const spec of REALISM_VARIANTS) {
    const { image, path, params } = await applyRealismVariant(
      ctx.profile,
      spec,
      ctx.base.image,
      ctx.source,
      ctx.upholstery,
      ctx.swatch.material,
      regionMaps.applyWeight,
    );
    const { compare } = await writeVariantQaOutputs(
      ctx.base.image,
      image,
      ctx.upholstery,
      ctx.profile.code,
      spec.id,
    );
    const qa = runArtifactChecks(
      ctx.source,
      ctx.base.image,
      image,
      ctx.alpha,
      ctx.upholstery,
      ctx.legs,
      compare,
    );
    variants.push(buildVariantResult(spec.id, spec.label, path, params, qa, compare));
    console.log(
      `  variant ${spec.id}: mean|ΔL|=${compare.stats.meanAbsDeltaL.toFixed(2)} meaningful=${compare.visuallyMeaningful} failures=${qa.failures.length}`,
    );
  }

  const variantSpread = Math.abs(
    variants[variants.length - 1].compare.meanAbsDeltaL - variants[0].compare.meanAbsDeltaL,
  );
  const variantsTooClose = variantSpread < 0.35;
  if (variantsTooClose) {
    console.warn(
      `[preview] Variants A/B/C are very close (spread mean|ΔL|=${variantSpread.toFixed(2)}).`,
    );
  }

  console.log('[preview] Stage 6 — QA aggregate');
  const best = pickBestVariant(variants);
  const qaAgg = await writeAggregateQa(ctx.profile.code, ctx.base.image, best, variants, ctx.upholstery);

  console.log('[preview] Stage 7 — finalize');
  const grid = await writeFinalGrid(
    ctx.profile,
    ctx.base.path,
    variants.map((v) => ({ id: v.id, path: v.path })),
  );

  let bestMaster = '';
  let bestComparison = '';
  if (best) {
    bestMaster = await copyBestMaster(best, ctx.profile);
    bestComparison = await writeBestComparison(ctx.profile, ctx.base.path, bestMaster);
    if (options.writeExportCopy !== false) {
      const exportPath = previewExportDestPath(ctx.profile.code);
      mkdirSync(FINAL_PIPELINE_DIR, { recursive: true });
      await sharp(bestMaster).png().toFile(exportPath);
    }
  }

  const status = writeStatusMarkdown(
    ctx.profile,
    best,
    variants,
    variantsTooClose,
    ctx.prep.validation.ok,
  );

  const result: PreviewPipelineResult = {
    swatchCode: ctx.profile.code,
    profile: ctx.profile,
    prep: ctx.prep.paths,
    baseRecolor: ctx.base.path,
    swatchOutputs: ctx.swatch.paths,
    regionDebug,
    variants,
    bestVariantId: best?.id ?? null,
    outputs: {
      grid,
      bestMaster,
      bestComparison,
      qaDiff: qaAgg.diffPath,
      qaHeatmap: qaAgg.heatmapPath,
      qaMetrics: qaAgg.metricsPath,
      status,
    },
    allVariantsFailed: !best,
  };

  const metricsBody = {
    ...JSON.parse(readFileSync(qaAgg.metricsPath, 'utf8')),
    pipeline: 'preview-pipeline-v1',
    profile: ctx.profile,
    prepValidation: ctx.prep.validation,
    baseRecolorParams: ctx.base.params,
    variantsTooClose,
    variantSpreadMeanAbsDeltaL: variantSpread,
    previewExport: buildPreviewExportManifest(ctx, result),
  };
  writeFileSync(qaAgg.metricsPath, JSON.stringify(metricsBody, null, 2));

  return result;
}
