# Kingdom Quest Prototype (VGA Code-Drawn)

This version has been reset to a pure code-rendered style inspired by King's Quest III-era VGA visuals.

- No runtime sprite/background images are required for gameplay visuals
- Rooms, props, and character are drawn directly in `canvas` using a fixed retro palette
- Classic adventure loop remains: explore, interact, inventory, puzzle chain
- Time pressure remains: wizard leaves `09:00` and returns `15:00`

## Run

1. Open `index.html` in a browser.
2. Move with `WASD` / arrows.
3. `E` interact, `I` inventory, `Space` inspect.

## Files

- `index.html`: shell + HUD
- `style.css`: layout + UI
- `game.js`: full game loop and VGA-style renderer

## Current world

- 8 rooms:
  - Cottage Yard
  - Inside Cottage
  - Forest Path
  - Black Cove
  - Cliff Pass
  - Old Ruins
  - Manor Road
  - Tower Chamber

## Quest flow

1. Find note in cottage.
2. Get brass key at cove tide stone.
3. Unlock manor gate.
4. Find Moon Herb and Silver Sigil.
5. Enter tower in safe window and take spellbook.

## Notes

- Existing image files in the folder are now optional reference assets only.
- If you want stricter pixel-art rendering, the next step is adding a low-resolution offscreen buffer and scaling it up.
