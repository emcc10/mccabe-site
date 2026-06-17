const https = require('https');
const fs = require('fs');
const path = require('path');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

(async () => {
  const html = await fetch('https://www.mccabestheaterandliving.com/product-p/ss-gatlin-pwr-sect.htm');
  const out = path.join(__dirname, 'gatlin-live.html');
  fs.writeFileSync(out, html);
  console.log('saved', html.length, out);

  const checks = {
    product_photo: /id=["']product_photo["']/i.test(html),
    btnaddtocart: /name=["']btnaddtocart["']/i.test(html),
    mc_pdp_features: /id=["']mc-pdp-features["']/i.test(html),
    mc_pdp_purchase_stack: /id=["']mc-pdp-purchase-stack["']/i.test(html),
    mc_unified_purchase: /mc-unified-purchase-controls/i.test(html),
    mc_pdp_qty_row: /id=["']mc-pdp-qty-row["']/i.test(html),
    tagPdpCells: /function tagPdpCells/i.test(html),
    styleFixedSectional: /function styleFixedSectional/i.test(html),
    pdp53: /20260616pdp53/i.test(html),
    pdp64: /20260617pdp64/i.test(html),
  };
  console.log(checks);

  const atcIdx = html.search(/name=["']btnaddtocart["']/i);
  console.log('ATC context:', html.slice(Math.max(0, atcIdx - 200), atcIdx + 300).replace(/\s+/g, ' '));
})();
