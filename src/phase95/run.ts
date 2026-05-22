import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { buildPhase6aBase } from '../phase6a/run.js';
import { DEBUG_DIR, PREVIEW_LOCKED_IMAGE } from '../phase1/paths.js';
import { loadImageRGBA } from '../recolor/imageIO.js';
import { PHASE9RESET_SINGLE_B } from '../phase9reset/runSingleB.js';
import { compareUpholsteryImages } from './imageCompare.js';

export const PHASE95_DIFF = join(DEBUG_DIR, 'phase95-diff.png');
export const PHASE95_DIFF_HEATMAP = join(DEBUG_DIR, 'phase95-diff-heatmap.png');
export const PHASE95_METRICS = join(DEBUG_DIR, 'phase95-metrics.json');

async function writeRgb(path: string, width: number, height: number, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

export async function runPhase95() {
  const { upholstery, image: base6a } = await buildPhase6aBase();
  const prior = await loadImageRGBA(PREVIEW_LOCKED_IMAGE);
  const current = await loadImageRGBA(PHASE9RESET_SINGLE_B);

  const cmpPrior = compareUpholsteryImages(prior, current, upholstery);
  const cmp6aOnly = compareUpholsteryImages(base6a, current, upholstery);
  const { width, height } = prior;

  await writeRgb(PHASE95_DIFF, width, height, cmpPrior.diffRgb);
  await writeRgb(PHASE95_DIFF_HEATMAP, width, height, cmpPrior.heatmapRgb);

  const body = {
    phase: '9.5',
    purpose: 'Prove or fail — measure visual delta before any more “best candidate” claims',
    priorRender: {
      id: '7C-B',
      label: 'Pre-swatch locked preview',
      path: PREVIEW_LOCKED_IMAGE,
    },
    currentRender: {
      id: '9RESET-B',
      label: 'Clean swatch stochastic apply',
      path: PHASE9RESET_SINGLE_B,
    },
    upholsteryDeltaVs7cB: cmpPrior.stats,
    perceptualSummaryVs7cB: {
      ssimOnL: cmpPrior.stats.ssimOnL,
      ssimOnRgb: cmpPrior.stats.ssimOnRgb,
      verdict: cmpPrior.verdict,
      visuallyMeaningful: cmpPrior.visuallyMeaningful,
      note: 'Pipeline-to-pipeline delta; includes non-swatch realism differences',
    },
    swatchOnlyDeltaVs6a: {
      baseline: 'Stage 4B-v3 + Phase 6A (no swatch material)',
      stats: cmp6aOnly.stats,
      verdict: cmp6aOnly.verdict,
      visuallyMeaningful: cmp6aOnly.visuallyMeaningful,
      note: 'Isolates swatch transfer contribution only',
    },
    upholsteryDelta: cmpPrior.stats,
    perceptualSummary: {
      ssimOnL: cmpPrior.stats.ssimOnL,
      ssimOnRgb: cmpPrior.stats.ssimOnRgb,
      ssimNote: '1.0 = identical; values above ~0.995 often look the same in casual review',
    },
    verdict: cmp6aOnly.visuallyMeaningful
      ? cmp6aOnly.verdict
      : `SWATCH TRIVIAL vs 6A (${cmp6aOnly.verdict}); pipeline delta vs 7C-B is separate`,
    visuallyMeaningful: cmp6aOnly.visuallyMeaningful,
    outputs: {
      diff: PHASE95_DIFF,
      heatmap: PHASE95_DIFF_HEATMAP,
      metrics: PHASE95_METRICS,
    },
  };

  writeFileSync(PHASE95_METRICS, JSON.stringify(body, null, 2));

  return { ...body, compare: cmpPrior, compare6a: cmp6aOnly };
}
