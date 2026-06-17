const https = require('https');
const url = 'https://www.mccabestheaterandliving.com/product-p/ss-gatlin-pwr-sect.htm';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
  let d = '';
  r.on('data', (c) => { d += c; });
  r.on('end', () => {
    const vers = [...d.matchAll(/mc-pdp-auth-cta-fix\.js\?v=([^"'&]+)/g)].map((m) => m[1]);
    console.log('auth-cta versions:', [...new Set(vers)]);
    const uvers = [...d.matchAll(/mc-unified-pdp-layout\.js\?v=([^"'&]+)/g)].map((m) => m[1]);
    console.log('unified versions:', [...new Set(uvers)]);
    const cssv = [...d.matchAll(/custom-safe\.css\?v=([^"'&]+)/g)].map((m) => m[1]);
    console.log('css versions:', [...new Set(cssv)]);
    const idx = d.indexOf('is-sectional-product');
    console.log('is-sectional-product contexts:', idx);
    const secClass = d.match(/class="[^"]*is-sectional-product[^"]*"/);
    console.log('html class with sectional:', secClass ? secClass[0] : 'not in static html');
    const gatlinPc = d.indexOf('SS-GATLIN-PWR-SECT');
    console.log('product code found at', gatlinPc);
    // qty input in raw html
    const qty = d.match(/name=["']QTY[^"']*["']/gi) || [];
    console.log('QTY input names:', qty.slice(0, 5));
    const unifiedReadyClass = d.match(/body[^>]*mc-pdp-unified-ready/);
    console.log('body unified ready in static:', unifiedReadyClass ? 'YES' : 'NO');
    // fetch live unified js version string
    const uurl = 'https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-unified-pdp-layout.js?v=live';
    https.get(uurl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r2) => {
      let j = '';
      r2.on('data', (c) => { j += c; });
      r2.on('end', () => {
        const lv = j.match(/LAYOUT_VER = "([^"]+)"/);
        const av = j.match(/AUTH_LAYOUT_VER = "([^"]+)"/);
        console.log('live unified LAYOUT_VER:', lv && lv[1]);
        console.log('live unified AUTH_LAYOUT_VER:', av && av[1]);
        console.log('live has scoopLooseQty:', j.includes('scoopLooseQty'));
        console.log('live isSectionalConfigurator uses isSectionalProductPage:', j.includes('isSectionalProductPage'));
      });
    });
    const aurl = 'https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=live';
    https.get(aurl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r3) => {
      let j = '';
      r3.on('data', (c) => { j += c; });
      r3.on('end', () => {
        const v = j.match(/var VERSION = "([^"]+)"/);
        console.log('live auth VERSION:', v && v[1]);
        console.log('live has shouldDeferToUnifiedPdpLayout:', j.includes('shouldDeferToUnifiedPdpLayout'));
        const m = j.match(/function ensureUnifiedPdpLayout\(\)[\s\S]{0,200}/);
        console.log('ensureUnifiedPdpLayout start:', m && m[0].replace(/\s+/g, ' ').slice(0, 180));
      });
    });
  });
});
