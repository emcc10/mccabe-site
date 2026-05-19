# Mood board images

Drop your own interior photos here to replace the built-in SVG placeholders.

## File naming

Use the style `id` from `board-styles.js`:

| Style ID      | Suggested file        |
|---------------|-----------------------|
| traditional   | `traditional.jpg`     |
| transitional  | `transitional.jpg`    |
| modern        | `modern.jpg`          |
| coastal       | `coastal.jpg`         |
| mid-century   | `mid-century.jpg`     |
| contemporary  | `contemporary.jpg`    |

Then update each `moodImage` in `board-styles.js`, for example:

```js
moodImage: '/v/vspfiles/boards/mood/coastal.jpg',
```

## Palette tips

Edit the `palette` array (5 hex colors) per style: typically **light neutral → mid tone → accent → deep anchor → warm highlight**. Keep saturation low for an upscale look.
