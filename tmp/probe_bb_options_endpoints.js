const https = require("https");
const urls = [
  "https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode=BB-FAUX-FUR",
  "https://www.mccabestheaterandliving.com/ajax/product_options.asp?ProductCode=BB-FAUX-FUR",
  "https://www.mccabestheaterandliving.com/v/shop/productoptions.asp?ProductCode=BB-FAUX-FUR",
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve({ url, status: r.statusCode, len: d.length, body: d }));
      })
      .on("error", reject);
  });
}

(async () => {
  for (const url of urls) {
    try {
      const r = await fetch(url);
      console.log("\n===", url, "status", r.status, "len", r.len);
      console.log("options_table", r.body.includes('id="options_table"'));
      const names = [...r.body.matchAll(/SELECT___BB-FAUX-FUR[^"'<\s]*/gi)].map((m) => m[0]);
      console.log("select names", [...new Set(names)]);
      const sels = [...r.body.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)];
      sels.forEach(([_, name, inner]) => {
        if (!/BB-FAUX|___/.test(name)) return;
        console.log("SELECT", name);
        [...inner.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/gi)].forEach((m) => {
          console.log(" ", m[2].trim(), "=>", m[1]);
        });
      });
      if (!sels.length) console.log("snippet", r.body.slice(0, 400).replace(/\s+/g, " "));
    } catch (e) {
      console.error(url, e.message);
    }
  }
})();
