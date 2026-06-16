const base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos";
for (const id of ["1069", "1074", "1056", "1013", "1014"]) {
  for (const pat of [`${id}-S.jpg`, `color-${id}-S.jpg`, `SAR-${id}-S.jpg`]) {
    try {
      const r = await fetch(`${base}/${pat}`, { method: "HEAD" });
      if (r.ok) console.log("OK", pat);
    } catch (_) {}
  }
}
