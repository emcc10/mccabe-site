# TEST-SOFA sofa render — frozen preview status

**Sofa render project only** (not inspiration boards).

- **Best locked preview version:** 7C-B
- **preview-quality:** yes
- **final-photo-quality:** no
- **Reason:** still too soft / airbrushed for native catalog use
- **Future work:** use a different approach, not more micro-tweaks on the current realism pipeline

## Frozen

- Do not continue Stage 5/6/7 realism tuning on TEST-SOFA unless explicitly requested.
- Do not generate more sofa render variants unless explicitly requested.
- Canonical asset: `bali-silk-preview.png` (same pixels as locked 7C-B; render not re-run on freeze).

## Bundle

| File | Role |
|------|------|
| `bali-silk-preview.png` | Locked preview image |
| `params.json` | Locked pipeline parameters |
| `STATUS.md` | This note |

Re-copy bundle from existing 7C-B export: `npm run export:preview-locked`
