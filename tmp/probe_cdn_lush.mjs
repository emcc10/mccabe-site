const base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos";
const ids = ["1069", "1074", "1056", "1179", "2"];
for (const id of ids) {
  for (const pat of [`SAR-LUSH-MINI-${id}-S.jpg`, `SAR-LUSH-MINI-${id}-T.jpg`, `SAR-LUSH-MINI-${id}S.jpg`]) {
    try {
      const r = await fetch(`${base}/${pat}`, { method: "HEAD" });
      if (r.ok) console.log("OK CDN", pat);
    } catch (_) {}
  }
}
