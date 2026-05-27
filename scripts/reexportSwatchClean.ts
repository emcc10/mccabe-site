import { runSwatchClean } from '../src/finalPipeline/swatchClean.js';
import { DEFAULT_SWATCH_CODE } from '../src/finalPipeline/paths.js';
import { getSwatchProfile } from '../src/finalPipeline/swatchProfiles.js';

const code = process.argv[2]?.trim() || DEFAULT_SWATCH_CODE;

runSwatchClean(getSwatchProfile(code))
  .then((r) => {
    console.log('\n[swatch-clean] Exported:');
    console.log('  clean base:', r.paths.cleanBase);
    console.log('  validation:', r.paths.validationJson);
    console.log('  ok:', r.validation.ok);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
