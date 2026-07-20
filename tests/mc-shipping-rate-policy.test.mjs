import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../vspfiles/js/mc-shipping-rate-policy.js", import.meta.url), "utf8");
const zipSource = fs.readFileSync(new URL("../vspfiles/js/mc-white-glove-zip-tiers-data.js", import.meta.url), "utf8");
const window = {
  addEventListener() {},
  location: { pathname: "/shoppingcart.asp" },
};
vm.runInNewContext(zipSource, { window });
vm.runInNewContext(source, { window, document: null });

const policy = window.__MC_SHIPPING_RATE_POLICY__;
const summarize = policy.summarizeCart;
const allowed = (label, lines, zip = "") => policy.isRateAllowed(label, summarize(lines), zip);

const beanBag = [{ code: "BB-CHENILLE", quantity: 1, total: 309 }];
assert.equal(allowed("Free Shipping for Bean Bags", beanBag), true);
assert.equal(allowed("White Glove Delivery", beanBag, "75033"), false);
assert.equal(allowed("Saranoni Free Shipping", beanBag), false);
assert.equal(allowed("Ground Shipping", beanBag), false);

const qualifyingSaranoni = [{ code: "SAR-DBL-RCH-FX-FUR", quantity: 1, total: 129 }];
assert.equal(allowed("Saranoni Free Shipping", qualifyingSaranoni), true);
assert.equal(allowed("Free Shipping for Bean Bags", qualifyingSaranoni), false);
assert.equal(allowed("White Glove Delivery", qualifyingSaranoni, "75033"), false);
assert.equal(allowed("Ground Shipping", qualifyingSaranoni), false);

const smallSaranoni = [{ code: "SAR-SOCKS", quantity: 1, total: 24 }];
assert.equal(allowed("Ground Shipping", smallSaranoni), true);
assert.equal(allowed("Saranoni Free Shipping", smallSaranoni), false);
assert.equal(allowed("White Glove Delivery", smallSaranoni, "75033"), false);

const furniture = [{ code: "SS-AB100", quantity: 1, total: 899 }];
assert.equal(allowed("White Glove Delivery", furniture, "75033"), true);
assert.equal(allowed("White Glove Delivery", furniture, "78701"), false);
assert.equal(allowed("Standard Freight", furniture, "78701"), true);
assert.equal(allowed("Free Shipping for Bean Bags", furniture), false);

const mixedFurniture = [beanBag[0], furniture[0]];
assert.equal(allowed("Free Shipping for Bean Bags", mixedFurniture), false);
assert.equal(allowed("White Glove Delivery", mixedFurniture, "75033"), true);

const mixedFree = [beanBag[0], qualifyingSaranoni[0]];
assert.equal(allowed("Free Shipping for Bean Bags", mixedFree), false);
assert.equal(allowed("Saranoni Free Shipping", mixedFree), true);
assert.equal(allowed("White Glove Delivery", mixedFree, "75033"), false);

assert.equal(policy.productFamily("XL-CHINCHILLA"), "beanBag");
assert.equal(policy.isDfwZip("75033-1234"), true);
assert.equal(policy.isDfwZip("78701"), false);

const forneyQuote = policy.whiteGloveQuote("75126");
assert.equal(forneyQuote.eligible, true);
assert.equal(forneyQuote.basePrice, 199);
assert.equal(forneyQuote.weightSurcharge, 0);
assert.equal(forneyQuote.total, forneyQuote.basePrice + forneyQuote.directionSurcharge);

const southEntry = Object.entries(window.__MC_WHITE_GLOVE_ZIP_TIERS__.zips).find(([, entry]) => entry.direction === "south");
assert.ok(southEntry, "expected at least one south-of-Forney ZIP");
const southQuote = policy.whiteGloveQuote(southEntry[0], 25);
assert.equal(southQuote.directionSurcharge, 55);
assert.equal(southQuote.weightSurcharge, 25);
assert.equal(southQuote.total, southQuote.basePrice + 55 + 25);

assert.equal(policy.whiteGloveQuote("73301"), null);

const expectedBasePrices = { "1-25": 199, "26-40": 249, "41-60": 299 };
for (const tier of Object.keys(expectedBasePrices)) {
  for (const direction of ["north", "south"]) {
    const match = Object.entries(window.__MC_WHITE_GLOVE_ZIP_TIERS__.zips).find(
      ([, entry]) => entry.tier === tier && entry.direction === direction
    );
    assert.ok(match, `expected a ${direction} ZIP in tier ${tier}`);
    const quote = policy.whiteGloveQuote(match[0]);
    assert.equal(quote.basePrice, expectedBasePrices[tier]);
    assert.equal(quote.directionSurcharge, direction === "south" ? 55 : 0);
    assert.equal(quote.total, expectedBasePrices[tier] + (direction === "south" ? 55 : 0));
  }
}

for (const entry of Object.values(window.__MC_WHITE_GLOVE_ZIP_TIERS__.zips)) {
  assert.ok(entry.distanceMiles <= 60, `ZIP entry exceeds service radius: ${entry.distanceMiles}`);
}

console.log("mc-shipping-rate-policy: all tests passed");
