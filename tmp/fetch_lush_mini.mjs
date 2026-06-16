const url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm";
const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
const imgs = [...new Set([...html.matchAll(/SAR-LUSH-MINI[^"']*\.jpg/gi)].map((m) => m[0]))];
console.log("imgs", imgs.slice(0, 30));
const sels = [...html.matchAll(/name="(SELECT___[^"]+)"/g)].map((m) => m[1]);
console.log("selects", sels);
for (const m of html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/g)) {
  const val = m[1].trim();
  const text = m[2].replace(/\s+/g, " ").trim();
  if (val && !/^(--|please|select|choose)/i.test(text)) console.log("opt", val, text);
}
// probe swatch urls
const ids = ["2", "1069", "1074", "1056", "1013"];
for (const id of ids) {
  for (const pat of [
    `SAR-LUSH-MINI-${id}-S.jpg`,
    `SAR-LUSH-MINI-${id}S.jpg`,
    `SAR-LUSH-MINI-${id}-T.jpg`,
    `SAR-LUSH-MINI-${id}T.jpg`,
  ]) {
    const u = `https://www.mccabestheaterandliving.com/v/vspfiles/photos/${pat}`;
    const r = await fetch(u, { method: "HEAD" });
    if (r.ok) console.log("OK", pat);
  }
}
