const pc = "SAR-LUSH-MINI";
const ids = ["1179", "1074", "1056", "1069"];
const patterns = (id) => [
  `${pc}-${id}-S.jpg`,
  `${pc}-${id}S.jpg`,
  `${pc}-${id}-s.jpg`,
  `${pc}-${id}.jpg`,
  `${pc}${id}-S.jpg`,
  `${id}-S.jpg`,
  `saranoni-${id}-S.jpg`,
  `${pc}-${id}-T.jpg`,
  `${pc}-${id}T.jpg`,
];
for (const id of ids) {
  for (const pat of patterns(id)) {
    const u = `https://www.mccabestheaterandliving.com/v/vspfiles/photos/${pat}`;
    try {
      const r = await fetch(u, { method: "HEAD" });
      if (r.ok) console.log("OK", pat);
    } catch (_) {}
  }
}
