import https from "https";

const url = "https://www.mccabestheaterandliving.com/product-p/sar-jl-jl-msln-lush.htm";
const html = await new Promise((resolve, reject) => {
  https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => resolve(d));
  }).on("error", reject);
});

for (const id of ["205", "206", "207", "208", "209", "196"]) {
  const idx = html.indexOf(id);
  console.log("id", id, idx >= 0 ? "found at " + idx : "NOT");
  if (idx >= 0) {
    console.log(" ", html.slice(Math.max(0, idx - 60), idx + 60).replace(/\s+/g, " "));
  }
}
