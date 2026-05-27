import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { runPreviewPipeline } from '../src/finalPipeline/preview/runPreview.js';
import { writeTwoPanelComparison } from '../src/finalPipeline/preview/cleanupV2Comparison.js';
import {
  bestPreviewPath,
  DEFAULT_SWATCH_CODE,
  FINAL_PIPELINE_DIR,
  previewV3ComparisonPath,
  previewV3MasterPath,
} from '../src/finalPipeline/paths.js';

const swatchCode = process.argv[2]?.trim() || DEFAULT_SWATCH_CODE;
const currentMaster = bestPreviewPath(swatchCode);
const v3Master = previewV3MasterPath(swatchCode);
const comparison = previewV3ComparisonPath(swatchCode);
const currentBackup = `${FINAL_PIPELINE_DIR}/.preview-v3-current-backup-${swatchCode.replace(/\s+/g, '-')}.png`;

async function main() {
  if (existsSync(currentMaster)) {
    mkdirSync(dirname(currentBackup), { recursive: true });
    copyFileSync(currentMaster, currentBackup);
    console.log(`[preview-v3] Saved current preview for comparison: ${currentBackup}`);
  }

  console.log(`[preview-v3] Running preview pipeline with base-stage v3 fixes (${swatchCode})…`);
  const result = await runPreviewPipeline(swatchCode, { writeExportCopy: true, reuseSharedAssets: false });

  if (!result.outputs.bestMaster || result.allVariantsFailed) {
    console.error('[preview-v3] Pipeline failed — no best master.');
    process.exitCode = 2;
    return;
  }

  copyFileSync(result.outputs.bestMaster, v3Master);

  const left = existsSync(currentBackup) ? currentBackup : result.outputs.bestMaster;
  await writeTwoPanelComparison(comparison, left, v3Master, 'CURRENT PREVIEW', 'PREVIEW V3');

  console.log('\n[preview-v3] Done.');
  console.log('  v3 master:', v3Master);
  console.log('  comparison:', comparison);
  console.log('  base recolor:', result.baseRecolor);
  console.log('  debug spec: public/product-assets/TEST-SOFA/final-pipeline/preview-fix-spec-v3.json');
  console.log('  best variant:', result.bestVariantId);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
