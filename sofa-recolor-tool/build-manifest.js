import { readdirSync, writeFileSync, existsSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SWATCH_DIR = join(ROOT, 'input', 'swatches');
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SWATCH_ID_PATTERN = /^[a-z]+-[a-z]+\.(jpe?g|png|webp)$/i;
const SWATCH_BLOCK_PATTERN = /^(debug|test|chip|palette|cache|flat|target|color-)/i;

function isOriginalSwatchFile(filename) {
  const base = basename(filename);
  if (SWATCH_BLOCK_PATTERN.test(base)) return false;
  return SWATCH_ID_PATTERN.test(base);
}

if (!existsSync(SWATCH_DIR)) {
  console.error(`Missing: ${SWATCH_DIR}`);
  process.exit(1);
}

const swatches = readdirSync(SWATCH_DIR)
  .filter((f) => EXT.has(extname(f).toLowerCase()) && isOriginalSwatchFile(f))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  .map((file) => {
    const name = basename(file, extname(file));
    return {
      name,
      swatch: `input/swatches/${file}`,
      render: `output/${name}.png`,
    };
  });

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify({ swatches }, null, 2));
console.log(`Wrote manifest.json (${swatches.length} swatches from input/swatches only)`);
