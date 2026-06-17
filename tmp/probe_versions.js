const https = require('https');
const urls = [
  '/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=20260616pdp53',
  '/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=20260617pdp64',
  '/v/vspfiles/css/custom-safe.css?v=20260616pdp53',
];
const SITE = 'https://www.mccabestheaterandliving.com';
for (const path of urls) {
  https.get(SITE + path, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
    let d = '';
    r.on('data', (c) => { d += c; });
    r.on('end', () => {
      console.log('\n', path, 'status', r.statusCode, 'len', d.length);
      if (path.includes('auth-cta')) {
        const v = d.match(/var VERSION = "([^"]+)"/);
        console.log('  VERSION', v && v[1]);
        console.log('  shouldDefer', d.includes('shouldDeferToUnifiedPdpLayout'));
        console.log('  ensureUnified blocks sectional', /ensureUnifiedPdpLayout\(\)[\s\S]{0,80}isSectionalPdpPage/.test(d));
      }
      if (path.includes('custom-safe')) {
        console.log('  orphan qty hide', d.includes('td.mc-unified-pdp-info > #mc-pdp-qty-row'));
        console.log('  unified purchase styles', d.includes('.mc-unified-purchase-controls'));
      }
    });
  });
}
