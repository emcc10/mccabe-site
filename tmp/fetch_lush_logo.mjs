const url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm";
const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
for (const pat of ["manufacturers/saranoni", "vCSS_img_mfg_logo", "saranoni blankets", "itemprop=\"manufacturer\""]) {
  const i = html.toLowerCase().indexOf(pat.toLowerCase());
  console.log(pat, i >= 0 ? html.slice(Math.max(0, i - 30), i + 180).replace(/\s+/g, " ") : "NOT FOUND");
}
// shared saranoni swatch by option id only on other products
const base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos";
const ids = ["1069", "1074", "1056", "1047"];
for (const id of ids) {
  for (const pc of ["SAR-LUSH-THROW", "SAR-MINI", "SAR-LUSH-MINI", "SAR-THROW"]) {
    for (const suf of ["-S.jpg", "S.jpg", "-T.jpg"]) {
      const pat = `${pc}-${id}${suf}`;
      try {
        const r = await fetch(`${base}/${pat}`, { method: "HEAD" });
        if (r.ok) console.log("OK", pat);
      } catch (_) {}
    }
  }
}
