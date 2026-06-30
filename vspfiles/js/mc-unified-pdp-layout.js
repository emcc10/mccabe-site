/**
 * MC unified PDP layout — runs without template rebake.
 * Loaded by mc-pdp-auth-cta-fix.js on product detail pages.
 */
(function (global) {
  "use strict";


  var LAYOUT_VER = "20260630sarlayout1";
  var AUTH_LAYOUT_VER = "20260630sarlayout1";
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

  var BEDROOM_PIECE_RE = /\b(chest|dresser|king bed|queen bed|bed|nightstand|night stand|mirror|armoire|wardrobe|media chest|gentlemans chest|gentleman's chest|drawer chest|door chest|bachelor chest|california king bed|cal king bed|twin bed|full bed)\b/i;
  var STATIC_BEDROOM_PRODUCTS = [
    { c: "SS-BC900CTT", n: "Bear Creek Chest", co: "Bear Creek" },
    { c: "SS-BC950CTBT", n: "Bear Creek Chest", co: "Bear Creek" },
    { c: "SS-BC900DR", n: "Bear Creek Dresser", co: "Bear Creek" },
    { c: "SS-BC950DRB", n: "Bear Creek Dresser", co: "Bear Creek" },
    { c: "SS-BC950KFB", n: "Bear Creek King Bed, Brown", co: "Bear Creek" },
    { c: "SS-BC900MR", n: "Bear Creek Mirror", co: "Bear Creek" },
    { c: "SS-BC950MRB", n: "Bear Creek Mirror", co: "Bear Creek" },
    { c: "SS-BC900NS", n: "Bear Creek Nightstand", co: "Bear Creek" },
    { c: "SS-BC950NSB", n: "Bear Creek Nightstand", co: "Bear Creek" },
    { c: "SS-BC950QFB", n: "Bear Creek Queen Bed, Brown", co: "Bear Creek" },
    { c: "SS-CAS900C", n: "Cassie Illuminating Chest", co: "Cassie Illuminating" },
    { c: "SS-CAS900DR", n: "Cassie Illuminating Dresser", co: "Cassie Illuminating" },
    { c: "SS-CAS900KFB", n: "Cassie Illuminating King Bed, Shimmering Pearl Finish", co: "Cassie Illuminating" },
    { c: "SS-CAS900M", n: "Cassie Illuminating Mirror", co: "Cassie Illuminating" },
    { c: "SS-CAS900NS", n: "Cassie Illuminating Nightstand", co: "Cassie Illuminating" },
    { c: "SS-CAS900QFB", n: "Cassie Illuminating Queen Bed, Shimmering Pearl Finish", co: "Cassie Illuminating" },
    { c: "SS-HP900CTWT", n: "Highland Park Chest, Cathedral White", co: "Highland Park" },
    { c: "SS-HP900CTDT", n: "Highland Park Chest, Waxed Driftwood", co: "Highland Park" },
    { c: "SS-HP900KFBW", n: "Highland Park King Bed, Cathedral White", co: "Highland Park" },
    { c: "SS-HP900KFBD", n: "Highland Park King Bed, Waxed Driftwood", co: "Highland Park" },
    { c: "SS-HP900MRW", n: "Highland Park Mirror, Cathedral White", co: "Highland Park" },
    { c: "SS-HP900MRD", n: "Highland Park Mirror, Waxed Driftwood", co: "Highland Park" },
    { c: "SS-HP900NSW", n: "Highland Park Nightstand, Cathedral White", co: "Highland Park" },
    { c: "SS-HP900NSD", n: "Highland Park Nightstand, Waxed Driftwood", co: "Highland Park" },
    { c: "SS-HP900QFBW", n: "Highland Park Queen Bed, Cathedral White", co: "Highland Park" },
    { c: "SS-HP900QFBD", n: "Highland Park Queen Bed, Waxed Driftwood", co: "Highland Park" }
  ];

  function mcBedroomText(el) {
    return (el && String(el.textContent || (el.getAttribute && el.getAttribute("content")) || "").replace(/\s+/g, " ").trim()) || "";
  }

  function mcBedroomCleanName(value) {
    return String(value || "")
      .replace(/\s+-\s+McCabe.*$/i, "")
      .replace(/\s+\|\s+McCabe.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function mcBedroomCurrentName() {
    var candidates = [
      qs('h1[itemprop="name"]'),
      qs(".productnamecolorLARGE"),
      qs("#productname"),
      qs(".productnamecolor"),
      qs("h1"),
      qs('meta[property="og:title"]'),
      qs('meta[name="twitter:title"]'),
      qs('[itemprop="name"]')
    ];
    for (var i = 0; i < candidates.length; i++) {
      var name = mcBedroomCleanName(mcBedroomText(candidates[i]) || (candidates[i] && candidates[i].content));
      if (name && name.length > 2) return name;
    }
    return mcBedroomCleanName(global.document.title);
  }

  function mcBedroomCollectionFromName(name) {
    name = mcBedroomCleanName(name);
    if (!BEDROOM_PIECE_RE.test(name)) return "";
    var match = name.match(new RegExp("^(.*?)\\s+" + BEDROOM_PIECE_RE.source + "(?:[\\s,\\-]|$)", "i"));
    if (match && match[1]) return mcBedroomCleanName(match[1]);
    var words = name.split(/\s+/);
    if (/^the$/i.test(words[0]) && words.length > 2) return words.slice(0, 2).join(" ");
    if (words.length > 2) return words.slice(0, 2).join(" ");
    if (words.length > 1) return words.join(" ");
    return "";
  }

  function mcBedroomAbs(url) {
    if (!url) return "";
    try {
      return new URL(url, global.location.href).href;
    } catch (eUrl) {
      return url;
    }
  }

  function mcBedroomProductCode() {
    return String(
      global.global_Current_ProductCode ||
        (qs('input[name="ProductCode"]') && qs('input[name="ProductCode"]').value) ||
        ""
    ).toLowerCase();
  }

  function mcBedroomIsCurrentUrl(url) {
    var href = String(url || "").toLowerCase();
    var code = mcBedroomProductCode();
    return (
      href &&
      (href.replace(/\/$/, "") === String(global.location.href).toLowerCase().replace(/\/$/, "") ||
        href.replace(/\/$/, "") === String(global.location.pathname).toLowerCase().replace(/\/$/, "") ||
        (code && href.indexOf(code) > -1))
    );
  }

  function mcBedroomRelatedAnchor() {
    var direct =
      qs("#v65-product-related") ||
      qs("#related_products") ||
      qs("#ProductDetail_ProductDetails_divRelatedProducts") ||
      qs('[id*="RelatedProducts"]') ||
      qs(".related-products") ||
      qs(".v65-product-related");
    if (direct) return direct;
    var headings = qsa("h2,h3,h4,.v65-product-related-header,.related-title,.section-title");
    for (var i = 0; i < headings.length; i++) {
      if (/related\s+items|you\s+may\s+also\s+like|related\s+products/i.test(mcBedroomText(headings[i]))) {
        return (headings[i].closest && headings[i].closest("table,section,div")) || headings[i];
      }
    }
    return null;
  }

  function mcBedroomAddCss() {
    if (qs("#mc-bedroom-collection-css")) return;
    var st = global.document.createElement("style");
    st.id = "mc-bedroom-collection-css";
    st.textContent =
      "#mc-bedroom-collection{clear:both;margin:34px 0 26px;padding:22px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-family:Inter,Arial,sans-serif}" +
      "#mc-bedroom-collection .mc-collection-heading{margin:0 0 16px;color:#222;font-size:22px;font-weight:400;line-height:1.25;letter-spacing:0;text-transform:none}" +
      "#mc-bedroom-collection .mc-collection-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:18px}" +
      "#mc-bedroom-collection .mc-collection-card{display:block;color:#333;text-decoration:none}" +
      "#mc-bedroom-collection .mc-collection-image{display:block;width:100%;aspect-ratio:1/1;background:#f6f4f0;border:1px solid #ddd;overflow:hidden}" +
      "#mc-bedroom-collection .mc-collection-image img{display:block;width:100%;height:100%;object-fit:contain}" +
      "#mc-bedroom-collection .mc-collection-name{display:block;margin:9px 0 0;font-size:14px;line-height:1.35;color:#333}" +
      "#mc-bedroom-collection .mc-collection-price{display:block;margin:4px 0 0;font-size:13px;line-height:1.3;color:#666}" +
      "#mc-bedroom-collection .mc-collection-card:hover .mc-collection-name{text-decoration:underline}" +
      "@media(max-width:640px){#mc-bedroom-collection{margin:26px 0 22px;padding:18px 0}#mc-bedroom-collection .mc-collection-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#mc-bedroom-collection .mc-collection-heading{font-size:20px}}";
    (global.document.head || global.document.documentElement).appendChild(st);
  }

  function mcBedroomCardRoot(anchor) {
    return (
      (anchor.closest &&
        anchor.closest(".v-product, .product, .product-card, .product-wrapper, .product-row, td, li, article, div")) ||
      anchor
    );
  }

  function mcBedroomFindName(anchor, card) {
    var img = qs("img", anchor) || qs("img", card);
    return mcBedroomCleanName(
      mcBedroomText(qs(".productnamecolor, .productnamecolorSMALL, .product-name, .productname, [itemprop='name']", card)) ||
        mcBedroomText(anchor) ||
        (anchor.getAttribute && anchor.getAttribute("title")) ||
        (img && (img.alt || img.title))
    );
  }

  function mcBedroomFindPrice(card) {
    return mcBedroomText(qs(".productprice, .price, [itemprop='price'], .saleprice, .ourprice", card));
  }

  function mcBedroomFindImage(anchor, card) {
    var img = qs("img", anchor) || qs("img", card);
    return img ? mcBedroomAbs(img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("src")) : "";
  }

  function mcBedroomProductsFromDoc(doc, collection, current) {
    var seen = {};
    return Array.prototype.map
      .call(doc.querySelectorAll("a[href]"), function (anchor) {
        var href = mcBedroomAbs(anchor.getAttribute("href"));
        if (!href || !/product|product-p|\/p\/|ProductDetails\.asp|-p\//i.test(href)) return null;
        var card = mcBedroomCardRoot(anchor);
        var name = mcBedroomFindName(anchor, card);
        if (!name || name.toLowerCase() === current.toLowerCase()) return null;
        if (name.toLowerCase().indexOf(collection.toLowerCase()) === -1) return null;
        if (!BEDROOM_PIECE_RE.test(name)) return null;
        if (mcBedroomIsCurrentUrl(href)) return null;
        var key = href.split("#")[0].split("?")[0].toLowerCase();
        if (seen[key]) return null;
        seen[key] = true;
        return { name: name, href: href, image: mcBedroomFindImage(anchor, card), price: mcBedroomFindPrice(card) };
      })
      .filter(Boolean);
  }

  function mcBedroomRender(products, collection) {
    if (!products.length || qs("#mc-bedroom-collection")) return;
    mcBedroomAddCss();
    var section = global.document.createElement("section");
    section.id = "mc-bedroom-collection";
    section.setAttribute("aria-labelledby", "mc-bedroom-collection-heading");
    section.setAttribute("data-mc-collection-source", collection);
    var h = global.document.createElement("h2");
    h.id = "mc-bedroom-collection-heading";
    h.className = "mc-collection-heading";
    h.textContent = "The Collection";
    section.appendChild(h);
    var grid = global.document.createElement("div");
    grid.className = "mc-collection-grid";
    products.forEach(function (product) {
      var a = global.document.createElement("a");
      a.className = "mc-collection-card";
      a.href = product.href;
      var media = global.document.createElement("span");
      media.className = "mc-collection-image";
      if (product.image) {
        var img = global.document.createElement("img");
        img.loading = "lazy";
        img.alt = product.name;
        img.src = product.image;
        media.appendChild(img);
      }
      a.appendChild(media);
      var name = global.document.createElement("span");
      name.className = "mc-collection-name";
      name.textContent = product.name;
      a.appendChild(name);
      if (product.price) {
        var price = global.document.createElement("span");
        price.className = "mc-collection-price";
        price.textContent = product.price;
        a.appendChild(price);
      }
      grid.appendChild(a);
    });
    section.appendChild(grid);
    var related = mcBedroomRelatedAnchor();
    if (related && related.parentNode) related.parentNode.insertBefore(section, related);
  }

  function renderBedroomCollectionFallback() {
    if (qs("#mc-bedroom-collection")) return;
    var name = mcBedroomCurrentName();
    var collection = mcBedroomCollectionFromName(name);
    if (!collection) return;
    var currentCode = mcBedroomProductCode().toUpperCase();
    var staticProducts = STATIC_BEDROOM_PRODUCTS.filter(function (product) {
      return product.co.toLowerCase() === collection.toLowerCase() && product.c.toUpperCase() !== currentCode;
    }).map(function (product) {
      return {
        name: product.n,
        href: "/product-p/" + product.c.toLowerCase() + ".htm",
        image: "/v/vspfiles/photos/" + product.c + "-1.jpg",
        price: ""
      };
    });
    if (staticProducts.length) mcBedroomRender(staticProducts, collection);
    if (qs("#mc-bedroom-collection")) return;
    try {
      if (typeof XMLHttpRequest === "undefined" || typeof DOMParser === "undefined") return;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "/SearchResults.asp?Search=" + encodeURIComponent(collection), true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || xhr.status < 200 || xhr.status >= 300) return;
        var doc = new DOMParser().parseFromString(xhr.responseText, "text/html");
        mcBedroomRender(mcBedroomProductsFromDoc(doc, collection, name), collection);
      };
      xhr.send();
    } catch (eBedroomFallback) {}
  }

  function ensureUnifiedDescriptionClampCss() {
    if (qs("#mc-unified-description-clamp-css")) return;
    var st = global.document.createElement("style");
    st.id = "mc-unified-description-clamp-css";
    st.textContent =
      "#mc-pdp-description-below-features.mc-pdp-description-below-features--clamped .mc-pdp-description-below-features__inner{" +
      "position:relative!important;overflow:hidden!important;max-height:var(--mc-desc-clamp-height,180px)!important}" +
      "#mc-pdp-description-below-features.mc-pdp-description-below-features--expanded .mc-pdp-description-below-features__inner{" +
      "max-height:none!important;overflow:visible!important}" +
      "#mc-pdp-description-below-features .mc-pdp-description-view-more{display:none!important}" +
      "#mc-pdp-description-below-features.mc-pdp-description-below-features--clamped .mc-pdp-description-view-more," +
      "#mc-pdp-description-below-features.mc-pdp-description-below-features--expanded .mc-pdp-description-view-more{" +
      "display:inline-block!important;margin:6px 0 0 0!important;padding:0!important;border:0!important;background:transparent!important;color:#111!important;" +
      "font:600 12px/1.35 Inter,Arial,sans-serif!important;letter-spacing:.12em!important;text-transform:uppercase!important;text-decoration:underline!important;cursor:pointer!important}" +
      "#mc-pdp-description-below-features.mc-pdp-description-below-features--clamped:not(.mc-pdp-description-below-features--expanded) .mc-pdp-description-below-features__inner:after{" +
      "content:\"\"!important;position:absolute!important;left:0!important;right:0!important;bottom:0!important;height:1.8em!important;pointer-events:none!important;" +
      "background:linear-gradient(to bottom,rgba(255,255,255,0),#fff 90%)!important}";
    (global.document.head || global.document.documentElement).appendChild(st);
  }

  function directChildByClass(parent, className) {
    if (!parent) return null;
    for (var i = 0; i < parent.children.length; i++) {
      if (parent.children[i].classList && parent.children[i].classList.contains(className)) return parent.children[i];
    }
    return null;
  }

  function ensureUnifiedDescriptionInner(host) {
    if (!host) return null;
    var inner = directChildByClass(host, "mc-pdp-description-below-features__inner");
    if (!inner) {
      inner = global.document.createElement("div");
      inner.className = "mc-pdp-description-below-features__inner";
      var child;
      while ((child = host.firstElementChild)) {
        if (child.classList && child.classList.contains("mc-pdp-description-view-more")) break;
        inner.appendChild(child);
      }
      host.insertBefore(inner, host.firstElementChild || null);
    }
    return inner;
  }

  function syncUnifiedDescriptionViewMore() {
    var host = qs("#mc-pdp-description-below-features");
    if (!host || !String(host.textContent || "").replace(/\s+/g, " ").trim()) return;
    var inner = ensureUnifiedDescriptionInner(host);
    if (!inner) return;
    ensureUnifiedDescriptionClampCss();

    var isDesktop = global.matchMedia && global.matchMedia("(min-width: 992px)").matches;
    var toggle = directChildByClass(host, "mc-pdp-description-view-more");
    if (!toggle) {
      toggle = global.document.createElement("button");
      toggle.type = "button";
      toggle.className = "mc-pdp-description-view-more";
      toggle.addEventListener("click", function () {
        var expanded = host.classList.toggle("mc-pdp-description-below-features--expanded");
        toggle.textContent = expanded ? "View less" : "... View more";
        if (!expanded) global.setTimeout(syncUnifiedDescriptionViewMore, 0);
      });
      host.appendChild(toggle);
    } else if (toggle.parentNode !== host) {
      host.appendChild(toggle);
    }

    if (!isDesktop) {
      host.classList.remove("mc-pdp-description-below-features--clamped", "mc-pdp-description-below-features--expanded");
      inner.style.removeProperty("--mc-desc-clamp-height");
      toggle.style.setProperty("display", "none", "important");
      return;
    }

    if (host.classList.contains("mc-pdp-description-below-features--expanded")) {
      toggle.textContent = "View less";
      return;
    }

    var img = qs("#product_photo") || qs("td.mc-unified-pdp-media img#product_photo, td.mc-pdp-media-td img#product_photo, img#main-image");
    var lineHeight = parseFloat(global.getComputedStyle(inner).lineHeight || "0");
    if (!lineHeight || lineHeight < 12) lineHeight = 24;

    inner.style.removeProperty("--mc-desc-clamp-height");
    host.classList.remove("mc-pdp-description-below-features--clamped");
    var fullHeight = inner.scrollHeight;
    var available = lineHeight * 8;
    if (img) {
      var imgRect = img.getBoundingClientRect();
      var hostRect = host.getBoundingClientRect();
      var byImage = imgRect.bottom - hostRect.top - 34;
      if (byImage > lineHeight * 3) available = byImage;
    }
    var lines = Math.max(3, Math.floor(available / lineHeight));
    var maxHeight = Math.floor(lines * lineHeight);

    if (fullHeight <= maxHeight + Math.ceil(lineHeight / 2)) {
      host.classList.remove("mc-pdp-description-below-features--clamped", "mc-pdp-description-below-features--expanded");
      toggle.style.setProperty("display", "none", "important");
      return;
    }

    inner.style.setProperty("--mc-desc-clamp-height", maxHeight + "px");
    host.classList.add("mc-pdp-description-below-features--clamped");
    host.classList.remove("mc-pdp-description-below-features--expanded");
    toggle.textContent = "... View more";
    toggle.style.setProperty("display", "inline-block", "important");
  }

  function ensureBedroomCollectionSection() {
    if (!isPDP()) return;
    if (global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ || global.__MC_BEDROOM_COLLECTION_SECTION_20260620__) return;
    if (qs("script[src*='mc-bedroom-collection-section.js']")) return;
    try {
      global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = true;
      var s = global.document.createElement("script");
      s.src = "/v/vspfiles/js/mc-bedroom-collection-section.js?v=20260620collection2&mcrd=" + Date.now();
      s.async = true;
      s.onload = function () {
        global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = false;
      };
      s.onerror = function () {
        global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = false;
      };
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eCollectionLoad) {
      global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = false;
    }
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
    var features = info && qs("#mc-pdp-features", info);
    var description = info && qs("#mc-pdp-description-below-features", info);
    var accordion = info && qs("#mc-pdp-accordion", info);
    // If features/description live inside the accordion, the accordion is the
    // single direct child to order — not the loose blocks.
    var contentNodes =
      accordion &&
      (accordion.contains(features) ||
        accordion.contains(description) ||
        (body && body.classList.contains("mc-mahjong-house-pdp")) ||
        !!qs("#mc-acc-saranoni-product-details-host", accordion))
        ? [accordion]
        : [features, description];
    var orderedOk = !info || childrenInOrder(
      info,
      [
        qs("#mc-pdp-brand-logo", info),
        qs("#mc-pdp-title-right", info),
        qs("#mc-pdp-price-stack-host", info) || qs("#mc-pdp-price-atc-row", info),
        collectFinanceBlock(info),
      ].concat(contentNodes).concat([
        qs(".mc-unified-purchase-controls", info),
      ]).filter(Boolean)
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
      qs(".mc-pdp-return-link") &&
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

  function lookupCategoryById(catId) {
    var id = String(catId || "");
    if (!/^\d+$/.test(id)) return null;
    var sel =
      'a[href$="-s/' +
      id +
      '.htm"], a[href*="-s/' +
      id +
      '.htm"], a[href*="category-s/' +
      id +
      '.htm"]';
    var roots = [qs("#display_menu_1"), qs("#display_menu_2"), qs("#content_area"), global.document.body];
    var links = [];
    var ri;
    for (ri = 0; ri < roots.length; ri++) {
      if (!roots[ri]) continue;
      qsa(sel, roots[ri]).forEach(function (link) {
        if (links.indexOf(link) === -1) links.push(link);
      });
    }
    if (!links.length) qsa(sel).forEach(function (link) {
      if (links.indexOf(link) === -1) links.push(link);
    });
    var i;
    for (i = 0; i < links.length; i++) {
      var name = (links[i].textContent || "").replace(/\s+/g, " ").trim();
      var href = links[i].getAttribute("href") || "";
      if (!name || !href || /about us/i.test(name)) continue;
      return { name: name, href: href };
    }
    return { name: "", href: "/category-s/" + id + ".htm" };
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
    if (/^SAR/.test(pc) && /(CHAIR|SAUCER|PILLOW|SOCK|SWADDLE|HAT|BAMBONI|RUG)/.test(hay)) {
      var luxeBc = lookupCategoryById("196");
      if (luxeBc && luxeBc.name) return luxeBc;
      return { name: "Luxe Comforts", href: "/category-s/196.htm" };
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
    return null;
  }

  function resolveReturnCategory() {
    if (typeof global.mcResolvePdpReturnCategory === "function") {
      try {
        var shared = global.mcResolvePdpReturnCategory();
        if (shared && shared.name && String(shared.name).toUpperCase() !== "FURNITURE") return shared;
      } catch (eShared) {}
    }
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
      "LUXE COMFORTS": true,
    };
    var BLOCK = { 136: true };
    if (fallback && productAwareNames[String(fallback.name || "").toUpperCase()]) return fallback;
    var bcTd = qs("#v65-product-parent .vCSS_breadcrumb_td, #content_area .vCSS_breadcrumb_td");
    var links = bcTd ? qsa('a[href*="-s/"], a[href*="category-s/"]', bcTd) : [];
    var ids = parseBreadCrumbIds();

    var pc = "";
    try {
      pc = String((qs('input[name="ProductCode"], input[name="productcode"]') || {}).value || "").toUpperCase();
    } catch (ePc) {}
    var sarLeafOrder = ["208", "207", "206", "196", "205"];
    var filtered = [];
    var fi;
    for (fi = 0; fi < ids.length; fi++) {
      if (ids[fi] !== "136" && filtered.indexOf(ids[fi]) === -1) filtered.push(ids[fi]);
    }
    if (/^SAR/.test(pc)) {
      for (fi = 0; fi < sarLeafOrder.length; fi++) {
        if (filtered.indexOf(sarLeafOrder[fi]) === -1) continue;
        var sid = sarLeafOrder[fi];
        var sj;
        for (sj = links.length - 1; sj >= 0; sj--) {
          var shref = links[sj].getAttribute("href") || "";
          if (
            shref.indexOf("-s/" + sid) !== -1 ||
            shref.indexOf("category-s/" + sid) !== -1 ||
            new RegExp("[?&]categoryid=" + sid + "\\b", "i").test(shref)
          ) {
            var sname = (links[sj].textContent || "").replace(/\s+/g, " ").trim();
            if (sname) return { name: sname, href: shref };
          }
        }
        var snav = lookupCategoryById(sid);
        if (snav && snav.name) return snav;
      }
    }

    var i;
    for (i = ids.length - 1; i >= 0; i--) {
      if (BLOCK[ids[i]] && ids.length > 1) continue;
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
      var navHit = lookupCategoryById(id);
      if (navHit && navHit.name) return navHit;
    }

    for (i = links.length - 1; i >= 0; i--) {
      var t = (links[i].textContent || "").replace(/\s+/g, " ").trim();
      var h = links[i].getAttribute("href") || "";
      if (!t || !h || /about us/i.test(t)) continue;
      return { name: t, href: h };
    }
    if (fallback && String(fallback.name || "").toUpperCase() !== "FURNITURE") return fallback;
    if (ids.length) {
      var deepest = lookupCategoryById(ids[ids.length - 1]);
      if (deepest && deepest.name) return deepest;
    }
    return { name: "Shop", href: "/" };
  }

  global.mcResolvePdpReturnCategory = resolveReturnCategory;

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
    if (
      global.document.body &&
      global.document.body.classList.contains("mc-saranoni-swatches-ready")
    ) {
      seen = seen.filter(function (el) {
        return el && el.id !== "mc-configured-color-swatch-wrapper";
      });
    }
    return seen;
  }

  function moveRebakedTitleIntoInfo(infoTd) {
    if (!infoTd) return;
    if (typeof global.mcEnsureSoftGoodsPdpLayout === "function") {
      try {
        if (
          global.document.body &&
          (global.document.body.classList.contains("mc-bean-bag-pdp") ||
            global.document.body.classList.contains("mc-saranoni-pdp") ||
            global.document.body.classList.contains("mc-mahjong-house-pdp"))
        ) {
          return;
        }
      } catch (eSg) {}
    }
    var titleWrap = qs("#mc-pdp-title-right");
    if (!titleWrap) {
      titleWrap = global.document.createElement("div");
      titleWrap.id = "mc-pdp-title-right";
      titleWrap.className = "mc-pdp-title-right";
    }
    var src =
      qs("#v65-product-parent td.vCSS_breadcrumb_td h1.vp-product-title") ||
      qs("#v65-product-parent h1.vp-product-title");
    if (src && !titleWrap.contains(src)) {
      titleWrap.appendChild(src);
    }
    if (!titleWrap.querySelector("h1, [itemprop='name'], .productnamecolor")) return;
    if (titleWrap.parentNode !== infoTd) {
      try {
        infoTd.insertBefore(titleWrap, infoTd.firstChild || null);
      } catch (eTitle) {
        infoTd.appendChild(titleWrap);
      }
    }
    qsa("#v65-product-parent td.vCSS_breadcrumb_td h1.vp-product-title").forEach(function (h1) {
      if (titleWrap.contains(h1)) return;
      try {
        h1.style.setProperty("display", "none", "important");
      } catch (eHide) {}
    });
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
    if (isMahjongHousePdp()) {
      finalizeMahjongHouseInfoColumn();
      return;
    }
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
    var description = qs("#mc-pdp-description-below-features", infoTd);
    var accordion = qs("#mc-pdp-accordion", infoTd);
    var purchase =
      qs("#mc-pdp-purchase-stack", infoTd) ||
      qs(".mc-unified-purchase-controls", infoTd);

    scoopLooseQtyIntoPurchase(infoTd, purchase);

    // When features/description have been folded into the accordion (Saranoni
    // and Steve Silver PDPs), order the accordion as a single unit instead of
    // pulling its contents back out as loose info-column children.
    var accordionOwnsContent =
      accordion &&
      (accordion.contains(features) ||
        accordion.contains(description) ||
        !!qs("#mc-acc-saranoni-product-details-host", accordion) ||
        !!qs("#mc-acc-saranoni-features-host", accordion));

    var ordered = [];
    [logo, title, price, klarna].forEach(function (el) {
      if (el && ordered.indexOf(el) === -1) ordered.push(el);
    });
    options.forEach(function (el) {
      if (ordered.indexOf(el) === -1) ordered.push(el);
    });
    if (accordionOwnsContent) {
      if (ordered.indexOf(accordion) === -1) ordered.push(accordion);
    } else {
      if (features && ordered.indexOf(features) === -1) ordered.push(features);
      if (description && ordered.indexOf(description) === -1) ordered.push(description);
    }
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

  function isSteveSilverPdp() {
    try {
      if (global.document.body && global.document.body.classList.contains("mc-steve-silver-altview-pdp")) {
        return true;
      }
      var input = global.document.querySelector('input[name="ProductCode"]');
      var code = String(
        (global.global_Current_ProductCode || "") || (input && input.value) || ""
      ).toUpperCase();
      return /^SS-/.test(code);
    } catch (e) {
      return false;
    }
  }

  function isMahjongHousePdp() {
    try {
      if (global.document.body && global.document.body.classList.contains("mc-mahjong-house-pdp")) {
        return true;
      }
      var input = global.document.querySelector('input[name="ProductCode"]');
      var code = String(
        (global.global_Current_ProductCode || "") || (input && input.value) || ""
      ).toUpperCase();
      return /^TMH-/.test(code);
    } catch (e) {
      return false;
    }
  }

  function finalizeMahjongHouseInfoColumn() {
    if (!isMahjongHousePdp()) return;
    try {
      if (typeof global.mcAppendMahjongHouseInfoColumnOrder === "function") {
        global.mcAppendMahjongHouseInfoColumnOrder();
      } else if (typeof global.mcEnsureMahjongHousePdpCorrections === "function") {
        global.mcEnsureMahjongHousePdpCorrections();
      }
    } catch (eTmhFin) {}
  }

  function normalizeMediaColumn(mediaTd) {
    if (!mediaTd) return;
    var isBeanBag =
      global.document.body && global.document.body.classList.contains("mc-bean-bag-pdp");
    var isSteveSilver = isSteveSilverPdp();
    var isDesktop = global.matchMedia && global.matchMedia("(min-width: 992px)").matches;
    var isSaranoni =
      global.document.body && global.document.body.classList.contains("mc-saranoni-pdp");
    var imgMaxW = isBeanBag ? "600px" : isSaranoni ? "720px" : "650px";
    var img = qs("#product_photo, .vCSS_img_product_photo, .vcss_img_wrap img, img#main-image", mediaTd) || qs("#product_photo, .vCSS_img_product_photo, .vcss_img_wrap img, img#main-image");
    if (img && img.style) {
      var imgNormVer = img.getAttribute("data-mc-media-norm") || "";
      if (imgNormVer !== LAYOUT_VER) {
        img.setAttribute("data-mc-media-norm", LAYOUT_VER);
        img.style.removeProperty("max-width");
        img.style.removeProperty("width");
        img.style.removeProperty("height");
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("height", "auto", "important");
        img.style.setProperty("max-height", "none", "important");
        img.style.setProperty("object-fit", "contain", "important");
        if (isSteveSilver) {
          img.style.setProperty("width", isDesktop ? "650px" : "100%", "important");
          img.style.setProperty("max-width", imgMaxW, "important");
          img.style.setProperty("margin", isDesktop ? "0" : "0 auto", "important");
        } else {
          img.style.setProperty("width", "100%", "important");
          img.style.setProperty("max-width", imgMaxW, "important");
          img.style.setProperty("margin", "0 0 0 auto", "important");
        }
      }
    }

    var alt = qs("#altviews, .altviews, [id*='altviews'], [class*='altviews']", document);
    var ssWrap = isSteveSilver ? qs("#mc-steve-silver-altviews-wrap", mediaTd) : null;
    if (alt && ssWrap && ssWrap.contains(alt)) {
      /* Steve Silver altviews are positioned by mc-steve-silver-altviews-wrap — do not reparent. */
    } else if (alt && !mediaTd.contains(alt)) {
      mediaTd.appendChild(alt);
    }
    if (alt && alt.style) {
      var altNormVer = alt.getAttribute("data-mc-alt-norm") || "";
      if (altNormVer === LAYOUT_VER) {
        /* styles already applied */
      } else {
      alt.setAttribute("data-mc-alt-norm", LAYOUT_VER);
      alt.classList.add("mc-unified-altviews");
      alt.style.setProperty("display", "flex", "important");
      alt.style.setProperty("flex-direction", "row", "important");
      alt.style.setProperty("align-items", isSteveSilver && isDesktop ? "flex-start" : "center", "important");
      alt.style.setProperty(
        "justify-content",
        isSteveSilver && isDesktop ? "flex-start" : "center",
        "important"
      );
      alt.style.setProperty("gap", "10px", "important");
      alt.style.setProperty("flex-wrap", "wrap", "important");
      alt.style.setProperty("width", "100%", "important");
      alt.style.setProperty(
        "margin",
        isSteveSilver && isDesktop ? "10px 0 0 0" : "10px auto 0",
        "important"
      );
      alt.style.setProperty("padding", "0", "important");
      alt.style.setProperty("float", "none", "important");
      alt.style.setProperty("clear", "both", "important");
      }
    }

    var altWrap = qs("#mc-steve-silver-altviews-wrap, .mc-steve-silver-altviews-wrap", mediaTd);
    if (altWrap && altWrap.style) {
      altWrap.style.setProperty(
        "justify-content",
        isSteveSilver && isDesktop ? "flex-start" : "center",
        "important"
      );
      altWrap.style.setProperty(
        "margin",
        isSteveSilver && isDesktop ? "10px 0 0 0" : "10px auto 0",
        "important"
      );
    }
  }

  function findAltViewsAnchor(mediaTd) {
    if (!mediaTd) return null;
    return (
      qs("#mc-steve-silver-altviews-wrap", mediaTd) ||
      qs("#mc-centered-altviews-wrap", mediaTd) ||
      qs("#altviews, span#altviews, .mc-unified-altviews", mediaTd)
    );
  }

  function insertNodeAfterAltViews(mediaTd, node) {
    if (!mediaTd || !node) return;
    var anchor = findAltViewsAnchor(mediaTd);
    if (anchor && anchor.parentNode) {
      if (anchor.nextSibling) anchor.parentNode.insertBefore(node, anchor.nextSibling);
      else anchor.parentNode.appendChild(node);
      return;
    }
    mediaTd.appendChild(node);
  }

  function hideLegacyVolusionTabPanels(mediaTd) {
    var features = qs("#mc-pdp-features .mc-pdp-features__body");
    if (features && String(features.textContent || "").replace(/\s+/g, " ").trim().length > 10) {
      var tech = qs("#ProductDetail_TechSpecs_div");
      if (tech) {
        tech.style.setProperty("display", "none", "important");
        tech.setAttribute("aria-hidden", "true");
        tech.setAttribute("data-mc-native-panel-hidden", "1");
      }
      var extInfo = qs("#ProductDetail_ExtInfo_div");
      if (extInfo) {
        extInfo.style.setProperty("display", "none", "important");
        extInfo.setAttribute("aria-hidden", "true");
      }
    }

    var mediaDesc = qs(".mc-unified-pdp-description--media", mediaTd);
    if (!mediaDesc || !String(mediaDesc.textContent || "").replace(/\s+/g, " ").trim()) return;

    qsa("table.colors_descriptionbox").forEach(function (box) {
      if (!box || box.contains(mediaDesc)) return;
      if (box.querySelector("#ProductDetail_TechSpecs_div, #ProductDetail_ExtInfo_div")) {
        try {
          box.style.setProperty("display", "none", "important");
          box.setAttribute("aria-hidden", "true");
          box.setAttribute("data-mc-native-panel-hidden", "1");
        } catch (eTechBox) {}
        return;
      }
      var legacyDesc = box.querySelector(
        "#ProductDetail_ProductDetails_div2, #ProductDetail_ProductDetails_div"
      );
      if (!legacyDesc) return;
      if (mediaTd && mediaTd.contains(legacyDesc)) return;
      try {
        box.style.setProperty("display", "none", "important");
        box.setAttribute("aria-hidden", "true");
        box.setAttribute("data-mc-native-panel-hidden", "1");
      } catch (eDescBox) {}
    });
  }

  function findDescriptionNode() {
    var selectors = [
      "#mc-pdp-description-below-features",
      "#ProductDetail_ProductDetails_div2",
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
      if (text.length >= 40) return el;
    }
    return null;
  }

  function ensureDescriptionRow(mainRow, table, descNode, mediaTd) {
    if (isMahjongHousePdp()) {
      qsa(".mc-unified-pdp-description--media", mediaTd).forEach(function (stray) {
        if (!stray) return;
        try {
          stray.style.setProperty("display", "none", "important");
          stray.setAttribute("aria-hidden", "true");
        } catch (eTmhStray) {}
      });
      hideLegacyVolusionTabPanels(mediaTd);
      try {
        if (typeof global.mcMountDescriptionBelowFeatures === "function") {
          global.mcMountDescriptionBelowFeatures();
        }
        if (typeof global.mcHideNativeVolusionTabPanels === "function") {
          global.mcHideNativeVolusionTabPanels();
        }
        if (typeof global.mcSyncPdpDescriptionViewMore === "function") {
          global.mcSyncPdpDescriptionViewMore();
        }
      } catch (eTmhDesc) {}
      finalizeMahjongHouseInfoColumn();
      return;
    }
    if (isSteveSilverPdp()) {
      qsa(".mc-unified-pdp-description--media", mediaTd).forEach(function (stray) {
        if (!stray) return;
        try {
          stray.style.setProperty("display", "none", "important");
          stray.setAttribute("aria-hidden", "true");
        } catch (eStray) {}
      });
      var descRowSs = qs("tr.mc-pdp-description-row", table.tBodies && table.tBodies[0] ? table.tBodies[0] : table);
      if (descRowSs) {
        descRowSs.style.setProperty("display", "none", "important");
        descRowSs.setAttribute("aria-hidden", "true");
      }
      hideLegacyVolusionTabPanels(mediaTd);
      try {
        if (typeof global.mcMountDescriptionBelowFeatures === "function") {
          global.mcMountDescriptionBelowFeatures();
        }
        if (typeof global.mcAppendSteveSilverInfoColumnOrder === "function") {
          global.mcAppendSteveSilverInfoColumnOrder();
        }
        if (typeof global.mcSyncPdpDescriptionViewMore === "function") {
          global.mcSyncPdpDescriptionViewMore();
        }
        if (typeof global.mcHideNativeVolusionTabPanels === "function") {
          global.mcHideNativeVolusionTabPanels();
        }
      } catch (eSsDesc) {}
      try {
        var host = qs("#mc-pdp-description-below-features");
        var hostText = host ? String(host.textContent || "").replace(/\s+/g, " ").trim() : "";
        var descText = descNode ? String(descNode.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (host && descNode && descNode !== host && descText.length >= 40 && hostText.length < 20) {
          host.appendChild(descNode);
          global.setTimeout(syncUnifiedDescriptionViewMore, 0);
          global.setTimeout(syncUnifiedDescriptionViewMore, 250);
        }
      } catch (eSsDescMove) {}
      return;
    }

    if (!mainRow || !table || !mediaTd) return;
    var tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table;
    var descRow = qs("tr.mc-pdp-description-row", tbody);
    var wrapEl = qs(".mc-unified-pdp-description", mediaTd);
    if (!wrapEl) {
      wrapEl = global.document.createElement("div");
      wrapEl.className = "mc-unified-pdp-description mc-unified-pdp-description--media";
      insertNodeAfterAltViews(mediaTd, wrapEl);
    } else {
      wrapEl.classList.add("mc-unified-pdp-description--media");
      if (!mediaTd.contains(wrapEl)) insertNodeAfterAltViews(mediaTd, wrapEl);
      else {
        var anchor = findAltViewsAnchor(mediaTd);
        if (anchor && wrapEl.previousElementSibling !== anchor && anchor.parentNode) {
          if (anchor.nextSibling !== wrapEl) {
            if (anchor.nextSibling) anchor.parentNode.insertBefore(wrapEl, anchor.nextSibling);
            else anchor.parentNode.appendChild(wrapEl);
          }
        }
      }
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

    hideLegacyVolusionTabPanels(mediaTd);
    try {
      if (typeof global.mcHideNativeVolusionTabPanels === "function") {
        global.mcHideNativeVolusionTabPanels();
      }
    } catch (eHidePanels) {}
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
        global.document.body.classList.remove("mc-mahjong-house-pdp");
      } else if (/^TMH/.test(pc)) {
        global.document.body.classList.add("mc-mahjong-house-pdp");
        global.document.body.classList.remove("mc-saranoni-pdp", "mc-ruched-blanket-pdp", "mc-saranoni-pdp-init", "mc-saranoni-pdp-ready");
      } else {
        global.document.body.classList.remove("mc-saranoni-pdp", "mc-ruched-blanket-pdp", "mc-mahjong-house-pdp");
      }
      global.document.body.classList.toggle("mc-gatlin-sectional-pdp", /GATLIN/i.test(pc) && /-SECT/i.test(pc));
      global.document.body.classList.toggle("mc-steve-silver-altview-pdp", /^SS-/.test(pc));
    } catch (e) {}
  }

  function mcNormalizePdpLayout() {
    if (!isPDP()) return false;
    if (isSectionalConfigurator()) return false;
    if (isUnifiedStable()) return true;

    unwrapBadWrapper();
    tagProductBodyClasses();
    global.document.body.classList.add("mc-product-page");

    if (global.document.body && global.document.body.classList.contains("mc-bean-bag-pdp")) {
      var bbMain =
        qs("#product_photo") ||
        qs("#product_photo_td") ||
        qs(".vCSS_img_wrap img") ||
        qs("img#main-image");
      var bbAtc = findAtcButton();
      if (bbMain && bbAtc) {
        var bbLayout = findOuterProductRow(bbMain, bbAtc);
        if (bbLayout && bbLayout.table) {
          var bbRow = bbLayout.row;
          var bbMediaTd = bbLayout.mediaCell;
          var bbInfoTd = bbLayout.infoCell;
          if (!bbRow.classList.contains("mc-unified-pdp-row")) {
            bbRow.classList.add("mc-unified-pdp-row", "mc-pdp-main-row");
          }
          if (!bbMediaTd.classList.contains("mc-unified-pdp-media")) {
            bbMediaTd.classList.add("mc-unified-pdp-media", "mc-pdp-media-td");
          }
          if (!bbInfoTd.classList.contains("mc-unified-pdp-info")) {
            bbInfoTd.classList.add("mc-unified-pdp-info", "mc-pdp-options-td");
          }
          normalizeMediaColumn(bbMediaTd);
          try {
            if (typeof global.mcReassertBeanBagHeroMedia === "function") {
              global.mcReassertBeanBagHeroMedia();
            }
          } catch (eBbMedia) {}
          ensureReturnRow(bbRow, bbLayout.table);
        }
      }
      try {
        if (typeof global.mcEnsureSoftGoodsPdpLayout === "function") {
          global.mcEnsureSoftGoodsPdpLayout();
        } else if (typeof global.mcAppendBeanBagInfoColumnOrder === "function") {
          global.mcAppendBeanBagInfoColumnOrder();
        }
      } catch (eBbLayout) {}
      global.document.body.classList.add("mc-pdp-unified-ready", "mc-pdp-hero-ready");
      global.document.documentElement.dataset.mcPdpNormalized = "1";
      global.document.body.dataset.mcPdpLayoutMounted = "1";
      global.document.body.dataset.mcPdpLayoutVer = AUTH_LAYOUT_VER;
      global.document.body.dataset.mcUnifiedPdpVer = LAYOUT_VER;
      global.__MC_PDP_HERO_READY_LOCKED__ = true;
      markUnifiedStable();
      return true;
    }

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
    if (!layout || !layout.table) {
      var taggedMedia = qs("td.mc-pdp-media-td, td.mc-unified-pdp-media");
      var taggedInfo = qs("td.mc-pdp-options-td, td.mc-unified-pdp-info");
      if (taggedMedia && taggedInfo && taggedMedia !== taggedInfo && taggedMedia.parentNode === taggedInfo.parentNode) {
        var taggedRow = taggedMedia.parentNode;
        if (taggedRow && taggedRow.tagName === "TR") {
          var taggedTable = taggedRow.closest ? taggedRow.closest("table") : null;
          layout = {
            row: taggedRow,
            mediaCell: taggedMedia,
            infoCell: taggedInfo,
            table: taggedTable,
          };
        }
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
    moveRebakedTitleIntoInfo(infoTd);
    orderInfoColumn(infoTd);
    hideDuplicatePriceBlocks(infoTd);

    var desc = findDescriptionNode();
    ensureDescriptionRow(row, table, desc, mediaTd);
    syncUnifiedDescriptionViewMore();

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

    finalizeMahjongHouseInfoColumn();

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
    ensureBedroomCollectionSection();
    global.setTimeout(renderBedroomCollectionFallback, 700);
    global.setTimeout(renderBedroomCollectionFallback, 1800);
    global.setTimeout(syncUnifiedDescriptionViewMore, 900);
    global.setTimeout(syncUnifiedDescriptionViewMore, 1900);
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
    syncUnifiedDescriptionViewMore();
  });
  [250, 800, 1600].forEach(function (delay) {
    global.setTimeout(forceNormalizePass, delay);
  });
})(window);

