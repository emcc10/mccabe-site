import https from "https";
import crypto from "crypto";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            len: buf.length,
            hash: crypto.createHash("md5").update(buf).digest("hex"),
          });
        });
      })
      .on("error", reject);
  });
}

const base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/";
const files = [
  "SAR-BMB-SOCKS-2T.jpg",
  "SAR-BMB-SOCKS-1048-T.jpg",
  "SAR-BMB-SOCKS-1048-S.jpg",
  "SAR-LUSH-1048-T.jpg",
  "SAR-BMB-HATS-1048-T.jpg",
];
for (const f of files) {
  const m = await fetch(base + f);
  console.log(f, m.status, m.len, m.hash);
}

const shop = await fetch("https://saranoni.com/products/bamboni-socks.json");
console.log("\nshopify status", shop.status);
