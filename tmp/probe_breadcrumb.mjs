import https from "https";

const URLS = [
  "https://www.mccabestheaterandliving.com/product-p/leeds-sc-07-40.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-jl-jl-msln-lush.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-plsh-fx-fur-xl-lg.htm",
  "https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm",
  "https://www.mccabestheaterandliving.com/product-p/bb-nest.htm",
  "https://www.mccabestheaterandliving.com/product-p/77743-01.htm",
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

for (const url of URLS) {
  const html = await fetch(url);
  const slug = url.split("/").pop();
  const crumbs = [...html.matchAll(/var breadCrumb\s*=\s*"([^"]*)"/g)];
  console.log("\n===", slug, "===");
  crumbs.forEach((m, i) => console.log(" breadCrumb[" + i + "]:", m[1]));
  const canon = html.match(/rel="canonical" href="([^"]+)"/i);
  console.log(" canonical:", canon ? canon[1] : "NONE");
}
