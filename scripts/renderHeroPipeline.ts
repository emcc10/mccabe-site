import { runHeroPipeline } from '../src/finalPipeline/hero/runHero.js';
import { DEFAULT_SWATCH_CODE } from '../src/finalPipeline/paths.js';

const swatchCode = process.argv[2]?.trim() || DEFAULT_SWATCH_CODE;

runHeroPipeline(swatchCode)
  .then((r) => {
    console.log('\n[hero] Done.');
    console.log('  bundle:', r.inputBundle.paths.bundleDir);
    console.log('  spec:', r.outputs.spec);
    console.log('  status:', r.outputs.status);
    if (r.outputs.grid) console.log('  grid:', r.outputs.grid);
    for (const v of r.variants) {
      console.log(`  variant ${v.id}: ${v.outputPath} — ${v.qa.verdict}`);
    }
    if (r.outputs.bestMaster) console.log('  best:', r.outputs.bestMaster);
    if (r.skippedGenerative) {
      console.warn('\n[hero] Generative skipped — set HERO_GENERATIVE_PROVIDER=openai and OPENAI_API_KEY.');
      process.exitCode = 2;
    } else if (r.variants.some((v) => !v.qa.passed)) {
      console.warn('\n[hero] One or more variants failed QA — see hero-status file.');
    }
  })
  .catch((err) => {
    if (err instanceof Error && err.name === 'OpenAIApiError') {
      console.error('\n[hero] OpenAI authentication failed.\n');
      console.error(err.message);
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  });
