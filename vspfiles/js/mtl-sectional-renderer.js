(function () {
  console.log("mtl-sectional-renderer loaded 20260509e");

  function getConfigsObject() {
    return window.MTL_SECTIONAL_CONFIGS || {};
  }

  function getPageText() {
    var h1 = document.querySelector("h1");
    return [
      location.pathname,
      document.title,
      h1 ? h1.textContent : "",
      document.body ? document.body.innerText.slice(0, 3000) : ""
    ].join(" ").toLowerCase();
  }

  function getProductKey(configs) {
    var pageText = getPageText();

    return Object.keys(configs).find(function (key) {
      return pageText.indexOf(key.toLowerCase()) !== -1;
    });
  }

  function findInsertTarget() {
    return (
      document.querySelector("#options_table") ||
      document.querySelector("#v65-product-parent") ||
      document.querySelector("#content_area") ||
      document.querySelector("form[action*='ShoppingCart']") ||
      document.body
    );
  }

  function normalizeImage(src) {
    if (!src) return "";
    if (src.indexOf("http") === 0) return src;
    if (src.indexOf("/") === 0) return src;
    return "/v/vspfiles/sectional-diagrams/" + src;
  }

  function renderSectionalConfigs() {
    try {
      console.log("renderSectionalConfigs starting");

      if (document.querySelector("#mtl-sectional-configurations")) {
        console.log("sectional configs already exist");
        return;
      }

      var configs = getConfigsObject();

      console.log("sectional configs found", configs);
      console.log("sectional config keys", Object.keys(configs));

      if (!configs || typeof configs !== "object" || !Object.keys(configs).length) {
        console.warn("No MTL_SECTIONAL_CONFIGS object found");
        return;
      }

      var productKey = getProductKey(configs);
      var matchedConfigs = productKey ? configs[productKey] : [];

      console.log("sectional productKey", productKey);
      console.log("sectional matchedConfigs", matchedConfigs);

      if (!Array.isArray(matchedConfigs) || !matchedConfigs.length) {
        console.warn("No matched sectional configs", {
          path: location.pathname,
          title: document.title,
          keys: Object.keys(configs)
        });
        return;
      }

      var section = document.createElement("section");
      section.id = "mtl-sectional-configurations";
      section.className = "mtl-sectional-configurations";

      var html = "";
      html += '<div class="mtl-sectional-inner">';
      html += '<h3 class="mtl-sectional-heading">Popular Configurations</h3>';
      html += '<div class="mtl-sectional-grid">';

      matchedConfigs.forEach(function (cfg) {
        var img = normalizeImage(cfg.image);

        html += '<div class="mtl-sectional-card">';
        html += '<div class="mtl-sectional-image-wrap">';
        html += '<img class="mtl-sectional-image" src="' + img + '?v=20260509e" alt="' + (cfg.label || cfg.code || "Sectional configuration") + '">';
        html += '</div>';
        html += '<div class="mtl-sectional-info">';
        html += '<div class="mtl-sectional-title">' + (cfg.label || cfg.code || "") + '</div>';
        html += '<div class="mtl-sectional-desc">' + (cfg.description || "") + '</div>';

        if (cfg.priceDiff) {
          html += '<div class="mtl-sectional-price">Upgrade +' + cfg.priceDiff + '</div>';
        }

        html += '</div>';
        html += '</div>';
      });

      html += '</div>';
      html += '</div>';

      section.innerHTML = html;

      var target = findInsertTarget();

      console.log("sectional insert target", target);

      if (!target) {
        console.error("No insertion target found");
        return;
      }

      target.insertAdjacentElement("afterend", section);

      console.log("sectional configurations inserted", matchedConfigs.length);
    } catch (err) {
      console.error("Sectional renderer failed:", err);
    }
  }

  function scheduleRender() {
    renderSectionalConfigs();

    setTimeout(renderSectionalConfigs, 500);
    setTimeout(renderSectionalConfigs, 1500);
    setTimeout(renderSectionalConfigs, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRender);
  } else {
    scheduleRender();
  }

  window.addEventListener("load", scheduleRender);
})();
