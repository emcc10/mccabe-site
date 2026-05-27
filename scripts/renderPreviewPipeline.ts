import { runPreviewPipeline } from '../src/finalPipeline/preview/runPreview.js';
import { DEFAULT_SWATCH_CODE } from '../src/finalPipeline/paths.js';

const swatchCode = process.argv[2]?.trim() || DEFAULT_SWATCH_CODE;

runPreviewPipeline(swatchCode, { writeExportCopy: true })
  .then((r) => {
    console.log('\n[preview] Done.');
    console.log('  base recolor:', r.baseRecolor);
    console.log('  best variant:', r.bestVariantId ?? 'NONE');
    console.log('  preview master:', r.outputs.bestMaster || '(none)');
    console.log('  status:', r.outputs.status);
    console.log('  metrics:', r.outputs.qaMetrics);
    if (r.allVariantsFailed) {
      console.warn('\n[preview] No variant passed integrity QA — see status file.');
      process.exitCode = 2;
    } else if (!r.variants.find((v) => v.id === r.bestVariantId)?.compare.visuallyMeaningful) {
      console.warn('\n[preview] Best variant is integrity-safe but material delta is still subtle — use hero path for catalog finals.');
    }
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
