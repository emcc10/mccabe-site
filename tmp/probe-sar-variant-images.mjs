import https from "https";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      })
      .on("error", reject);
  });
}

const products = [
  ["SAR-GRAND-FX-FUR-12X20", "1036", "Fawn"],
  ["SAR-GRAND-FX-FUR", "1037", "Timberwolf"],
  ["SAR-LUSH", "1048", "Charcoal"],
  ["SAR-DBL-RCH-FX-FUR", "1048", "Charcoal"],
  ["SAR-GRAND-FX-FUR-KING", "1038", "Chinchilla"],
];

for (const [pc, oid, label] of products) {
  const page = await get(
    `https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode=${encodeURIComponent(pc)}`
  );
  const hero =
    page.body.match(/id="product_photo"[^>]*src="([^"]+)"/i)?.[1] || "";
  const tFile = `${pc}-${oid}-T.jpg`;
  const tUrl = `https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/${tFile}`;
  const tHead = await get(tUrl);
  const globalOpt = await get(
    `https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/options/${oid}-T.jpg`
  );
  console.log(`\n${pc} / ${label} (${oid})`);
  console.log(`  hero now: ${hero.split("/").pop()}`);
  console.log(`  product T (${tFile}): ${tHead.status === 200 ? "EXISTS" : "MISSING"}`);
  console.log(
    `  global option T (options/${oid}-T.jpg): ${globalOpt.status === 200 ? "EXISTS (wrong product possible)" : "missing"}`
  );
  const opts = [...page.body.matchAll(/<OPTION[^>]*value="([^"]*' + oid + '[^"]*)"[^>]*>([^<]+)/gi)];
  if (opts.length) console.log(`  option label in select: ${opts[0][2]?.trim()}`);
}
