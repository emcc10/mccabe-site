const https = require('https');
const urls = [
  'https://www.mccabestheaterandliving.com/product-p/ss-gatlin-pwr-sect.htm',
  'https://www.mccabestheaterandliving.com/product-p/gatlin-dual-power-leather-sectional.htm',
];
const markers = [
  'btnaddtocart', 'mc-pdp-unified-ready', 'mc-unified-purchase-controls',
  '20260617pdp64', 'GATLIN', 'is-sectional-product', 'mc-pdp-qty-row',
  'mc-unified-pdp-layout', 'shouldDeferToUnifiedPdpLayout', 'scoopLooseQty',
];
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => resolve({ status: r.statusCode, html: d }));
    }).on('error', reject);
  });
}
(async () => {
  for (const url of urls) {
    console.log('\n===', url);
    try {
      const { status, html } = await fetch(url);
      console.log('status', status, 'len', html.length);
      const pc = html.match(/name=["']ProductCode["'][^>]*value=["']([^"']+)/i)
        || html.match(/value=["']([^"']+)["'][^>]*name=["']ProductCode/i);
      console.log('ProductCode:', pc ? pc[1] : 'N/A');
      for (const m of markers) {
        console.log(`  ${m}:`, html.toLowerCase().includes(m.toLowerCase()) ? 'YES' : 'NO');
      }
      console.log('  atc count:', (html.match(/btnaddtocart/gi) || []).length);
      const css = html.match(/custom-safe\.css[^"']*/);
      if (css) console.log('  css:', css[0].slice(0, 80));
      const js = html.match(/mc-pdp-auth-cta-fix\.js[^"']*/);
      if (js) console.log('  js:', js[0].slice(0, 80));
    } catch (e) {
      console.log('ERR', e.message);
    }
  }
})();
