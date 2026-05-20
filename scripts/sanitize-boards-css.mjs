/**
 * Strip non-ASCII from boards CSS (Firefox NS_ERROR_CORRUPTED_CONTENT on bad bytes).
 * Rebuild bundle. Run before deploy: node scripts/sanitize-boards-css.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const boards = path.join(root, 'vspfiles', 'boards');

const files = ['my-boards-page.css', 'my-boards-critical.css'];

function asciiOnly(text) {
  return text
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

for (const name of files) {
  const file = path.join(boards, name);
  const raw = fs.readFileSync(file, 'utf8');
  const out = asciiOnly(raw);
  if (out !== raw) {
    fs.writeFileSync(file, out, 'utf8');
    console.log('sanitized', name);
  }
}

const bundle =
  '/* McCabe My Boards bundle - ASCII only */\n' +
  fs.readFileSync(path.join(boards, 'my-boards-critical.css'), 'utf8') +
  '\n' +
  fs.readFileSync(path.join(boards, 'my-boards-page.css'), 'utf8');
fs.writeFileSync(path.join(boards, 'my-boards-bundle.css'), bundle, 'utf8');
console.log('wrote my-boards-bundle.css', bundle.length, 'bytes');
