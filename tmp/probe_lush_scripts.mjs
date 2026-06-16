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

const patterns = [
  /Category[^;\n]{0,120}/gi,
  /breadCrumb[^;\n]+/gi,
  /ProductCategor[^;\n]+/gi,
  /\|205\|/g,
  /assigned[^;\n]{0,80}/gi,
];

for (const pat of patterns) {
  const ms = [...html.matchAll(pat)].slice(0, 8);
  if (ms.length) {
    console.log("\nPATTERN", pat);
    ms.forEach((m) => console.log(" ", m[0].slice(0, 160)));
  }
}

// scripts near product form only
const formIdx = html.indexOf('id="v65-product-parent"');
const chunk = html.slice(formIdx, formIdx + 150000);
const scripts = [...chunk.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log("\nScripts in product area:", scripts.length);
scripts.slice(0, 15).forEach((s, i) => {
  const t = s[1].trim();
  if (/categor|bread|205|196|208/i.test(t)) {
    console.log("\n--- script", i, "---");
    console.log(t.slice(0, 500));
  }
});
