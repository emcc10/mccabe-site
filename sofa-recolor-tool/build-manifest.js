import { readdirSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

const SWATCH_DIR = join(ROOT, 'input', 'swatches');
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const swatches = readdirSync(SWATCH_DIR)
  .filter((f) => EXT.has(extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b))
  .map((file) => {
    const name = basename(file, extname(file));
    return {
      name,
      swatch: `input/swatches/${file}`,
      render: `output/${name}.png`,
    };
  });

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify({ swatches }, null, 2));
console.log(`Wrote manifest.json (${swatches.length} swatches)`);
