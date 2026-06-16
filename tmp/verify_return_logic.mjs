import https from "https";

const RETURN_CATEGORY_DEPTH = {
  188: 3, 198: 2, 139: 1, 196: 1, 205: 2, 208: 2,
};

function pickMostSpecific(ids) {
  let best = ids[0];
  let bestDepth = RETURN_CATEGORY_DEPTH[best] || 0;
  for (let i = 1; i < ids.length; i++) {
    const depth = RETURN_CATEGORY_DEPTH[ids[i]] || 0;
    if (depth > bestDepth) {
      best = ids[i];
      bestDepth = depth;
    }
  }
  return best;
}

function resolveLuxe(blob) {
  if (/wearable|robe|snuggler|snuggle/.test(blob)) return "208";
  if (/\bbaby\b/.test(blob)) return "207";
  if (/\bkid/.test(blob)) return "206";
  if (/waffle|sheet|bedding|duvet|pillowcase|pillow case/.test(blob)) return "209";
  return "205";
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

const urls = [
  ["leeds-sc-07-40", "https://www.mccabestheaterandliving.com/product-p/leeds-sc-07-40.htm"],
  ["sar-jl-jl-msln-lush", "https://www.mccabestheaterandliving.com/product-p/sar-jl-jl-msln-lush.htm"],
  ["sar-wearable", "https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm"],
];

for (const [slug, url] of urls) {
  const html = await fetch(url);
  const raw = (html.match(/var breadCrumb\s*=\s*"([^"]*)"/) || [])[1] || "";
  const ids = raw.split("|").filter((p) => /^\d+$/.test(p));
  let pick = pickMostSpecific(ids);
  if (pick === "196" && ids.length === 1) {
    const title = (html.match(/itemprop="name"[^>]*>([^<]+)/) || [])[1] || "";
    const pc = (html.match(/name="ProductCode"[^>]*value="([^"]+)"/) || [])[1] || "";
    pick = resolveLuxe((title + " " + pc).toLowerCase());
  }
  console.log(slug, "breadCrumb=", raw, "=> category id", pick);
}
