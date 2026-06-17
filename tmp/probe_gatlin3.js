const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}
(async () => {
  const html = await get('https://www.mccabestheaterandliving.com/product-p/ss-gatlin-pwr-sect.htm');
  const title = (html.match(/<title>([^<]+)/i) || [])[1];
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
  console.log('title:', title);
  console.log('h1 text:', h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120));
  const path = '/product-p/ss-gatlin-pwr-sect.htm';
  const pc = 'SS-GATLIN-PWR-SECT';
  console.log('path has -sc-:', path.includes('-sc-'));
  console.log('pc has -sc-:', /-sc-/i.test(pc));
  console.log('title sectional configuration:', /sectional\s+configuration/i.test(' ' + title.toLowerCase()));
  try {
    const cfgJs = await get('https://www.mccabestheaterandliving.com/v/vspfiles/js/sectional-configs.js?v=live');
    const keys = [...cfgJs.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map((m) => m[1]).filter((k) => k.length > 2);
    const gatlinKeys = keys.filter((k) => /gatlin/i.test(k));
    console.log('MTL keys matching gatlin:', gatlinKeys);
    const identityHay = (path + ' ' + title + ' ' + pc).toLowerCase();
    const sorted = keys.slice().sort((a, b) => b.length - a.length);
    const matches = sorted.filter((mk) => {
      const esc = mk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('\\b' + esc + '\\b', 'i').test(identityHay);
    });
    console.log('identityHay matches MTL keys:', matches.slice(0, 10));
  } catch (e) {
    console.log('cfg err', e.message);
  }
  // Check baked styleFixedSectional in page
  console.log('styleFixedSectional in page:', html.includes('styleFixedSectional'));
  console.log('tagPdpCells in page:', html.includes('tagPdpCells'));
  console.log('mc-fixed-sectional-pdp in page:', html.includes('mc-fixed-sectional-pdp'));
})();
