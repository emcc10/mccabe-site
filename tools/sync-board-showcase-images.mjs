/**
 * Copy chat-uploaded product PNGs into vspfiles/boards/showcase/ with stable names.
 * Run from repo root: node tools/sync-board-showcase-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const srcDir =
  process.env.MC_BOARD_ASSETS_DIR ||
  path.join(
    repoRoot,
    '..',
    '..',
    '..',
    '.cursor',
    'projects',
    'c-Users-erink-OneDrive-Documents-GitHub-mccabe-site',
    'assets'
  );
const destDir = path.join(repoRoot, 'vspfiles', 'boards', 'showcase');

const files = [
  ['77696-02-Lux-Cognac-Front-Angle-1-a422fd20', 'mid-century-lux-cognac-chair-angle.png'],
  ['77696-02-Lux-Cognac-Front-c6e22647', 'mid-century-lux-cognac-chair-front.png'],
  ['40113-L6-London-Fog-Angle-1-2-4d4ff6fe', 'transitional-london-fog-sofa-angle.png'],
  ['41500_L6_pos1-819b30a1', 'transitional-cognac-recliner-front.png'],
  ['41500_L6_angle-f1683d8b', 'transitional-cognac-recliner-angle.png'],
  ['77176-A1-Coachella-Madeira-Front-323155c3', 'transitional-coachella-madeira-sofa-front.png'],
  ['77176-A1-Coachella-Madeira-Front-Angle-1-291ce545', 'transitional-coachella-madeira-sofa-angle.png'],
  ['77180-01-Lux-Match-Pacific-Front-Angle-1-f0f5743d', 'modern-pacific-charcoal-sofa-angle.png'],
  ['77180-03-Lux-Match-Pacific-Front-Angle-1-2b3c4dcf', 'modern-pacific-charcoal-loveseat-angle.png'],
  ['41067-L6-Bali-Match-Carob-Angle-1-1-ca5de41a', 'traditional-carob-recliner-angle.png'],
  ['41067-L6-Bali-Match-Carob-Angle-1-2-284592ad', 'traditional-carob-recliner-recline.png'],
  ['41067-L6-Bali-Match-Carob-Front_4-78eee533', 'traditional-carob-recliner-front.png'],
  ['40109-L6-Evoque-Match-Atlantic-VM-Angle-1-3-00fc40b2', 'contemporary-atlantic-navy-recliner-angle.png'],
  ['40109-L6-Evoque-Match-Atlantic-VM-Front-c85bda6c', 'contemporary-atlantic-navy-recliner-front.png']
];

if (!fs.existsSync(srcDir)) {
  console.error('Source assets folder not found:', srcDir);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
const names = fs.readdirSync(srcDir);
let ok = 0;

for (const [key, out] of files) {
  const hit = names.find((n) => n.includes(key));
  if (!hit) {
    console.warn('MISSING', out);
    continue;
  }
  fs.copyFileSync(path.join(srcDir, hit), path.join(destDir, out));
  ok++;
}

console.log(`Copied ${ok}/${files.length} → ${destDir}`);
