import https from "https";

const url = "https://www.mccabestheaterandliving.com/SearchResults.asp?Cat=205&Page=1";
const html = await new Promise((resolve, reject) => {
  https
    .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    })
    .on("error", reject);
});

const hits = [
  "sar-jl-jl-msln-lush",
  "sar-lush",
  "sar-wearable",
  "sar-dbl-rch",
  "sar-plsh",
];
for (const h of hits) {
  console.log(h, html.toLowerCase().includes(h) ? "YES" : "no");
}
