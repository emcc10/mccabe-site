# Best preview status — BALI-SILK

Generated: 2026-05-27T16:04:39.215Z

## Selected best variant
- **C** (FINAL-C) — score 17.3

## Why
- Highest-scoring variant that passed integrity checks (feet, background, bottom seam). Realism delta vs base recolor is still subtle/trivial by metric — see QA.
- Mean |ΔL| vs base recolor: **0.50**
- QA verdict: **FAIL — SUBTLE — visible only in diff/heatmap, unlikely to read in normal review**

## Quality tier
- **Preview-quality:** yes
- **Near-catalog-quality:** no
- **Final-photo-quality:** no

## What remains imperfect
- Deterministic clean-swatch apply cannot reach generated-reference photo realism on this source.
- Swatch material pass mean |ΔL| vs base recolor: **0.50** (Phase 10 on same method also scored trivial vs prior baseline).
- Grain/mottle read as subtle upholstery texture, not full photographic relight.
- Arm curvature / cushion modeling vs reference still limited without generative upholstery pass.


## vs old deterministic pipeline (Phases 5–10 / Relight)
- **Materially different architecture:** product-level stages with swatch profiles, sanitized swatch maps, region weights.
- **Outperforms old stack on:** reuse, clarity, QA honesty, no phase churn.
- **Does not yet outperform** old stack on final-photo realism (same fundamental ceiling without generative step).

## Reusability
- **Reusable for other leathers on TEST-SOFA:** yes — add profile row + run `npm run render:final-pipeline -- <CODE>`

## Recommended future work
- **Add new swatch profiles** for each leather color (targetLab + strength tuning).
- **Use same pipeline** for batch previews.
- **Manual / generative hero-render** for top catalog SKUs where final-photo quality is required.

## Variants
- **A:** mean |ΔL|=0.09, meaningful=false, failures=TRIVIAL — swatch transfer delta is negligible at upholstery scale
- **B:** mean |ΔL|=0.27, meaningful=false, failures=TRIVIAL — swatch transfer delta is negligible at upholstery scale
- **C:** mean |ΔL|=0.50, meaningful=false, failures=SUBTLE — visible only in diff/heatmap, unlikely to read in normal review

## Prep validation
- Masks OK: **yes**

## Outputs
- Master: `best-preview-master-BALI-SILK.png`
- Metrics: `qa-metrics-BALI-SILK.json`

> **Realism variants did not pass meaningful-change threshold — best master is base+subtle material only, not production hero quality.**

