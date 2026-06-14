const https = require("https");
https.get(
  "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
  { headers: { "User-Agent": "Mozilla/5.0" } },
  (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => {
      const i = d.indexOf('id="v65-product-parent"');
      console.log(d.slice(i, i + 12000));
    });
  }
);
