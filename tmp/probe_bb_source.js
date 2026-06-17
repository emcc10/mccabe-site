const https = require("https");
const fs = require("fs");
https
  .get(
    "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
    { headers: { "User-Agent": "Mozilla/5.0" } },
    (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        fs.writeFileSync("tmp/bb_live_source.html", d);
        console.log("len", d.length);
        console.log("options_table id", d.includes('id="options_table"'));
        console.log("SELECT___BB", /SELECT___BB/i.test(d));
        console.log("___58", d.includes("___58"));
        console.log("___4", d.includes("___4"));
        console.log("v65-product-parent", d.includes("v65-product-parent"));
        const sel = [...d.matchAll(/<select[\s\S]*?<\/select>/gi)];
        console.log("select blocks", sel.length);
        sel.slice(0, 3).forEach((s, i) => console.log("sel", i, s[0].slice(0, 200)));
      });
    }
  )
  .on("error", console.error);
