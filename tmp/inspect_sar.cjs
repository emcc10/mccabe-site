const https = require("https");
https.get(
  "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm",
  { headers: { "User-Agent": "Mozilla/5.0" } },
  (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => {
      const ids = [
        "v65-product-related",
        "altviews",
        "ProductDetail_ProductDetails_div",
        "mc-pdp-features",
        "mc-pdp-description-below-features",
        "mc-bean-bag-pdp",
      ];
      ids.forEach((id) => {
        const re = new RegExp('id="' + id + '"', "i");
        console.log(id, re.test(d) ? "yes" : "no");
      });
      const i = d.indexOf("v65-product-related");
      console.log("\n--- related context ---\n");
      console.log(d.slice(Math.max(0, i - 400), i + 800));
      const j = d.indexOf('id="product_photo"');
      console.log("\n--- photo ---\n");
      console.log(d.slice(j, j + 500));
      const k = d.indexOf("altviews");
      console.log("\n--- altviews ---\n");
      console.log(k >= 0 ? d.slice(k, k + 400) : "none");
    });
  }
);
