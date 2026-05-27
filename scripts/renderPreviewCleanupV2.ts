import { DEFAULT_SWATCH_CODE } from '../src/finalPipeline/paths.js';
import { runPreviewCleanupV2 } from '../src/finalPipeline/preview/cleanupV2.js';
import { getSwatchProfile } from '../src/finalPipeline/swatchProfiles.js';

const code = process.argv[2]?.trim() || DEFAULT_SWATCH_CODE;

async function main() {
  const profile = getSwatchProfile(code);
  console.log(`[cleanup-v2] Surgical pass — ${profile.code}`);
  const result = await runPreviewCleanupV2(profile);
  console.log('[cleanup-v2] Done');
  console.log(`  master:     ${result.masterPath}`);
  console.log(`  comparison: ${result.comparisonPath}`);
  console.log(`  debug rail: ${result.debugBottomPath}`);
  console.log(`  debug legs: ${result.debugLegPath}`);
  console.log(`  spec:       ${result.specPath}`);
  console.log(
    `  bottom lines: detect mask=${result.spec.bottomLine.detectionMaskPixels}px weights=${result.spec.bottomLine.detectionWeightPixels}px, touched=${result.spec.bottomLine.pixelsTouched}, ΔL ${result.spec.bottomLine.meanLBefore.toFixed(2)} → ${result.spec.bottomLine.meanLAfter.toFixed(2)}`,
  );
  console.log(
    `  leg zone: ${result.spec.legZone.pixelsContaminated} contaminated, ${result.spec.legZone.pixelsTouched}px repaired`,
  );
  console.log(
    `  integrity: feetΔ=${result.spec.integrity.feetPixelsChanged} bgΔ=${result.spec.integrity.backgroundPixelsChanged} outside=${result.spec.integrity.pixelsChangedOutsideZones}`,
  );
  if (result.spec.integrity.pixelsChangedOutsideZones > 200) {
    console.warn('[cleanup-v2] WARNING: edits leaked outside cleanup zones');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
