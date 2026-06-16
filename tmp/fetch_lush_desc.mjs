const url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm";
const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
const descStart = html.indexOf("ProductDetail_ProductDetails");
console.log("desc area imgs:");
const chunk = html.slice(descStart, descStart + 15000);
for (const m of chunk.matchAll(/<img[^>]+>/gi)) console.log(m[0].slice(0, 250));
console.log("\nall swatch mentions:");
for (const m of html.matchAll(/swatch[^"'\s]{0,30}/gi)) {
  const s = m[0];
  if (s.length < 40) console.log(s);
}
console.log("\nSoft blanket context:");
const i = html.indexOf("Soft blanket");
console.log(html.slice(i - 200, i + 300).replace(/\s+/g, " "));
