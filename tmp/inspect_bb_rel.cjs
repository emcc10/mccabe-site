const https = require("https");
function fetch(url, cb) {
  https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => cb(d));
  });
}
fetch("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", (d) => {
  const i = d.indexOf("v65-product-related");
  console.log("bb related:", i >= 0 ? "yes" : "no");
  if (i >= 0) console.log(d.slice(i - 500, i + 400));
  const j = d.indexOf("ProductDetail_ProductDetails_div");
  console.log("\nbb desc at", j);
  console.log(d.slice(j - 200, j + 200));
});
