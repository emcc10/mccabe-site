/**
 * McCabe Cloudflare Worker — merge into the EXISTING worker on
 * mccabestheaterandliving.com (site already reports cfWorker).
 *
 * Keeps prior Stripe / CF-challenge stripping, and adds:
 *   Proxy stale cached Facebook checkout JS URLs to the new banner build
 *   so Mahjong shows "Mahjong Sale Ends Monday!" without waiting on a
 *   year-long CDN HIT for ?v=20260730fb15.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();

    /* Serve the new Facebook checkout / Mahjong override bytes even when the
       HTML still requests an old ?v= tag that Cloudflare has cached for a year. */
    if (/\/v\/vspfiles\/js\/mc-facebook-checkout\.js$/i.test(path)) {
      const fresh = new URL(
        "/v/vspfiles/js/mc-facebook-checkout-20260801fb17.js?v=1",
        url.origin
      );
      return fetch(fresh, request);
    }
    if (/\/v\/vspfiles\/js\/mc-fb-checkout-mahjong\.js$/i.test(path)) {
      const fresh = new URL(
        "/v/vspfiles/js/mc-fb-checkout-mahjong-20260801mj3.js?v=1",
        url.origin
      );
      return fetch(fresh, request);
    }

    const keepStripe =
      /shoppingcart|checkout|one-page-checkout|paymentform|orderform|paypal|myaccount/.test(
        path
      ) ||
      (/\.asp$/i.test(path) && /cart|check|pay|order|bill/i.test(path));

    const res = await fetch(request);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html")) return res;

    let rewriter = new HTMLRewriter();

    rewriter = rewriter.on("script", {
      element(el) {
        const src = el.getAttribute("src") || "";
        if (/cdn-cgi\/challenge-platform/i.test(src)) {
          el.remove();
          return;
        }
        if (!keepStripe && /js\.stripe\.com|stripe-push-cart|vpay-request-button/i.test(src)) {
          el.remove();
          return;
        }
        /* Also rewrite HTML tags so browsers request the uncached filenames. */
        if (/mc-facebook-checkout\.js/i.test(src)) {
          el.setAttribute(
            "src",
            "/v/vspfiles/js/mc-facebook-checkout-20260801fb17.js?v=1"
          );
          el.removeAttribute("integrity");
        }
        if (/mc-fb-checkout-mahjong\.js/i.test(src)) {
          el.setAttribute(
            "src",
            "/v/vspfiles/js/mc-fb-checkout-mahjong-20260801mj3.js?v=1"
          );
          el.removeAttribute("integrity");
        }
      },
      text(text) {
        const t = text.text || "";
        if (/__CF\$cv\$params|challenge-platform\/scripts\/jsd/i.test(t)) {
          text.replace("");
          text.remove();
        }
      },
    });

    return rewriter.transform(res);
  },
};
