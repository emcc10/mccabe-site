const base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos";
const ids = ["1069", "1074", "1056", "1013", "1014", "1047"];
const patterns = (id) => [
  `color-${id}-S.jpg`,
  `Color-${id}-S.jpg`,
  `SAR-COLOR-${id}-S.jpg`,
  `Saranoni-${id}-S.jpg`,
  `SARANONI-${id}-S.jpg`,
  `option-${id}-S.jpg`,
  `Option${id}-S.jpg`,
  `sn-${id}-S.jpg`,
  `${id}.jpg`,
  `swatch-${id}.jpg`,
];
for (const id of ids) {
  for (const pat of patterns(id)) {
    try {
      const r = await fetch(`${base}/${pat}`, { method: "HEAD" });
      if (r.ok) console.log("OK", pat);
    } catch (_) {}
  }
}
