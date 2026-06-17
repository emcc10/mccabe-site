const https = require("https");
https
  .get(
    "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
    { headers: { "User-Agent": "Mozilla/5.0" } },
    (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        const auth = d.match(/mc-pdp-auth-cta-fix\.js\?v=([^"&]+)/);
        const css = d.match(/custom-safe\.css\?v=([^"&]+)/);
        console.log("auth", auth && auth[1]);
        console.log("css", css && css[1]);
        const selects = [...d.matchAll(/select[^>]*name=["']([^"']+)["']/gi)].map((x) => x[1]);
        console.log("selects", selects);
        console.log("has ___58", d.includes("___58"));
        console.log("has ___4", d.includes("___4"));
        const ot = d.indexOf("id=\"options_table\"");
        if (ot >= 0) console.log("options_table snippet", d.slice(ot, ot + 3000).replace(/\s+/g, " ").slice(0, 1500));
      });
    }
  )
  .on("error", console.error);
