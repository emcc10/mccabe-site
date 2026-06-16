import https from "https";

const URLS = [
  "https://www.mccabestheaterandliving.com/product-p/sar-lush-xl.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm",
  "https://www.mccabestheaterandliving.com/product-p/leeds-sc-07-40.htm",
  "https://www.mccabestheaterandliving.com/product-p/charli-sc-e3-90-e4.htm",
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, html: data, loc: res.headers.location }));
      })
      .on("error", reject);
  });
}

(async () => {
  for (const url of URLS) {
    console.log("===", url);
    let { status, html, loc } = await fetch(url);
    if (status >= 300 && status < 400 && loc) {
      console.log("redirect", status, "->", loc);
      ({ status, html } = await fetch(loc.startsWith("http") ? loc : "https://www.mccabestheaterandliving.com" + loc));
    }
    console.log("status:", status, "len:", html.length);
    const pc = html.match(/name="ProductCode"[^>]*value="([^"]+)"/i);
    console.log("ProductCode:", pc ? pc[1] : "NONE");
    const bc = html.match(/vCSS_breadcrumb_td[\s\S]*?<b>([\s\S]*?)<\/b>/i);
    console.log("breadcrumb:", bc ? bc[1].replace(/\s+/g, " ").trim().slice(0, 400) : "NONE");
    const hidden = html.match(/<input[^>]+name="(?:CategoryID|categoryid|Category_Id|Categories[^"]*)"[^>]*>/gi) || [];
    hidden.forEach((h) => console.log("hidden:", h.slice(0, 220)));
    const productArea = html.match(/id="v65-product-parent"[\s\S]{0,8000}/i);
    if (productArea) {
      const ids = [...productArea[0].matchAll(/category-s\/(\d+)\.htm/gi)].map((m) => m[1]);
      console.log("category ids in product-parent:", [...new Set(ids)].join(", "));
    }
    const allHiddenInForm = html.match(/<form[^>]*id="vCSS_mainform"[\s\S]*?<\/form>/i);
    if (allHiddenInForm) {
      const h = allHiddenInForm[0].match(/<input[^>]+type="hidden"[^>]+>/gi) || [];
      h.slice(0, 20).forEach((x) => console.log("form hidden:", x.slice(0, 200)));
    }
    const atc = html.match(/<(?:input|button)[^>]*(?:btnaddtocart|BtnAddToCart)[^>]*>/gi) || [];
    atc.slice(0, 3).forEach((el) => console.log("ATC:", el.slice(0, 250)));
    console.log();
  }
})();
