# TEST-SOFA product render pipelines

Two layers share the same product geometry, masks, and swatch profiles. They do **not** replace each other.

| Layer | Command | Purpose |
|-------|---------|---------|
| **Preview** (deterministic) | `npm run render:preview-pipeline` | Fast, reusable batch previews for every leather on this sofa |
| **Hero** (optional generative) | `npm run render:hero-pipeline` | Catalog / hero quality via upholstery-only generative edit |

`npm run render:final-pipeline` is an alias for the preview command.

**Targeted cleanup (v2)** — surgical fix on an existing best preview (bottom front seam lines + leg-adjacent warmth only):

```bash
npm run render:preview-cleanup-v2
```

Outputs: `best-preview-master-{SWATCH}-v2.png`, comparison, debug overlays, `cleanup-spec-v2.json`.

---

## What the preview pipeline does well

- Locks **product truth**: source geometry, alpha silhouette, feet/legs, upholstery mask, seam placement, highlight geography, edge cleanup, bottom seam cleanup.
- Applies **swatch-driven base recolor** (correct color family while preserving form).
- Sanitizes swatch photos and derives grain / mottle / color-bias maps (no fold stamping).
- Runs a **deterministic** open-field material pass with QA (diff, heatmap, integrity checks).
- Scales to **new leathers** by adding a row to `swatch-profiles.json` — no pipeline rewrite.

Outputs live under `public/product-assets/TEST-SOFA/final-pipeline/`:

- `best-preview-master-{SWATCH}.png` — best deterministic variant
- `preview-export-{SWATCH}.png` — stable export copy
- `base-recolor-{SWATCH}.png` — color pass without material realism
- `BEST_PREVIEW_STATUS-{SWATCH}.md` — honest quality tier

---

## Why final-photo realism hit a ceiling

On this source, upholstery realism was pushed through many deterministic phases (material transfer, relight, detail stacks). Metrics and review showed:

- Deltas often **trivial or subtle** even at “strong” strengths (same finding as Phase 10).
- Stronger passes tended toward **airbrushed, powdery, or synthetic** looks.
- Swatch transfer either **stamped photo artifacts** or became **too weak to matter**.

The limiting factor is not mask quality or base recolor — it is that **LAB grain/mottle injection cannot re-synthesize photographic cushion modeling and relight** on this render. That requires an **upholstery-only generative** step, not more parameter tuning.

---

## When to use the preview render

- Batch **PLP / swatch picker / internal approval** previews
- Verifying **color family** and mask integrity for a new leather
- Any case where **fast, consistent, reproducible** output is enough
- Default for **all leathers on TEST-SOFA** until a hero is explicitly needed

---

## When to use the hero render path

- **Catalog hero**, marketing landing, or “final photo” tier for a SKU
- When preview looks like a **good recolor** but not a **photographed sofa**
- Top products where generative cost is justified

Hero pipeline:

1. Reuses shared stages (prep → base recolor → clean swatch).
2. Writes input bundle under `final-pipeline/hero/inputs-{SWATCH}/`.
3. Calls **OpenAI image edit** (`gpt-image-1`, fallback `dall-e-2`) for variants A and B.
4. Feather-blends generative output into **upholstery only**, then locks **legs + background** from source.

Outputs under `final-pipeline/hero/`:

- `hero-variant-A-{SWATCH}.png` — safer / softer
- `hero-variant-B-{SWATCH}.png` — stronger leather character
- `hero-grid-{SWATCH}.png` — source | base | A | B
- `hero-spec-{SWATCH}.json` — provider metadata + QA
- `hero-status-{SWATCH}.md`

Configure:

PowerShell (same session as `npm run`):

```powershell
$env:HERO_GENERATIVE_PROVIDER = "openai"
$env:OPENAI_API_KEY = "sk-proj-..."   # real key from platform.openai.com/api-keys
npm run render:hero-pipeline
```

`HERO_GENERATIVE_API_KEY` also works. A **401 Incorrect API key** means the value is invalid, expired, or still a placeholder — not a pipeline bug. The script verifies the key before any image edits.

---

## Shared inputs (both pipelines)

- `src/finalPipeline/swatch-profiles.json` — per-leather target LAB, material strengths, lightness class
- `public/product-assets/TEST-SOFA/source.png` + phase-1 masks
- Swatch images under `sofa-recolor-tool/input/swatches/`

## Code layout

```
src/finalPipeline/
  shared/context.ts      # Stages 1–3 shared by preview + hero
  shared/paths.ts        # Hero + preview export paths
  preview/runPreview.ts  # Deterministic preview (Stages 4–7)
  preview/exportPreview.ts
  hero/runHero.ts        # Optional generative path
  hero/buildHeroInputs.ts
  hero/generativeProvider.ts
  hero/providers/openaiImageEdit.ts
  hero/qa.ts
  hero/variants.ts
  hero/compositeHero.ts
  prep.ts, baseRecolor.ts, swatchClean.ts, …  # Shared stage implementations
```

**Do not** extend old `phase5`–`phase10` realism tuning for TEST-SOFA. Extend profiles and, when ready, the hero provider.
