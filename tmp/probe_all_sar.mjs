const bases = [
  "https://www.mccabestheaterandliving.com/v/vspfiles/photos",
  "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos",
  "https://www.mccabestheaterandliving.com/v/vspfiles/images",
];
const ids = ["1069", "1074", "1056", "1179"];
const pcs = ["SAR-LUSH-MINI", "SAR-LUSH-THROW", "SAR-MINI", "SAR-DBL-RCH-FX-FUR", "SAR-CHNK-KNT-LG"];
for (const base of bases) {
  for (const id of ids) {
    for (const pc of pcs) {
      for (const pat of [`${pc}-${id}-S.jpg`, `${pc}-${id}-T.jpg`]) {
        try {
          const r = await fetch(`${base}/${pat}`, { method: "HEAD" });
          if (r.ok) console.log("OK", base.split("/")[2], pat);
        } catch (_) {}
      }
    }
  }
}
