import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { FINAL_PIPELINE_DIR } from './paths.js';
import { DEFAULT_SWATCH_CODE } from './paths.js';
import { runPrep } from './prep.js';
import { buildBaseRecolor } from './baseRecolor.js';
import { runSwatchClean } from './swatchClean.js';
import { buildUpholsteryRegionMaps, writeRegionDebug } from './regionLogic.js';
import { applyRealismVariant } from './applyRealism.js';
import {
  buildVariantResult,
  runArtifactChecks,
  writeAggregateQa,
  writeVariantQaOutputs,
} from './qa.js';
import {
  copyBestMaster,
  pickBestVariant,
  writeBestComparison,
  writeFinalGrid,
  writeStatusMarkdown,
} from './finalize.js';
import { getSwatchProfile, REALISM_VARIANTS } from './swatchProfiles.js';
import type { FinalPipelineResult } from './spec.js';

export async function runFinalPipeline(swatchCode = DEFAULT_SWATCH_CODE): Promise<FinalPipelineResult> {
  mkdirSync(FINAL_PIPELINE_DIR, { recursive: true });
  const profile = getSwatchProfile(swatchCode);

  console.log(`[final-pipeline] Stage 1 — prep (${profile.code})`);
  const prep = await runPrep();
  if (!prep.validation.ok) {
    console.warn('[final-pipeline] Prep warnings:', prep.validation.messages);
  }

  console.log('[final-pipeline] Stage 2 — base recolor');
  const base = await buildBaseRecolor(profile);

  console.log('[final-pipeline] Stage 3 — swatch sanitize + material maps');
  const swatch = await runSwatchClean(profile);

  console.log('[final-pipeline] Stage 4 — region logic');
  const regionMaps = buildUpholsteryRegionMaps(
    prep.source,
    prep.upholstery,
    prep.alpha,
    prep.legs,
    profile.highlightSoftness,
  );
  const regionDebug = await writeRegionDebug(prep.source, prep.upholstery, regionMaps);

  console.log('[final-pipeline] Stage 5 — realism variants A/B/C');
  const variants = [];
  for (const spec of REALISM_VARIANTS) {
    const { image, path, params } = await applyRealismVariant(
      profile,
      spec,
      base.image,
      prep.source,
      prep.upholstery,
      swatch.material,
      regionMaps.applyWeight,
    );
    const { compare } = await writeVariantQaOutputs(
      base.image,
      image,
      prep.upholstery,
      profile.code,
      spec.id,
    );
    const qa = runArtifactChecks(
      prep.source,
      base.image,
      image,
      prep.alpha,
      prep.upholstery,
      prep.legs,
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
      `[final-pipeline] Variants A/B/C are very close (spread mean|ΔL|=${variantSpread.toFixed(2)}) — may not be materially distinguishable.`,
    );
  }

  console.log('[final-pipeline] Stage 6 — QA aggregate');
  const best = pickBestVariant(variants);
  const qaAgg = await writeAggregateQa(profile.code, base.image, best, variants, prep.upholstery);

  console.log('[final-pipeline] Stage 7 — finalize');
  const grid = await writeFinalGrid(
    profile,
    base.path,
    variants.map((v) => ({ id: v.id, path: v.path })),
  );

  let bestMaster = '';
  let bestComparison = '';
  if (best) {
    bestMaster = await copyBestMaster(best, profile);
    bestComparison = await writeBestComparison(profile, base.path, bestMaster);
  }

  const status = writeStatusMarkdown(
    profile,
    best,
    variants,
    variantsTooClose,
    prep.validation.ok,
  );

  const allVariantsFailed = !best;

  const result: FinalPipelineResult = {
    swatchCode: profile.code,
    profile,
    prep: prep.paths,
    baseRecolor: base.path,
    swatchOutputs: swatch.paths,
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
    allVariantsFailed,
  };

  const metricsBody = {
    ...JSON.parse(readFileSync(qaAgg.metricsPath, 'utf8')),
    pipeline: 'final-pipeline-v1',
    profile,
    prepValidation: prep.validation,
    baseRecolorParams: base.params,
    variantsTooClose,
    variantSpreadMeanAbsDeltaL: variantSpread,
  };
  writeFileSync(qaAgg.metricsPath, JSON.stringify(metricsBody, null, 2));

  return result;
}
