import https from "https";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

const pc = "SAR-JL-JL-MSLN-LUSH";
const urls = [
  `https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode=${encodeURIComponent(pc)}`,
  `https://www.mccabestheaterandliving.com/product-p/sar-jl-jl-msln-lush.htm`,
];

for (const url of urls) {
  const html = await fetch(url);
  console.log("\n===", url.split(".com")[1].slice(0, 80), "===");
  console.log("breadCrumb:", (html.match(/var breadCrumb\s*=\s*"([^"]*)"/) || [])[1]);
  const hiddens = html.match(/<input[^>]+type="hidden"[^>]+>/gi) || [];
  hiddens.forEach((h) => {
    if (/categor|cat/i.test(h)) console.log(" ", h);
  });
  for (const needle of ["|205|", "205,", ",205", "Cat=205", "categoryids", "CategoryIDs"]) {
    if (html.includes(needle)) console.log("contains", needle);
  }
}
