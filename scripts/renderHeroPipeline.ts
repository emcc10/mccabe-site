import { runHeroPipeline } from '../src/finalPipeline/hero/runHero.js';
import { DEFAULT_SWATCH_CODE } from '../src/finalPipeline/paths.js';

const swatchCode = process.argv[2]?.trim() || DEFAULT_SWATCH_CODE;

runHeroPipeline(swatchCode)
  .then((r) => {
    console.log('\n[hero] Done.');
    console.log('  bundle:', r.inputBundle.paths.bundleDir);
    console.log('  status:', r.outputs.status);
    if (r.outputs.heroMaster) {
      console.log('  hero master:', r.outputs.heroMaster);
    }
    if (r.skippedGenerative) {
      console.log('\n[hero] Generative step skipped — input bundle is ready for manual or future API integration.');
    }
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
