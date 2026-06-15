const https = require("https");
https.get(
  "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm",
  { headers: { "User-Agent": "Mozilla/5.0" } },
  (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => {
      const i = d.indexOf('id="ProductDetail_ProductDetails_div"');
      console.log(d.slice(Math.max(0, i - 1200), i + 600));
    });
  }
);
