(function (g, d) {
  "use strict";

  var VERSION = "20260801ship14";
  var SARANONI_FREE_THRESHOLD = 99;
  var SHIPPING_REQUIRED_MSG = "Please select a shipping method before placing your order.";

  var RATE_TYPES = {
    beanBagFree: /(?:bean\s*bag|\bbb\b).{0,35}free|free.{0,35}(?:bean\s*bag|\bbb\b)/i,
    saranoniFree: /saranoni.{0,35}free|free.{0,35}saranoni/i,
    // Live Volusion method labels are "Free Curbside Delivery" / "Free curbside delivery!",
    // not "White Glove" - the old pattern never matched them, so they fell through to the
    // unfiltered "standard" bucket below and showed for every cart regardless of zip/eligibility.
    whiteGlove: /white\s*glove|local\s+(?:white\s*glove\s+)?delivery|curbside\s*delivery/i,
    genericFree: /(?:^|\s)free\s+shipping(?:\s|$)/i,
  };

  function normalizeCode(value) {
    return String(value || "")
      .replace(/%2d/gi, "-")
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  function productFamily(code) {
    var normalized = normalizeCode(code);
    if (/^SAR-/.test(normalized)) return "saranoni";
    if (/^BB-/.test(normalized) || normalized === "XL-CHINCHILLA") return "beanBag";
    return "other";
  }

  function money(value) {
    var parsed = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
    return isFinite(parsed) ? parsed : 0;
  }

  function normalizeZip(value) {
    var match = String(value || "").match(/\b(\d{5})(?:-\d{4})?\b/);
    return match ? match[1] : "";
  }

  function zipTierData() {
    return g.__MC_WHITE_GLOVE_ZIP_TIERS__ || null;
  }

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.7613;
    var toRad = function (deg) { return (deg * Math.PI) / 180; };
    var p1 = toRad(lat1), p2 = toRad(lat2);
    var dphi = toRad(lat2 - lat1);
    var dlmb = toRad(lon2 - lon1);
    var a = Math.sin(dphi / 2) * Math.sin(dphi / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) * Math.sin(dlmb / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function findTier(distance, tiers) {
    for (var i = 0; i < (tiers || []).length; i++) {
      if (distance <= tiers[i].maxMiles) return tiers[i];
    }
    return null;
  }

  // Live fallback: only used when a ZIP isn't in the curated static table below. Verified
  // against the 2025 Census Gazetteer (the same source the static table was generated from) -
  // the static table is complete for its 70mi radius today, so this path is a safety net
  // against future drift (newly created ZIPs), not a fix for a known gap. Reproduces the exact
  // tier-boundary rule (distance <= tier.maxMiles) and direction/surcharge rule (south of
  // Forney's latitude = southSurcharge) observed in all 354 existing entries with zero
  // mismatches.
  function computeLiveEntry(zip) {
    var data = zipTierData();
    var fallback = g.__MC_ZIP_LATLON_FALLBACK__;
    var coords = fallback && fallback[zip];
    if (!data || !data.forney || !coords) return null;
    var dist = haversineMiles(data.forney.latitude, data.forney.longitude, coords[0], coords[1]);
    var tier = findTier(dist, data.tiers);
    if (!tier) return null;
    var direction = coords[0] < data.forney.latitude ? "south" : "north";
    var surcharge = direction === "south" ? money(data.southSurcharge) : 0;
    return {
      distanceMiles: Math.round(dist * 10) / 10,
      direction: direction,
      tier: tier.id,
      basePrice: tier.basePrice,
      directionSurcharge: surcharge,
      priceBeforeWeight: tier.basePrice + surcharge,
    };
  }

  function whiteGloveQuote(value, weightSurcharge) {
    var zip = normalizeZip(value);
    var data = zipTierData();
    var entry = data && zip ? data.zips[zip] : null;
    if (!entry && zip) entry = computeLiveEntry(zip);
    if (!entry) return null;
    var extra = Math.max(0, money(weightSurcharge));
    return {
      zip: zip,
      eligible: true,
      distanceMiles: entry.distanceMiles,
      direction: entry.direction,
      tier: entry.tier,
      basePrice: entry.basePrice,
      directionSurcharge: entry.directionSurcharge,
      weightSurcharge: extra,
      total: entry.priceBeforeWeight + extra,
    };
  }

  function isDfwZip(value) {
    return !!whiteGloveQuote(value, 0);
  }

  // Raw straight-line miles from Forney for a ZIP, independent of the (stale) tier/price
  // bucketing above. Live Volusion method labels embed their own mileage brackets directly
  // (e.g. "Local White Glove Delivery (26-40 Miles from Forney, TX)"), so bracket selection is
  // done by parsing those labels and comparing against this raw distance - not by matching the
  // old tiers array, which no longer matches what's actually configured in Volusion.
  function distanceMilesForZip(value) {
    var zip = normalizeZip(value);
    if (!zip) return null;
    var data = zipTierData();
    var entry = data && data.zips[zip];
    if (entry) return entry.distanceMiles;
    var live = computeLiveEntry(zip);
    return live ? live.distanceMiles : null;
  }

  // Extracts an inclusive mile range from a label like
  // "Local White Glove Delivery (26-40 Miles from Forney, TX) $249". Options without an
  // embedded range (flat-rate methods such as the unranged "White Glove Delivery $205") return
  // null and are left alone by the bracket check below.
  function parseMileRange(label) {
    var m = String(label || "").match(/\(\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*miles?\s+from\s+forney/i);
    if (!m) return null;
    return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
  }

  function rateType(label) {
    var text = String(label || "").replace(/\s+/g, " ").trim();
    if (RATE_TYPES.beanBagFree.test(text)) return "beanBagFree";
    if (RATE_TYPES.saranoniFree.test(text)) return "saranoniFree";
    if (RATE_TYPES.whiteGlove.test(text)) return "whiteGlove";
    if (RATE_TYPES.genericFree.test(text)) return "genericFree";
    return "standard";
  }

  function summarizeCart(lines) {
    var summary = {
      lineCount: 0,
      beanBagCount: 0,
      saranoniCount: 0,
      otherCount: 0,
      saranoniSubtotal: 0,
    };

    (lines || []).forEach(function (line) {
      var family = productFamily(line && line.code);
      var quantity = Math.max(1, parseInt(line && line.quantity, 10) || 1);
      var total = money(line && line.total);
      summary.lineCount += 1;
      if (family === "beanBag") summary.beanBagCount += 1;
      else if (family === "saranoni") {
        summary.saranoniCount += 1;
        summary.saranoniSubtotal += total || money(line && line.unitPrice) * quantity;
      } else summary.otherCount += 1;
    });

    summary.onlyBeanBags = summary.beanBagCount > 0 && summary.saranoniCount === 0 && summary.otherCount === 0;
    summary.onlySaranoni = summary.saranoniCount > 0 && summary.beanBagCount === 0 && summary.otherCount === 0;
    summary.onlyFreeFamilies = summary.beanBagCount > 0 && summary.saranoniCount > 0 && summary.otherCount === 0;
    summary.saranoniQualifies = summary.saranoniSubtotal >= SARANONI_FREE_THRESHOLD;
    return summary;
  }

  function isRateAllowed(label, summary, zip, hasRangedWhiteGlove) {
    var text = String(label || "").replace(/\s+/g, " ").trim();
    // Junk/blank Volusion method entries (e.g. option value 927) should never render as a
    // selectable choice, no matter what's in the cart.
    if (!text) return false;

    // "PLEASE SELECT" is a placeholder, not a delivery method. Hiding it leaves the browser
    // with no neutral choice, which forced the auto-selector below to commit a REAL method on
    // the customer's behalf. Always keep it available.
    if (isPlaceholderLabel(text)) return true;

    var type = rateType(label);
    var cart = summary || summarizeCart([]);

    if (cart.onlyBeanBags) return type === "beanBagFree" || type === "genericFree";

    if (cart.onlySaranoni) {
      if (type === "beanBagFree" || type === "whiteGlove") return false;
      if (cart.saranoniQualifies) return type === "saranoniFree" || type === "genericFree";
      return type === "standard";
    }

    if (cart.onlyFreeFamilies) {
      if (type === "whiteGlove" || type === "beanBagFree") return false;
      if (cart.saranoniQualifies) return type === "saranoniFree" || type === "genericFree";
      return type === "standard";
    }

    if (type === "beanBagFree" || type === "saranoniFree" || type === "genericFree") return false;
    if (type === "whiteGlove") {
      var range = parseMileRange(label);
      // Flat-rate white-glove options with no mileage bracket in their label (e.g. the plain
      // "White Glove Delivery $205" entry) are legacy/duplicate methods ONLY when proper
      // mileage-bracketed options also exist for this same cart - hide it then. But some
      // product lines (loveseats/recliners) have ONLY an unranged option ("Free curbside
      // delivery!") with no bracketed siblings at all - for those, the unranged option IS
      // the real (only) delivery method and must stay visible.
      if (!range) return !hasRangedWhiteGlove;

      // Keep ranged brackets visible before a ZIP is entered.
      if (!normalizeZip(zip)) return true;

      var dist = distanceMilesForZip(zip);
      // Can't resolve a distance for this ZIP at all: don't show a specific mileage bracket
      // that we can't confirm applies.
      if (dist === null) return false;

      // THE BRACKET GAP. Labels are whole miles ("1-25", "26-40", "41-60") but real ZIP
      // distances are fractional. Comparing a fraction against integer bounds leaves dead
      // zones between every bracket: 25.4mi is >25 so it fails "1-25", and <26 so it fails
      // "26-40" - every white glove option disappears and only freight remains. That silently
      // stranded 16 ZIPs in the table, including Plano 75075 (25.5), Allen 75002 (25.6),
      // Dallas 75248 (25.4), DeSoto 75115 (25.9) and Flower Mound 75028 (40.8) - core DFW
      // suburbs. Comparing whole miles against whole-mile labels closes the gaps exactly:
      // 25.4 -> 25 (first bracket), 25.6 -> 26 (second). No bracket can be skipped.
      var miles = Math.round(dist);
      // Lowest bracket's floor is treated as 0 so a customer essentially at Forney still
      // qualifies for the nearest tier instead of matching nothing.
      var effectiveMin = range.min <= 1 ? 0 : range.min;
      return miles >= effectiveMin && miles <= range.max;
    }
    return true;
  }

  // Volusion writes non-product rows into the order summary using the same markup as real
  // line items: discounts ("DSC-49" - the free shipping promo), gift certificates, and similar.
  // Counting one as a product silently poisons the whole cart summary: a Saranoni-only order
  // gains a phantom "other" item, onlySaranoni flips to false, and the Saranoni free shipping
  // option gets hidden from the customer who actually earned it.
  function isNonProductCode(code) {
    return /^(DSC|DISC|GC|GIFTCERT|COUPON)[-_]/i.test(String(code || ""));
  }

  function codeFromHref(href) {
    var text = String(href || "");
    var match = text.match(/[?&]ProductCode=([^&#]+)/i);
    if (!match) match = text.match(/\/product-p\/([^/?#]+)\.html?/i);
    if (!match) return "";
    try {
      return normalizeCode(decodeURIComponent(match[1]));
    } catch (e) {
      return normalizeCode(match[1]);
    }
  }

  function readCartLines(root) {
    if (!root || !root.querySelectorAll) return [];
    var seen = {};
    var lines = [];

    // Shopping cart page: line items are linked back to the product page.
    root.querySelectorAll('a[href*="ProductCode=" i], a[href*="/product-p/" i]').forEach(function (link) {
      var code = codeFromHref(link.getAttribute("href"));
      if (!code || isNonProductCode(code)) return;
      var row = link.closest("tr") || link.closest("li") || link.parentElement;
      if (!row) return;
      var key = code + "|" + String(row.rowIndex || lines.length);
      if (seen[key]) return;
      seen[key] = true;

      var qtyInput = row.querySelector('input[name^="QTY" i], input[id="qty"], input[name*="quantity" i]');
      var prices = (row.textContent || "").match(/\$\s*[0-9,]+(?:\.\d{2})?/g) || [];
      lines.push({
        code: code,
        quantity: qtyInput ? qtyInput.value : 1,
        unitPrice: prices.length ? prices[0] : 0,
        total: prices.length > 1 ? prices[prices.length - 1] : prices[0] || 0,
      });
    });

    // One-page checkout order summary: no links, just plain-text cells
    // (<td class="v65-onepage-ordersummary-itemcode">CODE</td> etc). This is why the
    // policy previously no-opped on checkout - readCartLines() found nothing here at all.
    root.querySelectorAll(".v65-onepage-ordersummary-itemcode").forEach(function (cell) {
      // The column HEADER row reuses this exact class ("Code" / "Total" labels) with an
      // additional "v65-onepage-ordersummary-header" class on the cell. Without this guard
      // the literal text "Code" gets read as a phantom product with code "CODE", which
      // normalizeCode/productFamily then buckets into the "other" family - silently
      // poisoning onlyBeanBags/onlySaranoni/onlyFreeFamilies for every cart on this page
      // (a bean-bag-only cart stops looking bean-bag-only, so the auto free-shipping
      // option gets hidden along with everything else, leaving no valid shipping choice
      // at all). Skip any header cell/row before reading a code from it.
      if (cell.classList.contains("v65-onepage-ordersummary-header")) return;
      if (cell.closest('[class*="header" i]')) return;
      var code = normalizeCode(cell.textContent);
      if (!code || isNonProductCode(code)) return;
      var row = cell.closest("tr") || cell.parentElement;
      if (!row) return;
      var key = code + "|" + String((row && row.rowIndex) || lines.length);
      if (seen[key]) return;
      seen[key] = true;

      var qtyCell = row.querySelector(".v65-onepage-ordersummary-itemqty");
      var totalCell = row.querySelector('.v65-onepage-ordersummary-itemtotal, [id^="ProductPrice" i]');
      var total = totalCell ? money(totalCell.textContent) : 0;
      lines.push({
        code: code,
        quantity: qtyCell ? qtyCell.textContent : 1,
        unitPrice: total,
        total: total,
      });
    });

    return lines;
  }

  function readZip(root) {
    if (!root || !root.querySelector) return "";
    var inputs = Array.prototype.slice.call(root.querySelectorAll(
      '#postalCode, input[name="postalCode" i], input[name*="zip" i], input[id*="zip" i], input[name*="postal" i], input[id*="postal" i]'
    ));
    var entered = inputs.find(function (input) { return normalizeZip(input.value); });
    if (entered) return entered.value;
    var visible = inputs.find(function (input) {
      var rect = input.getBoundingClientRect && input.getBoundingClientRect();
      return rect && rect.width > 0 && rect.height > 0;
    });
    return visible ? visible.value : (inputs[0] ? inputs[0].value : "");
  }

  function optionContainer(input) {
    if (!input) return null;
    var label = input.id && d.querySelector('label[for="' + input.id.replace(/"/g, "") + '"]');
    return input.closest("tr") || input.closest("li") || input.closest("label") || label || input.parentElement;
  }

  function findRateOptions(root) {
    if (!root || !root.querySelectorAll) return [];
    var output = [];
    root.querySelectorAll('input[type="radio"], option').forEach(function (input) {
      var name = String(input.name || (input.parentElement && input.parentElement.name) || "");
      var container = input.tagName === "OPTION" ? input : optionContainer(input);
      // NOTE: container.textContent is a real (possibly empty) string for any live DOM node,
      // so using `||` here was a bug: a blank <option></option> has textContent === "", which
      // is falsy, so it fell through to input.value (e.g. "6") and got treated as a genuine
      // "standard" delivery label instead of the junk/blank entry it actually is. Check
      // presence of a container explicitly instead of relying on truthiness of its text.
      var label = container ? container.textContent : input.textContent || input.value || "";
      if (!/ship|deliver|freight|glove|pickup/i.test(name + " " + label)) return;
      // Snapshot the store's own state before anything mutates it.
      rememberOriginal(input);
      output.push({ input: input, container: container, label: label });
    });
    return output;
  }

  function findMessageRows(root) {
    if (!root || !root.querySelectorAll) return [];
    var candidates = [];
    root.querySelectorAll("tr, li, div, p, span").forEach(function (el) {
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 200) return;
      if (!/free\s+shipping/i.test(text)) return;
      if (!/on\s+orders?\s+of|\$\s*\d/.test(text)) return;
      candidates.push(el);
    });
    return candidates.filter(function (el) {
      return !candidates.some(function (other) {
        return other !== el && el.contains(other);
      });
    });
  }

  function setRowVisible(el, visible) {
    if (!el) return;
    if (!visible) {
      if (!el.hasAttribute("data-mc-shipping-display")) {
        el.setAttribute("data-mc-shipping-display", el.style.display || "");
      }
      el.style.setProperty("display", "none", "important");
      el.setAttribute("data-mc-shipping-hidden", "1");
    } else if (el.getAttribute("data-mc-shipping-hidden") === "1") {
      el.style.display = el.getAttribute("data-mc-shipping-display") || "";
      el.removeAttribute("data-mc-shipping-hidden");
    }
  }

  // A container is only safe to display:none if it belongs to THIS option alone.
  // optionContainer() falls back to input.parentElement, and on markup where the radios
  // are siblings in one wrapper (no per-option tr/li/label) that parent is shared by every
  // rate. Hiding it to suppress a single disallowed rate then blanks the entire delivery
  // block - every option vanishes at once, which is exactly the "no delivery options at
  // all" report. Worse, the per-group fail-open cannot see it: the surviving radios are
  // still enabled, so the group looks healthy while its wrapper is invisible.
  function containerIsExclusive(container, input) {
    if (!container || !container.querySelectorAll) return false;
    if (container === input) return false;
    var nested = container.querySelectorAll('input[type="radio"], select, option');
    for (var i = 0; i < nested.length; i++) {
      if (nested[i] !== input) return false;
    }
    return true;
  }

  // Volusion ships DEACTIVATED shipping methods in the markup and marks them disabled/hidden
  // rather than omitting them - the store's three legacy "Free Curbside Delivery" entries are
  // exactly this. Anything that force-clears those flags RESURRECTS methods the store owner
  // switched off. So capture each option's state the first time we ever see it, and treat that
  // as the ceiling: this script may hide an option, never reveal one Volusion suppressed.
  function rememberOriginal(input) {
    if (!input || input.__mcOrig) return;
    if (input.tagName === "OPTION") {
      input.__mcOrig = { hidden: !!input.hidden, disabled: !!input.disabled };
    } else {
      input.__mcOrig = {
        disabled: !!input.disabled,
        display: (input.style && input.style.display) || "",
      };
    }
  }

  // Was this option selectable in the store's own markup, before we touched anything?
  function originallyUsable(input) {
    if (!input) return false;
    var o = input.__mcOrig;
    if (!o) return true;
    if (input.tagName === "OPTION") return !o.hidden && !o.disabled;
    return !o.disabled;
  }

  // Put an option back exactly as Volusion delivered it - NOT unconditionally visible.
  function restoreOriginal(input) {
    var o = input && input.__mcOrig;
    if (!o) return;
    if (input.tagName === "OPTION") {
      input.hidden = o.hidden;
      input.disabled = o.disabled;
      return;
    }
    input.disabled = o.disabled;
    if (o.display) input.style.setProperty("display", o.display);
    else input.style.removeProperty("display");
  }

  function setOptionVisible(option, visible) {
    var input = option.input;
    var container = option.container;
    if (!input) return;
    rememberOriginal(input);

    // Never promote an option beyond the state the store gave it.
    if (visible && !originallyUsable(input)) visible = false;

    if (input.tagName === "OPTION") {
      if (visible) {
        restoreOriginal(input);
      } else {
        input.hidden = true;
        input.disabled = true;
        if (input.selected) input.selected = false;
      }
      return;
    }

    input.disabled = !visible;
    if (!visible && input.checked) input.checked = false;
    // Always reflect state on the input itself; only touch the wrapper when it is this
    // option's own. When it is shared, disabling the radio is the whole effect.
    if (!containerIsExclusive(container, input)) {
      input.style.setProperty("display", visible ? "" : "none", "important");
      return;
    }
    if (container && container.style) {
      if (!visible) {
        if (!container.hasAttribute("data-mc-shipping-display")) {
          container.setAttribute("data-mc-shipping-display", container.style.display || "");
        }
        container.style.setProperty("display", "none", "important");
        container.setAttribute("data-mc-shipping-hidden", "1");
      } else if (container.getAttribute("data-mc-shipping-hidden") === "1") {
        container.style.display = container.getAttribute("data-mc-shipping-display") || "";
        container.removeAttribute("data-mc-shipping-hidden");
      }
    }
  }

  function fireChange(el) {
    try {
      el.dispatchEvent(new g.Event("change", { bubbles: true }));
    } catch (e) {
      try {
        var evt = d.createEvent("HTMLEvents");
        evt.initEvent("change", true, true);
        el.dispatchEvent(evt);
      } catch (e2) {}
    }
  }

  // A placeholder row ("PLEASE SELECT", "-- choose --", blank) is not a delivery method.
  // If it is all that survived filtering, the customer cannot check out at all.
  function isPlaceholderLabel(label) {
    var text = String(label || "").replace(/\s+/g, " ").trim();
    if (!text) return true;
    return /^[-\s]*(please\s+select|select(\s+an?\s+option)?|choose(\s+one)?)[-\s.]*$/i.test(text);
  }

  function groupOptions(options) {
    var groups = {};
    options.forEach(function (option) {
      var input = option.input;
      var key;
      if (input.tagName === "OPTION") {
        var selectEl = input.closest && input.closest("select");
        if (!selectEl) return;
        key = "select:" + (selectEl.name || selectEl.id || "select");
      } else if (input.type === "radio") {
        key = "radio:" + (input.name || "radio");
      } else {
        return;
      }
      groups[key] = groups[key] || [];
      groups[key].push(option);
    });
    return groups;
  }

  function optionIsVisible(option) {
    var input = option.input;
    if (input.tagName === "OPTION") return !input.hidden && !input.disabled;
    return !input.disabled;
  }

  function restoreEmptiedGroups(options) {
    var groups = groupOptions(options);
    Object.keys(groups).forEach(function (key) {
      var opts = groups[key];
      var hasRealVisible = opts.some(function (option) {
        return optionIsVisible(option) && !isPlaceholderLabel(option.label);
      });
      if (hasRealVisible) return;
      // Nothing real left - hand the group back to the store's own markup. Scoped to options
      // that were selectable to begin with: a method the owner deactivated in Volusion must
      // stay gone even when the fail-safe fires, or the safety net becomes a way to sell
      // delivery that was deliberately switched off.
      opts.forEach(function (option) {
        if (!String(option.label || "").replace(/\s+/g, " ").trim()) return;
        if (!originallyUsable(option.input)) return;
        setOptionVisible(option, true);
      });
      try {
        d.documentElement.setAttribute("data-mc-shipping-failopen", key);
      } catch (e) {}
    });
  }

  function selectRemainingAllowedRate(options) {
    var radioGroups = {};
    var selectGroups = {};

    options.forEach(function (option) {
      var input = option.input;
      if (input.tagName === "OPTION") {
        var selectEl = input.closest && input.closest("select");
        if (!selectEl) return;
        var skey = selectEl.name || selectEl.id || "select";
        selectGroups[skey] = selectGroups[skey] || { el: selectEl, opts: [] };
        selectGroups[skey].opts.push(option);
      } else if (input.type === "radio") {
        var rkey = input.name || "radio";
        radioGroups[rkey] = radioGroups[rkey] || [];
        radioGroups[rkey].push(option);
      }
    });

    // NEVER auto-commit a delivery method.
    //
    // This previously picked the first surviving option and dispatched a change event. That is
    // not a cosmetic act: Volusion's checkout listens for it, recalculates, and PERSISTS the
    // chosen method against the cart server-side. So on any cart where the current selection
    // got hidden, this script silently chose a shipping method for the customer - and when the
    // survivor was a free method, it committed the order to free shipping. That state lives on
    // the cart, not the page, so it outlives reloads and cannot be undone from the admin. It is
    // the only path by which this script can change what Volusion sends back.
    //
    // The customer picks. All we do is make sure a hidden option is never left selected, and
    // when that happens we fall back to the neutral placeholder - never to a real rate.
    Object.keys(radioGroups).forEach(function (key) {
      radioGroups[key].forEach(function (o) {
        if (o.input.checked && o.input.disabled) o.input.checked = false;
      });
    });

    Object.keys(selectGroups).forEach(function (key) {
      var group = selectGroups[key];
      var current = group.el.options[group.el.selectedIndex];
      if (!current) return;
      var currentHidden = current.hidden || current.disabled;
      if (!currentHidden) return;
      var placeholder = group.opts.filter(function (o) {
        return !o.input.hidden && !o.input.disabled && isPlaceholderLabel(o.label);
      })[0];
      if (!placeholder) return;
      group.el.value = placeholder.input.value;
      fireChange(group.el);
    });
  }

  // Undo every change this script can make, for any option we know about.
  function showEverything(options) {
    (options || []).forEach(function (option) {
      try {
        var input = option.input;
        if (!input) return;
        // Restore to the store's original markup - never blanket-enable. Forcing these flags
        // clear is what resurrected the deactivated "Free Curbside Delivery" methods.
        restoreOriginal(input);
        var container = option.container;
        if (container && container !== input && container.getAttribute &&
            container.getAttribute("data-mc-shipping-hidden") === "1") {
          container.style.display = container.getAttribute("data-mc-shipping-display") || "";
          container.removeAttribute("data-mc-shipping-hidden");
        }
      } catch (e) {}
    });
  }

  function policyDisabled() {
    try {
      if (g.__MC_SHIPPING_POLICY_OFF__) return true;
      return /[?&]mcshipoff=1\b/.test(String(g.location && g.location.search || ""));
    } catch (e) {
      return false;
    }
  }

  // Hard outer guard. Filtering runs in stages: hide first, then repair. If ANYTHING throws
  // between those stages - a label shape we never saw, a detached node mid-rebuild - the DOM
  // is left frozen in the hidden state and the customer sees no delivery methods, with the
  // repair pass never reached. Nothing this script does is worth blocking an order, so any
  // failure reverts to showing the store's native options untouched.
  function applyPolicy() {
    if (policyDisabled()) return;
    var known = null;
    try {
      known = findRateOptions(d.getElementById("content_area") || d.body);
    } catch (ePre) {
      known = null;
    }
    try {
      applyPolicyInner();
    } catch (err) {
      showEverything(known);
      try {
        d.documentElement.setAttribute("data-mc-shipping-error", String(err && err.message || err));
      } catch (e2) {}
    }
  }

  function applyPolicyInner() {
    if (!d || !d.body) return;
    var root = d.getElementById("content_area") || d.body;
    var lines = readCartLines(root);
    if (!lines.length) return;
    var summary = summarizeCart(lines);
    var zip = readZip(root);
    var options = findRateOptions(root);
    // A ranged white-glove option ("...(26-40 Miles from Forney, TX) $249") only exists
    // alongside a redundant flat-rate duplicate ("White Glove Delivery $205") on SOME product
    // lines. Other lines (loveseats/recliners) have only the unranged option and no ranged
    // siblings at all. Compute this per-cart so the unranged-hide rule only fires when it's
    // actually a duplicate, not the cart's only delivery method.
    var hasRangedWhiteGlove = options.some(function (option) {
      return rateType(option.label) === "whiteGlove" && !!parseMileRange(option.label);
    });
    options.forEach(function (option) {
      setOptionVisible(option, isRateAllowed(option.label, summary, zip, hasRangedWhiteGlove));
    });

    // FAIL-OPEN INVARIANT. Whatever the cart / zip / label combination, a customer must
    // never be left with no selectable delivery method - that blocks the order outright,
    // which is strictly worse than showing an option too many. If filtering emptied a
    // group down to nothing real (a placeholder like "PLEASE SELECT" does not count),
    // restore every option in that group rather than stranding the checkout.
    restoreEmptiedGroups(options);

    selectRemainingAllowedRate(options);
    findMessageRows(root).forEach(function (row) {
      setRowVisible(row, isRateAllowed(row.textContent, summary, zip, hasRangedWhiteGlove));
    });
    d.documentElement.setAttribute("data-mc-shipping-policy", VERSION);
  }

  function shippingSelectionState(root) {
    root = root || d.getElementById("content_area") || d.body;
    var options = findRateOptions(root);
    var realVisible = options.filter(function (option) {
      return optionIsVisible(option) && !isPlaceholderLabel(option.label);
    });
    if (!realVisible.length) {
      return { ok: true, reason: "no-methods", control: null };
    }

    var selects = {};
    var radios = {};
    realVisible.forEach(function (option) {
      var input = option.input;
      if (input.tagName === "OPTION") {
        var selectEl = input.closest && input.closest("select");
        if (!selectEl) return;
        var skey = selectEl.name || selectEl.id || "select";
        selects[skey] = selectEl;
      } else if (input.type === "radio") {
        var rkey = input.name || "radio";
        radios[rkey] = radios[rkey] || [];
        radios[rkey].push(input);
      }
    });

    var keys = Object.keys(selects);
    for (var i = 0; i < keys.length; i++) {
      var selectEl = selects[keys[i]];
      var current = selectEl.options[selectEl.selectedIndex];
      var label = current ? current.text : "";
      var value = current ? String(current.value || "") : "";
      if (!current || current.disabled || isPlaceholderLabel(label) || value === "" || value === "0") {
        return { ok: false, reason: "select", control: selectEl };
      }
    }

    var rkeys = Object.keys(radios);
    for (var r = 0; r < rkeys.length; r++) {
      var group = radios[rkeys[r]];
      var checked = group.filter(function (input) {
        return input.checked && !input.disabled && !isPlaceholderLabel(input.value);
      });
      if (!checked.length) {
        return { ok: false, reason: "radio", control: group[0] };
      }
    }

    return { ok: true, reason: "selected", control: null };
  }

  function ensureShippingRequiredStyles() {
    if (d.getElementById("mc-shipping-required-style")) return;
    var style = d.createElement("style");
    style.id = "mc-shipping-required-style";
    style.textContent =
      "#mc-shipping-required-msg{" +
      "display:none;margin:10px 0 12px;padding:10px 12px;border:1px solid #c9a227;" +
      "background:#fff8e5;color:#5c4a00;font:600 14px/1.35 Arial,Helvetica,sans-serif;}" +
      "#mc-shipping-required-msg.mc-shipping-required-msg--show{display:block!important;}" +
      "select.mc-shipping-required-invalid," +
      "input.mc-shipping-required-invalid{outline:2px solid #c9a227!important;outline-offset:2px!important;}";
    (d.head || d.documentElement).appendChild(style);
  }

  function showShippingRequiredError(control) {
    ensureShippingRequiredStyles();
    var host =
      (control && (control.closest("tr") || control.closest(".v65-onepage-shipping") || control.parentElement)) ||
      d.getElementById("v65-onepage-ShippingCostParent") ||
      d.body;
    var msg = d.getElementById("mc-shipping-required-msg");
    if (!msg) {
      msg = d.createElement("div");
      msg.id = "mc-shipping-required-msg";
      msg.setAttribute("role", "alert");
      if (host && host.parentNode) host.parentNode.insertBefore(msg, host);
      else if (host) host.insertBefore(msg, host.firstChild);
    }
    msg.textContent = SHIPPING_REQUIRED_MSG;
    msg.className = "mc-shipping-required-msg--show";
    try {
      d.querySelectorAll(".mc-shipping-required-invalid").forEach(function (el) {
        el.classList.remove("mc-shipping-required-invalid");
      });
    } catch (eClear) {}
    if (control && control.classList) control.classList.add("mc-shipping-required-invalid");
    try {
      if (control && control.focus) control.focus();
      if (msg.scrollIntoView) msg.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (eFocus) {}
  }

  function clearShippingRequiredError() {
    var msg = d.getElementById("mc-shipping-required-msg");
    if (msg) msg.className = "";
    try {
      d.querySelectorAll(".mc-shipping-required-invalid").forEach(function (el) {
        el.classList.remove("mc-shipping-required-invalid");
      });
    } catch (eClear) {}
  }

  function requireShippingSelection(event) {
    var state = shippingSelectionState();
    if (state.ok) {
      clearShippingRequiredError();
      return true;
    }
    if (event) {
      try {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      } catch (ePrev) {}
    }
    showShippingRequiredError(state.control);
    return false;
  }

  function bindShippingRequired() {
    if (d.documentElement.getAttribute("data-mc-shipping-required") === VERSION) return;
    d.documentElement.setAttribute("data-mc-shipping-required", VERSION);
    ensureShippingRequiredStyles();

    var form = d.getElementById("v65-onepage-CheckoutForm") || d.querySelector("form[name*='Checkout' i]");
    if (form && !form.__mcShippingRequiredBound) {
      form.__mcShippingRequiredBound = true;
      form.addEventListener(
        "submit",
        function (event) {
          requireShippingSelection(event);
        },
        true
      );
    }

    d.addEventListener(
      "click",
      function (event) {
        var target = event.target;
        if (!target) return;
        var btn =
          target.closest &&
          target.closest(
            '#btnSubmitOrder, button[name="btnSubmitOrder"], input[name="btnSubmitOrder"], button[type="submit"], input[type="submit"]'
          );
        if (!btn) return;
        var label = String(btn.id || "") + " " + String(btn.name || "") + " " + String(btn.value || "") + " " + String(btn.textContent || "");
        if (btn.id !== "btnSubmitOrder" && btn.name !== "btnSubmitOrder" && !/place\s*order|submit\s*order|process\s*order/i.test(label)) {
          return;
        }
        requireShippingSelection(event);
      },
      true
    );

    d.addEventListener(
      "change",
      function (event) {
        var t = event.target;
        if (!t) return;
        if (/ShippingSpeedChoice|ShipMethod|ShippingMethod|ship/i.test(String(t.name || "") + " " + String(t.id || ""))) {
          if (shippingSelectionState().ok) clearShippingRequiredError();
        }
      },
      true
    );
  }

  function boot() {
    if (!d || !d.body) return;
    var path = String(g.location && g.location.pathname || "").toLowerCase();
    if (!/shoppingcart|shopcart\.asp|\/cart\b|onepagecheckout|checkout/i.test(path)) return;
    applyPolicy();
    bindShippingRequired();

    var root = d.getElementById("content_area") || d.body;
    var timer = null;
    if (typeof g.MutationObserver === "function") {
      new g.MutationObserver(function () {
        if (timer) g.clearTimeout(timer);
        timer = g.setTimeout(function () {
          applyPolicy();
          bindShippingRequired();
        }, 120);
      }).observe(root, { childList: true, subtree: true });
    }
    root.addEventListener("change", function (event) {
      if (/zip|postal|state|country/i.test(String(event.target && (event.target.name || event.target.id) || ""))) {
        g.setTimeout(applyPolicy, 0);
      }
    });
  }

  g.__MC_SHIPPING_RATE_POLICY__ = {
    version: VERSION,
    threshold: SARANONI_FREE_THRESHOLD,
    whiteGloveTiers: zipTierData,
    productFamily: productFamily,
    rateType: rateType,
    isDfwZip: isDfwZip,
    whiteGloveQuote: whiteGloveQuote,
    summarizeCart: summarizeCart,
    isRateAllowed: isRateAllowed,
    apply: applyPolicy,
    shippingSelectionState: shippingSelectionState,
    requireShippingSelection: requireShippingSelection,
  };

  if (!d) return;
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();
  g.addEventListener("load", applyPolicy);
})(window, document);
