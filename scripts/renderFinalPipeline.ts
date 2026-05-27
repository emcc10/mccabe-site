import { runFinalPipeline } from '../src/finalPipeline/run.js';
import { DEFAULT_SWATCH_CODE } from '../src/finalPipeline/paths.js';

const swatchCode = process.argv[2]?.trim() || DEFAULT_SWATCH_CODE;

runFinalPipeline(swatchCode)
  .then((r) => {
    console.log('\n[final-pipeline] Done.');
    console.log('  base recolor:', r.baseRecolor);
    console.log('  best variant:', r.bestVariantId ?? 'NONE');
    console.log('  master:', r.outputs.bestMaster || '(none)');
    console.log('  status:', r.outputs.status);
    console.log('  metrics:', r.outputs.qaMetrics);
    if (r.allVariantsFailed) {
      console.warn('\n[final-pipeline] No variant passed integrity QA — see status file.');
      process.exitCode = 2;
    } else if (!r.variants.find((v) => v.id === r.bestVariantId)?.compare.visuallyMeaningful) {
      console.warn('\n[final-pipeline] Best variant selected but realism delta is still subtle/trivial — see status file.');
    }
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
