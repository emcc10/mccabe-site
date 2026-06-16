const url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm";
const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
console.log("mfg logo", html.includes("vCSS_img_mfg_logo"));
const m = html.match(/vCSS_img_mfg_logo[^>]+src="([^"]+)"/);
console.log("logo src", m && m[1]);
const opts = [...html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g)]
  .filter((x) => x[1] && !/^(--|please|select)/i.test(x[2]))
  .slice(0, 5);
console.log("sample opts", opts.map((x) => [x[1], x[2].trim()]));
const store = html.match(/global_Config_StoreFolderName\s*=\s*'([^']+)'/);
console.log("store", store && store[1]);
// probe swatch patterns for first 3 colors
const base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos";
const names = ["Blossom", "Aubergine", "Ballet Slipper"];
const ids = ["1069", "1074", "1056"];
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const name = names[i].toLowerCase().replace(/\s+/g, "-");
  for (const pat of [
    `SAR-LUSH-MINI-${id}-S.jpg`,
    `SAR-LUSH-MINI-${id}S.jpg`,
    `Saranoni-${name}-S.jpg`,
    `saranoni-${name}.jpg`,
    `${id}-S.jpg`,
  ]) {
    try {
      const r = await fetch(`${base}/${pat}`, { method: "HEAD" });
      if (r.ok) console.log("OK", pat);
    } catch (_) {}
  }
}
