const url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm";
const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
for (const pat of [/OptionImage[^;\n]{0,120}/gi, /optionimage[^;\n]{0,120}/gi, /ProductOption[^;\n]{0,120}/gi]) {
  const m = html.match(pat);
  if (m) console.log(m[0].slice(0, 150));
}
