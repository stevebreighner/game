# KQ3 VGA C Prototype

Native C version using `raylib`.

## Build

```bash
cd /Users/stephenbreighner/Desktop/game/c_game
make
```

## Run

```bash
./kq3_vga
```

## Controls

- `WASD` / arrow keys: move
- `E`: interact
- `Space`: inspect

## Notes

- Renders to a 320x200 internal buffer and upscales 3x.
- Uses local art files when present:
  - `../cottage.png`
  - `../cottage_interior.png`
  - `../forest_path.png`
  - `../main_char.png` (preferred player sheet: 4x3 layout)
  - `../sprites_1.png` (player + hen)
- Falls back to code-drawn VGA placeholders if any file is missing.
