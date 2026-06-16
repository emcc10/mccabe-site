import https from "https";

const url = "https://www.mccabestheaterandliving.com/product-p/sar-jl-jl-msln-lush.htm";
const html = await new Promise((resolve, reject) => {
  https
    .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    })
    .on("error", reject);
});

const start = html.indexOf('id="v65-product-parent"');
const end = html.indexOf("related_products_content", start);
const chunk = html.slice(start, end > start ? end : start + 200000);
console.log("chunk len", chunk.length);
for (const id of ["205", "206", "207", "208", "209", "196"]) {
  console.log(id, chunk.includes(id));
}
console.log("breadCrumb in chunk", (chunk.match(/breadCrumb[^"]*"([^"]*)"/) || [])[1]);
