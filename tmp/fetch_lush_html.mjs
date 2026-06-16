const url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm";
const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
const logoIdx = html.indexOf("vCSS_img_mfg_logo");
console.log("logo idx", logoIdx);
if (logoIdx >= 0) console.log(html.slice(logoIdx - 20, logoIdx + 200));
const selIdx = html.indexOf("SELECT___SAR-LUSH-MINI");
console.log("select idx", selIdx);
if (selIdx >= 0) console.log(html.slice(selIdx, selIdx + 1200));
// Volusion option image pattern
for (const m of html.matchAll(/optionimage[^"']*["']([^"']+)["']/gi)) console.log("optimg", m[1]);
for (const m of html.matchAll(/SAR-LUSH-MINI[^"'\s>]+\.(jpg|png|webp)/gi)) {
  console.log("img ref", m[0]);
}
