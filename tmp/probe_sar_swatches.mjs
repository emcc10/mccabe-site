const base = "https://www.mccabestheaterandliving.com";
const colors = ["blossom", "bloom", "navy", "charcoal", "aubergine", "ballet-slipper", "balletslipper", "feather", "fern"];
const prefixes = [
  "/v/vspfiles/swatches/saranoni/{c}.jpg",
  "/v/vspfiles/swatches/saranoni/{c}.png",
  "/v/vspfiles/swatches/luxe/{c}.jpg",
  "/v/vspfiles/swatches/lush/{c}.jpg",
  "/v/vspfiles/swatches/blankets/{c}.jpg",
  "/v/vspfiles/images/saranoni/{c}.jpg",
  "/v/vspfiles/photos/saranoni-{c}.jpg",
  "/v/vspfiles/photos/SAR-LUSH-MINI-{c}.jpg",
  "/v/vspfiles/photos/SAR-{c}-S.jpg",
];
for (const c of colors) {
  for (const pat of prefixes) {
    const url = base + pat.replace("{c}", c);
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) console.log("OK", url);
    } catch (_) {}
  }
}
