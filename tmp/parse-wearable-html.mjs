import fs from "fs";

const html = await (await fetch("https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm")).text();
fs.writeFileSync("tmp/wearable-live.html", html);

const hits = [...html.matchAll(/mc-pdp[^"'\\s<>]*/gi)].map((m) => m[0]);
console.log("mc-pdp hits", [...new Set(hits)].slice(0, 50));

const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
console.log("script count", scripts.length);
scripts.filter((s) => /pdp|saranoni|auth|cta|unified|custom/i.test(s)).forEach((s) => console.log("S", s));

for (const needle of ["SAR-WEARABLE", "0.00-T", "product_photo", "altviews", "1049"]) {
  const i = html.indexOf(needle);
  console.log("\nneedle", needle, "idx", i);
  if (i >= 0) console.log(html.slice(Math.max(0, i - 180), i + 280));
}
