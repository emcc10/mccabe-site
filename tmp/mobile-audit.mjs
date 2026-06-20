/**
 * Mobile responsiveness audit for mccabestheaterandliving.com
 */
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'mobile-audit');
mkdirSync(OUT, { recursive: true });

const BASE = 'https://www.mccabestheaterandliving.com';
const PAGES = [
  { name: 'home', url: `${BASE}/` },
  { name: 'plp-sofas', url: `${BASE}/category-s/177.htm` },
  { name: 'plp-beanbags', url: `${BASE}/bean-bag-seating-s/103.htm` },
  { name: 'pdp-beanbag', url: `${BASE}/product-p/bb-nest.htm` },
  { name: 'pdp-sectional', url: `${BASE}/product-p/77656.htm` },
  { name: 'search', url: `${BASE}/searchresults.asp?Search=sofa` },
];

const VIEWPORTS = [
  { label: '320', width: 320, height: 568 },
  { label: '375', width: 375, height: 812 },
  { label: '390', width: 390, height: 844 },
  { label: '768', width: 768, height: 1024 },
];

const issues = [];

function addIssue(page, viewport, severity, category, detail) {
  issues.push({ page, viewport, severity, category, detail });
}

async function auditPage(browser, pageDef) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: devices['iPhone 13'].userAgent,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.goto(pageDef.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);

      const metrics = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const overflow = docW > winW + 2;

        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const hasViewport = !!viewportMeta;

        const hiddenLinks = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href') || '';
          if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
          const r = a.getBoundingClientRect();
          const style = getComputedStyle(a);
          if (r.width === 0 || r.height === 0) return;
          if (style.visibility === 'hidden' || style.display === 'none') return;
          if (parseFloat(style.opacity) === 0) return;
          if (style.pointerEvents === 'none') {
            hiddenLinks.push({ href: href.slice(0, 80), text: (a.textContent || '').trim().slice(0, 40) });
          }
        });

        const clippedImages = [];
        document.querySelectorAll('img').forEach((img) => {
          if (!img.src || img.offsetParent === null) return;
          const r = img.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) return;
          const style = getComputedStyle(img);
          const parent = img.parentElement;
          if (!parent) return;
          const pr = parent.getBoundingClientRect();
          const pStyle = getComputedStyle(parent);
          if (pStyle.overflow === 'hidden' || pStyle.overflowX === 'hidden') {
            const cropW = r.width > pr.width + 4;
            const cropH = r.height > pr.height + 4;
            const offScreen = r.right > window.innerWidth + 8 || r.left < -8;
            if (cropW || cropH || offScreen) {
              clippedImages.push({
                src: (img.src || '').split('/').slice(-1)[0].slice(0, 50),
                id: img.id || '',
                w: Math.round(r.width),
                h: Math.round(r.height),
                offScreen,
                cropW,
                cropH,
              });
            }
          }
        });

        const smallTapTargets = [];
        document.querySelectorAll('a, button, input[type="submit"], select, [role="button"]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;
          if (r.top > window.innerHeight * 3) return; // skip far below fold
          if (r.width < 32 || r.height < 32) {
            smallTapTargets.push({
              tag: el.tagName,
              text: (el.textContent || el.value || el.name || '').trim().slice(0, 30),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }
        });

        const productPhoto = document.querySelector('img#product_photo');
        let productPhotoInfo = null;
        if (productPhoto) {
          const r = productPhoto.getBoundingClientRect();
          productPhotoInfo = {
            w: Math.round(r.width),
            h: Math.round(r.height),
            offRight: r.right > window.innerWidth + 4,
            marginLeft: getComputedStyle(productPhoto).marginLeft,
          };
        }

        const priceEls = [];
        document.querySelectorAll('.product_sale_price, .product_list_price, [itemprop="price"], .option_pricing, #priceWithOptions').forEach((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;
          if (r.width === 0) return;
          priceEls.push({
            cls: el.className?.toString().slice(0, 40) || el.id,
            text: (el.textContent || '').trim().slice(0, 40),
            visible: r.top < window.innerHeight * 4,
            offScreen: r.right > window.innerWidth + 4,
          });
        });

        const optionsTable = document.querySelector('#options_table');
        let optionsInfo = null;
        if (optionsTable) {
          const r = optionsTable.getBoundingClientRect();
          optionsInfo = {
            w: Math.round(r.width),
            offScreen: r.right > window.innerWidth + 4,
            display: getComputedStyle(optionsTable).display,
          };
        }

        const selects = [];
        document.querySelectorAll('#options_table select, select.product_option').forEach((sel) => {
          const r = sel.getBoundingClientRect();
          if (r.width === 0) return;
          selects.push({
            name: sel.name || sel.id,
            w: Math.round(r.width),
            offScreen: r.right > window.innerWidth + 4,
          });
        });

        const plpTiles = document.querySelectorAll('.v-product-grid .v-product, .v-product-grid > li');
        const plpInfo = [];
        plpTiles.forEach((tile, i) => {
          if (i > 5) return;
          const img = tile.querySelector('img');
          const title = tile.querySelector('.v-product__title, .v-product__name, a.v-product__title');
          const price = tile.querySelector('.product_sale_price, .product_list_price, .mc-member-grid-price');
          const ir = img?.getBoundingClientRect();
          const tr = title?.getBoundingClientRect();
          const pr = price?.getBoundingClientRect();
          plpInfo.push({
            hasImg: !!img,
            imgW: ir ? Math.round(ir.width) : 0,
            imgH: ir ? Math.round(ir.height) : 0,
            hasTitle: !!title && tr && tr.height > 0,
            hasPrice: !!price && pr && pr.height > 0 && getComputedStyle(price).display !== 'none',
          });
        });

        return {
          overflow,
          docW,
          winW,
          hasViewport,
          hiddenLinks: hiddenLinks.slice(0, 15),
          clippedImages: clippedImages.slice(0, 12),
          smallTapTargets: smallTapTargets.slice(0, 15),
          productPhotoInfo,
          priceEls: priceEls.slice(0, 8),
          optionsInfo,
          selects: selects.slice(0, 8),
          plpInfo,
          plpCount: plpTiles.length,
        };
      });

      const shotName = `${pageDef.name}-${vp.label}.png`;
      await page.screenshot({ path: join(OUT, shotName), fullPage: false });

      if (!metrics.hasViewport) {
        addIssue(pageDef.name, vp.label, 'critical', 'meta', 'Missing viewport meta tag');
      }
      if (metrics.overflow) {
        addIssue(pageDef.name, vp.label, 'high', 'overflow', `Horizontal scroll: doc ${metrics.docW}px vs viewport ${metrics.winW}px`);
      }
      if (metrics.productPhotoInfo?.offRight) {
        addIssue(pageDef.name, vp.label, 'high', 'pdp-image', `Main product image off-screen (margin-left: ${metrics.productPhotoInfo.marginLeft}, width ${metrics.productPhotoInfo.w}px)`);
      }
      if (metrics.optionsInfo?.offScreen) {
        addIssue(pageDef.name, vp.label, 'high', 'pdp-options', `Options table wider than viewport (${metrics.optionsInfo.w}px)`);
      }
      for (const sel of metrics.selects.filter((s) => s.offScreen)) {
        addIssue(pageDef.name, vp.label, 'medium', 'pdp-options', `Option select "${sel.name}" off-screen (${sel.w}px wide)`);
      }
      if (metrics.hiddenLinks.length) {
        addIssue(pageDef.name, vp.label, 'medium', 'links', `${metrics.hiddenLinks.length} visible links with pointer-events:none (sample: ${metrics.hiddenLinks[0]?.text || metrics.hiddenLinks[0]?.href})`);
      }
      if (metrics.clippedImages.length >= 3) {
        addIssue(pageDef.name, vp.label, 'medium', 'images', `${metrics.clippedImages.length}+ images clipped or off-screen`);
      }
      if (pageDef.name.startsWith('plp') && metrics.plpCount > 0) {
        const bad = metrics.plpInfo.filter((t) => !t.hasImg || t.imgH < 40 || !t.hasTitle);
        if (bad.length) {
          addIssue(pageDef.name, vp.label, 'medium', 'plp', `${bad.length}/${metrics.plpInfo.length} sampled tiles missing image/title`);
        }
      }
      if (pageDef.name.startsWith('pdp') && metrics.priceEls.length === 0) {
        addIssue(pageDef.name, vp.label, 'high', 'pdp-price', 'No visible price elements detected');
      }
      for (const p of metrics.priceEls.filter((p) => p.offScreen)) {
        addIssue(pageDef.name, vp.label, 'medium', 'pdp-price', `Price off-screen: "${p.text}"`);
      }

      console.log(`${pageDef.name} @ ${vp.label}: overflow=${metrics.overflow} plp=${metrics.plpCount} prices=${metrics.priceEls.length}`);
    } catch (e) {
      addIssue(pageDef.name, vp.label, 'critical', 'load', `Page failed to load: ${e.message}`);
      console.error(`${pageDef.name} @ ${vp.label}: ERROR`, e.message);
    } finally {
      await context.close();
    }
  }
}

const browser = await chromium.launch({ headless: true });
for (const p of PAGES) {
  await auditPage(browser, p);
}
await browser.close();

const report = {
  generated: new Date().toISOString(),
  site: BASE,
  pages: PAGES.map((p) => p.url),
  viewports: VIEWPORTS,
  issueCount: issues.length,
  issues,
};

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

// Markdown summary
const byCategory = {};
for (const i of issues) {
  byCategory[i.category] = byCategory[i.category] || [];
  byCategory[i.category].push(i);
}

let md = `# Mobile Audit Preview — McCabe's Theater & Living\n\n`;
md += `Generated: ${report.generated}\n\n`;
md += `**${issues.length} issues** across ${PAGES.length} pages × ${VIEWPORTS.length} viewports.\n\n`;
md += `Screenshots saved to \`tmp/mobile-audit/\`\n\n`;

const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
issues.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

md += `## Issue summary by category\n\n`;
for (const [cat, list] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
  md += `- **${cat}**: ${list.length}\n`;
}

md += `\n## All findings\n\n| Severity | Page | Viewport | Category | Detail |\n|---|---|---|---|---|\n`;
for (const i of issues) {
  md += `| ${i.severity} | ${i.page} | ${i.viewport}px | ${i.category} | ${i.detail.replace(/\|/g, '\\|')} |\n`;
}

writeFileSync(join(OUT, 'MOBILE-AUDIT-PREVIEW.md'), md);
console.log('\nDone. Issues:', issues.length);
console.log('Report:', join(OUT, 'MOBILE-AUDIT-PREVIEW.md'));
