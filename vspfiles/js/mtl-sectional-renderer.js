(function () {
  console.log("mtl-sectional-renderer SAFE loaded 20260509fix1");

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function getProductKey(configs) {
    var text = [
      location.pathname,
      document.title,
      document.querySelector("h1") ? document.querySelector("h1").textContent : "",
    ]
      .join(" ")
      .toLowerCase();

    return Object.keys(configs || {}).find(function (key) {
      return text.indexOf(key.toLowerCase()) !== -1;
    });
  }

  function findInsertTarget() {
    return (
      document.querySelector("#options_table") ||
      document.querySelector("#v65-product-parent") ||
      document.querySelector("#content_area") ||
      document.body
    );
  }

  function renderSectionalConfigs() {
    try {
      if (document.querySelector("#mtl-sectional-configurations")) {
        return;
      }

      var configs = window.MTL_SECTIONAL_CONFIGS || {};
      console.log("sectional configs:", configs);
      console.log("sectional config keys:", Object.keys(configs));

      var productKey = getProductKey(configs);
      console.log("sectional productKey:", productKey);

      var matchedConfigs = productKey ? configs[productKey] : [];
      console.log("sectional matchedConfigs:", matchedConfigs);

      if (!Array.isArray(matchedConfigs) || !matchedConfigs.length) {
        console.warn("No matched sectional configs.");
        return;
      }

      var section = document.createElement("section");
      section.id = "mtl-sectional-configurations";
      section.className = "mtl-sectional-configurations";

      var html = "";
      html += '<h3 class="mtl-sectional-heading">Popular Configurations</h3>';
      html += '<div class="mtl-sectional-grid">';

      matchedConfigs.forEach(function (cfg) {
        html += '<div class="mtl-sectional-card" data-config-code="' + (cfg.code || "") + '">';
        html +=
          '<img class="mtl-sectional-image" src="' +
          cfg.image +
          '?v=20260509fix1" alt="' +
          (cfg.label || cfg.code || "Configuration") +
          '">';
        html += '<div class="mtl-sectional-title">' + (cfg.label || cfg.code || "") + "</div>";
        html += '<div class="mtl-sectional-desc">' + (cfg.description || "") + "</div>";
        html += "</div>";
      });

      html += "</div>";
      section.innerHTML = html;

      var target = findInsertTarget();
      console.log("sectional insert target:", target);

      if (!target) {
        console.error("No sectional insert target found.");
        return;
      }

      target.insertAdjacentElement("afterend", section);

      console.log("sectional diagrams inserted:", matchedConfigs.length);
    } catch (err) {
      console.error("Sectional renderer failed:", err);
    }
  }

  ready(function () {
    renderSectionalConfigs();
    setTimeout(renderSectionalConfigs, 500);
    setTimeout(renderSectionalConfigs, 1500);
  });
})();
