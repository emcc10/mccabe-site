const base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles";
const paths = [
  "photos/manufacturers/saranoni%20blankets.jpg",
  "photos/manufacturers/saranoni blankets.jpg",
  "photos/Saranoni-1069-S.jpg",
  "photos/1069-S.jpg",
  "photos/options/1069.jpg",
  "photos/options/1069-S.jpg",
  "photos/SAR-1069-S.jpg",
  "swatches/1069.jpg",
  "swatches/saranoni/1069.jpg",
  "swatches/saranoni/blossom.jpg",
  "photos/Blossom-S.jpg",
  "photos/SAR-BLOSSOM-S.jpg",
];
for (const p of paths) {
  try {
    const r = await fetch(`${base}/${p}`, { method: "HEAD" });
    if (r.ok) console.log("OK", p);
  } catch (_) {}
}
// try main site path for mfg logo
for (const p of [
  "/v/vspfiles/photos/manufacturers/saranoni%20blankets.jpg",
  "/v/vspfiles/photos/manufacturers/saranoni blankets.jpg",
]) {
  try {
    const r = await fetch(`https://www.mccabestheaterandliving.com${p}`, { method: "HEAD" });
    console.log(p, r.status);
  } catch (e) {
    console.log(p, "fail");
  }
}
