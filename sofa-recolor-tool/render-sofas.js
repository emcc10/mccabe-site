/**
 * Automated batch recolor has been removed (over-corrected / posterized results).
 * Use the manual tool instead:
 *
 *   npm run manual
 *
 * Open http://127.0.0.1:3457/manual-recolor.html
 */
console.error(`
Automated sofa recolor is disabled.

Use the manual control tool:
  cd sofa-recolor-tool
  npm run manual

Then open manual-recolor.html in your browser.
`);
process.exit(1);
