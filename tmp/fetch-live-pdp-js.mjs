import fs from "fs";

const page = await (await fetch("https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm")).text();
const scripts = [...page.matchAll(/src=["']([^"']*mc-pdp-auth[^"']*)["']/gi)].map((m) => m[1]);
console.log("scripts", scripts);

const abs = scripts.map((s) => (s.startsWith("http") ? s : new URL(s, "https://www.mccabestheaterandliving.com").href));
for (const u of abs) {
  console.log("fetching", u);
  const js = await (await fetch(u)).text();
  fs.writeFileSync("tmp/live-mc-pdp-auth.js", js);
  console.log("saved bytes", js.length);

  // Find image filename construction near productCode + option
  const needles = [
    "fileNames.push(productCode",
    "-T.jpg",
    "optionId",
    "0.00",
    "vspfiles/photos/",
  ];
  for (const n of needles) {
    let i = 0;
    let c = 0;
    while ((i = js.indexOf(n, i)) >= 0 && c < 5) {
      console.log("\n=== hit", n, "at", i, "===");
      console.log(js.slice(Math.max(0, i - 400), i + 350));
      i += n.length;
      c++;
    }
  }
}
