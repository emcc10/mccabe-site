const https = require("https");
const url = process.argv[2] || "https://www.mccabestheaterandliving.com/product-p/bb-faux-leather.htm";
https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
  let d = "";
  r.on("data", (c) => (d += c));
  r.on("end", () => {
    console.log("url", url);
    console.log("options_table", d.includes('id="options_table"'));
    const sels = [...d.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)];
    console.log("select count", sels.length);
    sels.forEach(([full, name, inner]) => {
      if (!/___/.test(name)) return;
      console.log("\nSELECT", name);
      [...inner.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/gi)].slice(0, 12).forEach((m) => {
        console.log(" ", m[2].trim(), "=>", m[1]);
      });
    });
  });
});
