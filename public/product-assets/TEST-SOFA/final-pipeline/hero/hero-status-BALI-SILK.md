# Hero render status — BALI-SILK

Generated: 2026-05-27T16:49:03.715Z

## Pipeline
- **Provider:** bundle-only
- **Generative ran:** no
- **Message:** Generative step skipped — configure HERO_GENERATIVE_PROVIDER=openai and OPENAI_API_KEY.

## Best variant
- **None** — generative step did not complete or all variants failed QA

## Variants

## Outputs
- `hero-variant-A-BALI-SILK.png`
- `hero-variant-B-BALI-SILK.png`
- `hero-grid-BALI-SILK.png`
- `hero-spec-BALI-SILK.json`

## Configuration
- **No API key** — set `HERO_GENERATIVE_PROVIDER=openai` and `OPENAI_API_KEY` to run generative edits.

## Post-processing
- Generative output is feather-blended into upholstery only, then legs/background are locked from source via `compositePhase2`.
