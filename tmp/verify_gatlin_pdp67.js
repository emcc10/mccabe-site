const https = require('https');
const SITE = 'https://www.mccabestheaterandliving.com';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    }).on('error', reject);
  });
}

(async () => {
  const url = SITE + '/product-p/ss-gatlin-pwr-sect.htm';
  console.log('Gatlin URL:', url);
  const page = await get(url);
  const p67 = page.body.includes('20260617pdp67');
  const u16 = page.body.includes('20260617unified16');
  console.log('template references pdp67:', p67 ? 'YES' : 'NO');
  console.log('template references unified16:', u16 ? 'YES' : 'NO');

  const auth = await get(SITE + '/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=20260617pdp67');
  const ver = auth.body.match(/var VERSION = "([^"]+)"/);
  console.log('live auth pdp67 VERSION:', ver && ver[1]);
  console.log('has isFixedSectionalUnifiedPdp:', auth.body.includes('isFixedSectionalUnifiedPdp'));
  console.log('has prepareDeferredUnifiedPdpHero:', auth.body.includes('prepareDeferredUnifiedPdpHero'));

  const unified = await get(SITE + '/v/vspfiles/js/mc-unified-pdp-layout.js?v=20260617unified16');
  const lv = unified.body.match(/LAYOUT_VER = "([^"]+)"/);
  console.log('live unified LAYOUT_VER:', lv && lv[1]);
  console.log('has mcPrepareUnifiedPdpHero call:', unified.body.includes('mcPrepareUnifiedPdpHero'));
})();
