import fs from 'fs';

const pagePath = 'vspfiles/boards/my-boards-page.js';
const hubPath = 'vspfiles/boards/my-boards-hub.js';

let page = fs.readFileSync(pagePath, 'utf8');
if (page.includes('MERGED_BOARDS_HUB')) {
  console.log('already merged');
  process.exit(0);
}

let hub = fs.readFileSync(hubPath, 'utf8');
hub = hub
  .replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')
  .replace(/^\(function \(\) \{\s*\n\s*'use strict';\s*\n/, '')
  .replace(/\n\}\)\(\);\s*$/, '');

const inject =
  '\n  /* MERGED_BOARDS_HUB */\n  (function () {\n' +
  hub +
  '\n  })();\n\n';

const needle = '  function onReady() {';
if (!page.includes(needle)) {
  console.error('needle not found');
  process.exit(1);
}
page = page.replace(needle, inject + needle);
page = page.replace(
  /if \(!window\.MC_BOARDS_HUB\) \{\s*renderQuiz\(\);\s*renderColorWheel\(\);\s*renderTrends\(\);\s*\}/,
  '/* editorial/quiz/palette: MC_BOARDS_HUB */'
);

fs.writeFileSync(pagePath, page);
console.log('merged bytes', page.length);
