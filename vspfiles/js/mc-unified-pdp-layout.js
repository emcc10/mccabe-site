/**
 * MC unified PDP layout — runs without template rebake.
 * Loaded by mc-pdp-auth-cta-fix.js on product detail pages.
 */
(function (global) {
  "use strict";


  var LAYOUT_VER = "20260617unified16";
  var AUTH_LAYOUT_VER = "20260617pdp67";
  var moTimer = null;
  var moBound = false;
  var moInstance = null;

  function qs(sel, root) {
    return (root || global.document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.from((root || global.document).querySelectorAll(sel));
  }

  function isPDP() {
    return !!qs('input[name="ProductCode"]') && !!(qs("#content_area") || qs("#v65-product-parent"));
  }

  function isSectionalConfigurator() {
    var path = String((global.location && global.location.pathname) || "").toLowerCase();
    if (path.indexOf("room-planner") !== -1) return true;
    if (qs("#mtl-sectional-configurations, #mccabe-room-planner-pricing-summary, .room-planner-summary")) return true;
    var pc = String((qs('input[name="ProductCode"], input[name="productcode"]') || {}).value || "")
      .trim()
      .toUpperCase();
    return /ROOM-PLANNER|CONFIGURATOR/i.test(pc);
  }

  function unwrapBadWrapper() {
    var wrap = qs(".mc-pdp-cols");
    if (!wrap) return;
    var parent = wrap.parentNode;
    qsa(".mc-pdp-col--left > *, .mc-pdp-col--right > *", wrap).forEach(function (n) {
      parent.insertBefore(n, wrap);
    });
    wrap.remove();
  }

  function directTdUnder(row, node) {
    var cur = node;
    while (cur && cur.parentNode !== row) cur = cur.parentNode;
    return cur && cur.tagName === "TD" ? cur : null;
  }

  function findOuterProductRow(mediaNode, purchaseNode) {
    if (!mediaNode || !purchaseNode) return null;
    var cur = mediaNode;
    while (cur && cur !== global.document.body) {
      if (cur.tagName === "TR" && cur.contains(purchaseNode)) {
        var mediaCell = directTdUnder(cur, mediaNode);
        var infoCell = directTdUnder(cur, purchaseNode);
        if (mediaCell && infoCell && mediaCell !== infoCell) {
          var table = cur.parentNode;
          while (table && table.tagName !== "TABLE") table = table.parentNode;
          return { row: cur, mediaCell: mediaCell, infoCell: infoCell, table: table };
        }
      }
      cur = cur.parentNode;
    }
    return null;
  }

  function tableColspan(table, row) {
    var n = Math.max(2, row ? row.children.length : 2);
    if (!table) return n;
    qsa("tr", table).forEach(function (tr) {
      qsa("td[colspan]", tr).forEach(function (td) {
        var cs = parseInt(td.getAttribute("colspan") || "1", 10);
        if (cs > n) n = cs;
      });
    });
    return n;
  }

  function childrenInOrder(parent, nodes) {
    var present = nodes.filter(function (el) {
      return el && el.parentNode === parent;
    });
    if (!present.length) return true;
    var i;
    for (i = 0; i < present.length - 1; i++) {
      if (present[i].nextElementSibling !== present[i + 1]) return false;
    }
    return true;
  }

  function appendInOrder(parent, nodes) {
    var present = nodes.filter(function (el) {
      return el && el !== parent && !el.contains(parent);
    });
    if (!present.length) return false;
    if (present.every(function (el) { return el.parentNode === parent; }) && childrenInOrder(parent, present)) return false;
    present.forEach(function (el) {
      parent.appendChild(el);
    });
    return true;
  }

  function purchaseQtyOrderOk(info) {
    if (!info) return true;
    var qty = qs("#mc-pdp-qty-row", info);
    if (!qty) return true;
    var purchase =
      qs(".mc-unified-purchase-controls", info) || qs("#mc-pdp-purchase-stack", info);
    return !!(purchase && purchase.contains(qty));
  }

  function isUnifiedStable() {
    var body = global.document.body;
    var info = qs("td.mc-unified-pdp-info");
    var orderedOk = !info || childrenInOrder(
      info,
      [
        qs("#mc-pdp-brand-logo", info),
        qs("#mc-pdp-title-right", info),
        qs("#mc-pdp-price-stack-host", info) || qs("#mc-pdp-price-atc-row", info),
        collectFinanceBlock(info),
        qs("#mc-pdp-features", info),
        qs(".mc-unified-purchase-controls", info),
      ].filter(Boolean)
    );
    return !!(
      global.__MC_UNIFIED_PDP_STABLE__ &&
      body &&
      body.classList.contains("mc-pdp-unified-ready") &&
      body.dataset.mcPdpLayoutVer === AUTH_LAYOUT_VER &&
      body.dataset.mcUnifiedPdpVer === LAYOUT_VER &&
      orderedOk &&
      purchaseQtyOrderOk(info) &&
      qs("tr.mc-unified-pdp-row") &&
      qs(".mc-unified-purchase-controls")
    );
  }

  function markUnifiedStable() {
    global.__MC_UNIFIED_PDP_STABLE__ = true;
    if (moInstance && typeof moInstance.disconnect === "function") {
      try {
        moInstance.disconnect();
      } catch (eMo) {}
      moInstance = null;
      moBound = false;
    }
    if (moTimer) {
      clearTimeout(moTimer);
      moTimer = null;
    }
  }

  function clearInlineLayout(el) {
    if (!el || !el.style) return;
    [
      "display",
      "flex",
      "flex-direction",
      "flex-wrap",
      "align-items",
      "justify-content",
      "gap",
      "width",
      "min-width",
      "max-width",
      "padding",
      "padding-left",
      "padding-right",
      "margin",
      "background",
      "background-color",
      "border",
      "order",
    ].forEach(function (p) {
      el.style.removeProperty(p);
    });
  }

  function parseBreadCrumbIds() {
    var ids = [];
    qsa("script").forEach(function (sc) {
      var m = (sc.textContent || "").match(/breadCrumb\s*=\s*["']([^"']+)["']/);
      if (!m) return;
      m[1].split("|").forEach(function (p) {
        if (p && /^\d+$/.test(p)) ids.push(p);
      });
    });
    return ids;
  }

  function fallbackReturnCategory() {
    var pc = "";
    var title = "";
    var hay = "";
    try {
      pc = String((qs('input[name="ProductCode"], input[name="productcode"]') || {}).value || "").toUpperCase();
      title = String((global.document.querySelector('[itemprop="name"], h1, .productnamecolor, .colors_productname') || {}).textContent || global.document.title || "").toUpperCase();
      hay = [pc, title, global.location && global.location.pathname || ""].join(" ").toUpperCase();
    } catch (e) {}

    if (/^SAR/.test(pc) && /(ROBE|SNUGGLE|WEAR|BAMBONI)/.test(hay)) {
      return { name: "Snugglewear", href: "/category-s/208.htm" };
    }
    if (/^SAR/.test(pc) && /(BABY)/.test(hay)) {
      return { name: "Baby Blankets", href: "/category-s/207.htm" };
    }
    if (/^SAR/.test(pc) && /(KID|CHILD|MINI)/.test(hay)) {
      return { name: "Kids Blankets", href: "/category-s/206.htm" };
    }
    if (/^SAR/.test(pc)) {
      return { name: "Adult Blankets", href: "/category-s/205.htm" };
    }
    if (/^BB|BEAN\s*BAG|NEST/.test(pc) || /BEAN\s*BAG|NEST/.test(title)) {
      return { name: "Bean Bags", href: "/bean-bag-seating-s/103.htm" };
    }
    if (/MAHJONG/.test(hay) && /(MAT|RACK)/.test(hay)) {
      return { name: "Mats and Racks", href: "/category-s/203.htm" };
    }
    if (/MAHJONG/.test(hay) && /(TILE|SET)/.test(hay)) {
      return { name: "Mahjong Tiles", href: "/category-s/202.htm" };
    }
    if (/MAHJONG/.test(hay) && /(BAG|TOTE|BOX|ACCESSOR)/.test(hay)) {
      return { name: "Mahjong Accessories", href: "/category-s/204.htm" };
    }
    if (/SECTIONAL|SECT/.test(pc) || /SECTIONAL/.test(title)) {
      return { name: "Sectionals", href: "/sectionals-s/198.htm" };
    }
    if (/LOVESEAT|LOVE/i.test(pc) || /LOVESEAT/i.test(title)) {
      return { name: "Loveseats", href: "/loveseats-s/199.htm" };
    }
    if (/SOFA/.test(pc) || /SOFA/.test(title)) {
      return { name: "Sofas", href: "/sofas-s/197.htm" };
    }
    return { name: "Furniture", href: "/" };
  }

  function resolveReturnCategory() {
    var fallback = fallbackReturnCategory();
    var productAwareNames = {
      "BEAN BAGS": true,
      "MATS AND RACKS": true,
      "MAHJONG TILES": true,
      "MAHJONG ACCESSORIES": true,
      "SNUGGLEWEAR": true,
      "BABY BLANKETS": true,
      "KIDS BLANKETS": true,
      "ADULT BLANKETS": true,
    };
    var BLOCK = { 136: true, 196: true };
    if (productAwareNames[String(fallback.name || "").toUpperCase()]) return fallback;
    var bcTd = qs("#v65-product-parent .vCSS_breadcrumb_td, #content_area .vCSS_breadcrumb_td");
    var links = bcTd ? qsa('a[href*="-s/"], a[href*="category-s/"]', bcTd) : [];
    var ids = parseBreadCrumbIds();

    var i;
    for (i = ids.length - 1; i >= 0; i--) {
      if (BLOCK[ids[i]]) continue;
      var id = ids[i];
      var j;
      for (j = links.length - 1; j >= 0; j--) {
        var href = links[j].getAttribute("href") || "";
        if (
          href.indexOf("-s/" + id) !== -1 ||
          href.indexOf("category-s/" + id) !== -1 ||
          new RegExp("[?&]categoryid=" + id + "\\b", "i").test(href)
        ) {
          var name = (links[j].textContent || "").replace(/\s+/g, " ").trim();
          if (name) return { name: name, href: href };
        }
      }
    }

    for (i = links.length - 1; i >= 0; i--) {
      var t = (links[i].textContent || "").replace(/\s+/g, " ").trim();
      var h = links[i].getAttribute("href") || "";
      if (!t || !h || /about us/i.test(t)) continue;
      if (/luxe comforts/i.test(t) && productAwareNames[String(fallback.name || "").toUpperCase()]) continue;
      return { name: t, href: h };
    }
    return fallback;
  }

  function ensureReturnRow(mainRow, table) {
    if (!mainRow || !table) return;
    var tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table;
    var retRow = qs("tr.mc-pdp-return-row", tbody);
    if (!retRow) {
      retRow = global.document.createElement("tr");
      retRow.className = "mc-pdp-return-row";
      var cell = global.document.createElement("td");
      cell.className = "mc-pdp-return-cell";
      cell.colSpan = tableColspan(table, mainRow);
      retRow.appendChild(cell);
      tbody.insertBefore(retRow, mainRow);
    } else if (retRow.nextElementSibling !== mainRow) {
      tbody.insertBefore(retRow, mainRow);
    }

    var cellEl = retRow.querySelector(".mc-pdp-return-cell") || retRow.querySelector("td");
    if (!cellEl) return;
    cellEl.colSpan = tableColspan(table, mainRow);

    var link = cellEl.querySelector(".mc-pdp-return-link");
    if (!link) {
      link = global.document.createElement("a");
      link.className = "mc-pdp-return-link";
      cellEl.appendChild(link);
    }
    var cat = resolveReturnCategory();
    if (cat) {
      link.href = cat.href;
      link.textContent = "\u2190 RETURN TO " + cat.name.toUpperCase();
      link.setAttribute("aria-label", "Return to " + cat.name);
    }
  }

  function findAtcButton(root) {
    root = root || qs("#v65-product-parent") || document;
    return (
      qs('#btn_addtocart', root) ||
      qs('#btnaddtocart', root) ||
      qs('input[name="btnaddtocart"]', root) ||
      qs('button[name="btnaddtocart"]', root)
    );
  }

  function findQtyBlock(infoTd) {
    var row = qs("#mc-pdp-qty-row", infoTd);
    if (row) return row;
    var input = qs('input[name^="QTY."], input.v65-productdetail-cartqty, #txtqty, #Quantity', infoTd);
    if (!input) return null;
    row = global.document.createElement("div");
    row.id = "mc-pdp-qty-row";
    row.className = "mc-unified-qty-row";
    var host = input.closest(".v65-productdetail-cartqty, .vol-cartqty__wrap");
    if (host && host !== infoTd && host.parentNode) {
      row.appendChild(host);
    } else {
      row.appendChild(input);
    }
    return row;
  }

  function prepareAtcButton(btn) {
    if (!btn) return btn;
    if ((btn.type || "").toLowerCase() === "image") {
      try {
        btn.type = "submit";
      } catch (e) {}
      btn.removeAttribute("src");
    }
    if (btn.tagName === "INPUT" && !btn.value) btn.value = "ADD TO CART";
    clearInlineLayout(btn);
    btn.classList.add("mc-unified-atc-btn");
    btn.classList.remove("btn-default", "btn-secondary");
    btn.classList.add("btn-primary");
    btn.style.setProperty("background", "#000", "important");
    btn.style.setProperty("background-color", "#000", "important");
    btn.style.setProperty("background-image", "none", "important");
    btn.style.setProperty("color", "#fff", "important");
    btn.style.setProperty("border", "1px solid #000", "important");
    btn.style.setProperty("width", "100%", "important");
    btn.style.setProperty("max-width", "400px", "important");
    btn.style.setProperty("height", "48px", "important");
    btn.style.setProperty("min-height", "48px", "important");
    btn.style.setProperty("box-shadow", "none", "important");
    btn.style.setProperty("transition", "none", "important");
    btn.style.setProperty("animation", "none", "important");
    btn.setAttribute("data-mc-atc-styled", AUTH_LAYOUT_VER);
    qsa(".mc-cart-icon-wrapper", btn.parentNode || btn).forEach(function (ic) {
      ic.remove();
    });
    var wrap = btn.closest(".mc-atc-button-wrap");
    if (wrap) {
      clearInlineLayout(wrap);
      wrap.classList.add("mc-unified-atc-host");
      wrap.style.setProperty("background", "#000", "important");
      wrap.style.setProperty("background-color", "#000", "important");
    }
    var cartBlock = btn.closest(".v65-product-addtocart");
    if (cartBlock && cartBlock !== btn) clearInlineLayout(cartBlock);
    return btn;
  }

  function findAtcHost(btn) {
    if (!btn) return null;
    return btn.closest(".v65-product-addtocart") || btn.closest(".mc-atc-button-wrap") || btn;
  }

  function ensurePurchaseControls(infoTd, atcBtn) {
    var controls = qs(".mc-unified-purchase-controls", infoTd);
    if (!controls) {
      controls = global.document.createElement("div");
      controls.className = "mc-unified-purchase-controls";
      infoTd.appendChild(controls);
    }

    var oldStack = qs("#mc-pdp-purchase-stack", infoTd);
    if (oldStack && oldStack !== controls) {
      qsa(":scope > *", oldStack).forEach(function (ch) {
        if (!controls.contains(ch)) controls.appendChild(ch);
      });
      oldStack.style.setProperty("display", "none", "important");
      oldStack.setAttribute("aria-hidden", "true");
    }

    var oldPurchase = qs(".mc-pdp-purchase-controls", infoTd);
    if (oldPurchase && oldPurchase !== controls) {
      qsa(":scope > *", oldPurchase).forEach(function (ch) {
        if (!controls.contains(ch)) controls.appendChild(ch);
      });
      oldPurchase.style.setProperty("display", "none", "important");
    }

    var qtyRow = findQtyBlock(infoTd);
    if (qtyRow) controls.appendChild(qtyRow);

    var atcHost = findAtcHost(atcBtn);
    if (atcHost) controls.appendChild(atcHost);

    prepareAtcButton(atcBtn);
    clearInlineLayout(controls);
    return controls;
  }

  function collectFinanceBlock(infoTd) {
    return (
      qs("#messaging-element", infoTd) ||
      qs('[id*="klarna" i], [class*="klarna" i], klarna-placement', infoTd) ||
      qs('[id*="affirm" i], [class*="affirm" i], affirm-as-low-as', infoTd)
    );
  }

  function collectOptionBlocks(infoTd) {
    var sel =
      "#mc-pdp-option-block, #beanbag-swatch-wrapper, #mc-configured-color-swatch-wrapper, " +
      "#mc-bb-size-section, .mc-saranoni-swatch-wrapper, .mc-saranoni-swatches, " +
      ".mc-configured-color-swatch-wrapper, .mc-configured-color-swatches, " +
      "[data-mc-color-swatches], [data-mc-saranoni-swatches], " +
      "#mc-inline-config, #mcConfigurationBlock, #mc-acc-sectional-config";
    var seen = [];
    qsa(sel, infoTd).forEach(function (el) {
      if (seen.indexOf(el) === -1) seen.push(el);
    });
    return seen;
  }

  function scoopLooseQtyIntoPurchase(infoTd, purchase) {
    if (!infoTd || !purchase) return;
    var qty = qs("#mc-pdp-qty-row", infoTd);
    if (!qty || purchase.contains(qty)) return;
    var atc = findAtcButton(purchase) || findAtcButton(infoTd);
    if (atc) {
      var host = findAtcHost(atc);
      if (host && !purchase.contains(host)) purchase.appendChild(host);
      if (host && purchase.contains(host)) {
        purchase.insertBefore(qty, host);
        return;
      }
    }
    purchase.insertBefore(qty, purchase.firstChild || null);
  }

  function orderInfoColumn(infoTd) {
    var title =
      qs("#mc-pdp-title-right", infoTd) ||
      qs('h1[itemprop="name"]', infoTd) ||
      qs('[itemprop="name"]', infoTd);
    var logo = qs("#mc-pdp-brand-logo", infoTd);
    var price = qs("#mc-pdp-price-stack-host", infoTd);
    if (!price) price = qs("#mc-pdp-price-atc-row", infoTd);
    var klarna = collectFinanceBlock(infoTd);
    var options = collectOptionBlocks(infoTd);
    var features = qs("#mc-pdp-features", infoTd);
    var purchase =
      qs("#mc-pdp-purchase-stack", infoTd) ||
      qs(".mc-unified-purchase-controls", infoTd);

    scoopLooseQtyIntoPurchase(infoTd, purchase);

    var ordered = [];
    [logo, title, price, klarna].forEach(function (el) {
      if (el && ordered.indexOf(el) === -1) ordered.push(el);
    });
    options.forEach(function (el) {
      if (ordered.indexOf(el) === -1) ordered.push(el);
    });
    if (features && ordered.indexOf(features) === -1) ordered.push(features);
    if (purchase && ordered.indexOf(purchase) === -1) ordered.push(purchase);

    appendInOrder(infoTd, ordered);

    qsa(
      'input[name="btnaddtocart"], button[name="btnaddtocart"], .v65-product-addtocart, .mc-atc-button-wrap',
      infoTd
    ).forEach(function (node) {
      if (purchase && purchase.contains(node)) return;
      if (features && features.contains(node)) return;
      var btn = node.tagName === "INPUT" || node.tagName === "BUTTON" ? node : qs('input[name="btnaddtocart"], button[name="btnaddtocart"]', node);
      if (btn && purchase) {
        var host = findAtcHost(btn);
        if (host && !purchase.contains(host)) purchase.appendChild(host);
      }
    });
  }

  function hideDuplicatePriceBlocks(infoTd) {
    if (!infoTd) return;
    var canonical = qs("#mc-pdp-price-stack-host", infoTd) || qs("#mc-pdp-price-atc-row", infoTd);
    if (!canonical) return;
    qsa(".colors_pricebox, [itemprop='offers']", infoTd).forEach(function (node) {
      if (!node || node === canonical || node.contains(canonical) || canonical.contains(node)) return;
      if (node.closest(".mc-unified-purchase-controls, #mc-pdp-features")) return;
      var txt = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (!/\$[0-9]/.test(txt)) return;
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      node.setAttribute("aria-hidden", "true");
      node.classList.add("mc-pdp-duplicate-price-hidden");
    });
  }

  function normalizeMediaColumn(mediaTd) {
    if (!mediaTd) return;
    var isBeanBag =
      global.document.body && global.document.body.classList.contains("mc-bean-bag-pdp");
    var imgMaxW = isBeanBag ? "600px" : "650px";
    var img = qs("#product_photo, .vCSS_img_product_photo, .vcss_img_wrap img, img#main-image", mediaTd) || qs("#product_photo, .vCSS_img_product_photo, .vcss_img_wrap img, img#main-image");
    if (img && img.style) {
      img.style.removeProperty("max-width");
      img.style.removeProperty("width");
      img.style.removeProperty("height");
      img.style.setProperty("display", "block", "important");
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "auto", "important");
      img.style.setProperty("max-width", imgMaxW, "important");
      img.style.setProperty("max-height", "none", "important");
      img.style.setProperty("object-fit", "contain", "important");
      img.style.setProperty("margin", "0 auto", "important");
    }

    var alt = qs("#altviews, .altviews, [id*='altviews'], [class*='altviews']", document);
    if (alt && !mediaTd.contains(alt)) mediaTd.appendChild(alt);
    if (alt && alt.style) {
      alt.classList.add("mc-unified-altviews");
      alt.style.setProperty("display", "flex", "important");
      alt.style.setProperty("flex-direction", "row", "important");
      alt.style.setProperty("align-items", "center", "important");
      alt.style.setProperty("justify-content", "center", "important");
      alt.style.setProperty("gap", "10px", "important");
      alt.style.setProperty("flex-wrap", "wrap", "important");
      alt.style.setProperty("width", "100%", "important");
      alt.style.setProperty("margin", "10px auto 0", "important");
      alt.style.setProperty("padding", "0", "important");
      alt.style.setProperty("float", "none", "important");
      alt.style.setProperty("clear", "both", "important");
    }
  }

  function findDescriptionNode() {
    var selectors = [
      "#mc-pdp-description-below-features",
      "#ProductDetail_ProductDetails_div span[itemprop='description']",
      "#ProductDetail_ProductDetails_div2 span[itemprop='description']",
      "#product_description",
      "#ProductDetail_ProductDetails_div",
      "span[itemprop='description']",
    ];
    var i;
    for (i = 0; i < selectors.length; i++) {
      var el = qs(selectors[i]);
      if (!el) continue;
      if (el.closest("#mc-pdp-features, .mc-related-carousel, #related_products_content, .mc-unified-purchase-controls")) {
        continue;
      }
      var text = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (el.id === "mc-pdp-description-below-features" || text.length >= 40) return el;
    }
    return null;
  }

  function ensureDescriptionRow(mainRow, table, descNode, mediaTd) {
    if (!mainRow || !table || !mediaTd) return;
    var tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table;
    var descRow = qs("tr.mc-pdp-description-row", tbody);
    var wrapEl = qs(".mc-unified-pdp-description", mediaTd);
    if (!wrapEl) {
      wrapEl = global.document.createElement("div");
      wrapEl.className = "mc-unified-pdp-description mc-unified-pdp-description--media";
      var altViews = qs("#altviews, .mc-unified-altviews, .vCSS_img_alternate", mediaTd);
      if (altViews && altViews.parentNode === mediaTd && altViews.nextSibling) {
        mediaTd.insertBefore(wrapEl, altViews.nextSibling);
      } else {
        mediaTd.appendChild(wrapEl);
      }
    } else {
      wrapEl.classList.add("mc-unified-pdp-description--media");
    }

    if (!wrapEl && !descNode) return;

    if (!descNode && descRow) {
      descNode = qs(".mc-unified-pdp-description, .mc-pdp-description-cell, td", descRow);
    }

    if (!wrapEl || !descNode) {
      if (descRow) {
        descRow.style.setProperty("display", "none", "important");
        descRow.setAttribute("aria-hidden", "true");
      }
      return;
    }

    if (descNode.id === "mc-pdp-description-below-features" || descNode.classList.contains("mc-pdp-description-below")) {
      while (descNode.firstChild) wrapEl.appendChild(descNode.firstChild);
      descNode.style.setProperty("display", "none", "important");
      descNode.setAttribute("aria-hidden", "true");
    } else if (descRow && descRow.contains(descNode)) {
      while (descNode.firstChild) wrapEl.appendChild(descNode.firstChild);
    } else if (!wrapEl.contains(descNode)) {
      wrapEl.appendChild(descNode);
    }

    qsa("#mc-pdp-description-under-media, .mc-pdp-description-under-media, .mc-gatlin-description-below").forEach(function (legacy) {
      if (!legacy || legacy === descNode) return;
      if (!String(legacy.textContent || "").trim()) {
        legacy.style.setProperty("display", "none", "important");
      }
    });

    if (descRow) {
      descRow.style.setProperty("display", "none", "important");
      descRow.setAttribute("aria-hidden", "true");
    }
  }

  function tagProductBodyClasses() {
    if (typeof global.window.isBeanBagProductPage === "function" && global.window.isBeanBagProductPage()) {
      global.document.body.classList.add("mc-bean-bag-pdp");
    } else {
      global.document.body.classList.remove("mc-bean-bag-pdp");
    }
    try {
      var pc = String((qs('input[name="ProductCode"], input[name="productcode"]') || {}).value || "")
        .trim()
        .toUpperCase();
      if (/^SAR/.test(pc)) {
        global.document.body.classList.add("mc-saranoni-pdp");
        global.document.body.classList.toggle("mc-ruched-blanket-pdp", pc === "SAR-RUCHED-MINKY-THROW-BLANKET");
      } else {
        global.document.body.classList.remove("mc-saranoni-pdp", "mc-ruched-blanket-pdp");
      }
      global.document.body.classList.toggle("mc-gatlin-sectional-pdp", /GATLIN/i.test(pc) && /-SECT/i.test(pc));
    } catch (e) {}
  }

  function mcNormalizePdpLayout() {
    if (!isPDP()) return false;
    if (isSectionalConfigurator()) return false;
    if (isUnifiedStable()) return true;

    unwrapBadWrapper();
    tagProductBodyClasses();
    global.document.body.classList.add("mc-product-page");

    var main =
      qs("#product_photo") ||
      qs("#product_photo_td") ||
      qs(".vCSS_img_wrap img") ||
      qs("img#main-image");
    var atc = findAtcButton();
    if (!main || !atc) return false;

    var layout = findOuterProductRow(main, atc);
    if (!layout || !layout.table) {
      var photoTd = main.closest ? main.closest("td") : null;
      var atcTd = atc.closest ? atc.closest("td") : null;
      if (atcTd && photoTd && atcTd.contains && atcTd.contains(main)) {
        while (atcTd && atcTd.contains(main) && atcTd !== photoTd) {
          atcTd = atcTd.parentNode && atcTd.parentNode.closest ? atcTd.parentNode.closest("td") : null;
        }
      }
      var rowGuess = photoTd && photoTd.parentNode && photoTd.parentNode.tagName === "TR" ? photoTd.parentNode : null;
      if (rowGuess && photoTd && atcTd && photoTd !== atcTd && rowGuess.contains(atcTd)) {
        var tableGuess = rowGuess.closest ? rowGuess.closest("table") : null;
        layout = { row: rowGuess, mediaCell: photoTd, infoCell: atcTd, table: tableGuess };
      }
    }
    if (!layout || !layout.table) return false;

    var row = layout.row;
    var mediaTd = layout.mediaCell;
    var infoTd = layout.infoCell;
    var table = layout.table;

    qsa("td.mc-unified-pdp-media, td.mc-unified-pdp-info").forEach(function (td) {
      if (td === mediaTd || td === infoTd) return;
      td.classList.remove("mc-unified-pdp-media", "mc-unified-pdp-info", "mc-pdp-media-td", "mc-pdp-options-td");
    });
    qsa("tr.mc-unified-pdp-row").forEach(function (tr) {
      if (tr !== row) tr.classList.remove("mc-unified-pdp-row", "mc-pdp-main-row");
    });

    if (!row.classList.contains("mc-unified-pdp-row")) row.classList.add("mc-unified-pdp-row", "mc-pdp-main-row");
    if (!mediaTd.classList.contains("mc-unified-pdp-media")) {
      mediaTd.classList.add("mc-unified-pdp-media", "mc-pdp-media-td");
    }
    if (!infoTd.classList.contains("mc-unified-pdp-info")) {
      infoTd.classList.add("mc-unified-pdp-info", "mc-pdp-options-td");
    }

    if (!row.dataset.mcUnifiedLayoutCleared) {
      clearInlineLayout(row);
      row.dataset.mcUnifiedLayoutCleared = "1";
    }
    if (!mediaTd.dataset.mcUnifiedLayoutCleared) {
      clearInlineLayout(mediaTd);
      mediaTd.dataset.mcUnifiedLayoutCleared = "1";
    }
    if (!infoTd.dataset.mcUnifiedLayoutCleared) {
      clearInlineLayout(infoTd);
      infoTd.dataset.mcUnifiedLayoutCleared = "1";
    }
    normalizeMediaColumn(mediaTd);
    if (
      global.document.body &&
      global.document.body.classList.contains("mc-bean-bag-pdp")
    ) {
      try {
        if (typeof global.mcReassertBeanBagHeroMedia === "function") {
          global.mcReassertBeanBagHeroMedia();
        }
      } catch (eBbMedia) {}
    }
    global.document.body.classList.remove("mc-fixed-sectional-pdp");

    try {
      if (typeof global.mcPrepareUnifiedPdpHero === "function") {
        global.mcPrepareUnifiedPdpHero();
      }
    } catch (eHeroPrep) {}

    ensureReturnRow(row, table);
    ensurePurchaseControls(infoTd, atc);
    orderInfoColumn(infoTd);
    hideDuplicatePriceBlocks(infoTd);

    var desc = findDescriptionNode();
    ensureDescriptionRow(row, table, desc, mediaTd);

    global.document.body.classList.add("mc-pdp-unified-ready", "mc-pdp-hero-ready");
    global.document.documentElement.dataset.mcPdpNormalized = "1";
    global.document.body.dataset.mcPdpLayoutMounted = "1";
    global.document.body.dataset.mcPdpLayoutVer = AUTH_LAYOUT_VER;
    global.document.body.dataset.mcUnifiedPdpVer = LAYOUT_VER;

    try {
      if (typeof global.mcSyncHomeBodyClass === "function") global.mcSyncHomeBodyClass();
    } catch (eSync) {}

    try {
      if (
        global.document.body &&
        global.document.body.classList.contains("mc-bean-bag-pdp") &&
        typeof global.mcAppendBeanBagInfoColumnOrder === "function"
      ) {
        global.mcAppendBeanBagInfoColumnOrder();
      }
    } catch (eBbOrder) {}

    global.__MC_PDP_HERO_READY_LOCKED__ = true;
    markUnifiedStable();
    return true;
  }

  global.mcNormalizePdpLayout = mcNormalizePdpLayout;

  function scheduleNormalize() {
    if (isUnifiedStable() || global.__MC_PDP_MO_PAUSE__) return;
    if (moTimer) clearTimeout(moTimer);
    moTimer = setTimeout(function () {
      moTimer = null;
      if (isUnifiedStable() || global.__MC_PDP_MO_PAUSE__) return;
      mcNormalizePdpLayout();
    }, 120);
  }

  function bindMutationObserver() {
    if (moBound || isUnifiedStable()) return;
    var root = qs("#v65-product-parent") || qs("#content_area");
    if (!root || typeof MutationObserver === "undefined") return;
    moBound = true;
    moInstance = new MutationObserver(function () {
      if (!isPDP() || isSectionalConfigurator() || isUnifiedStable()) return;
      if (global.__MC_PDP_MO_PAUSE__) return;
      scheduleNormalize();
    });
    moInstance.observe(root, { childList: true, subtree: true });
    global.__MC_UNIFIED_PDP_MO__ = moInstance;
  }

  function boot() {
    if (mcNormalizePdpLayout()) return;
    bindMutationObserver();
  }

  function forceNormalizePass() {
    global.__MC_UNIFIED_PDP_STABLE__ = false;
    mcNormalizePdpLayout();
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  global.addEventListener("load", function () {
    if (!isUnifiedStable()) mcNormalizePdpLayout();
  });
  [250, 800, 1600].forEach(function (delay) {
    global.setTimeout(forceNormalizePass, delay);
  });
})(window);
