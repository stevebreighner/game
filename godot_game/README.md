# Godot Migration (WIP)

## Open

1. Launch Godot 4.6.1
2. Import project at:
   `/Users/stephenbreighner/Desktop/game/godot_game`
3. Run `scenes/Main.tscn`

## Current

- 3 rooms wired:
  - yard (`assets/cottage.png`)
  - cottage (`assets/cottage_interior.png`)
  - forest (`assets/forest_path.png`)
- Player sheet wired: `assets/main_char.png`
- Movement + collisions + room transitions in `scripts/game.gd`

## Controls

- Arrow keys / WASD move
- `E` reserved for interact hook

## Notes

- This is a clean restart scaffold for stability.
- Next pass: polish collisions and interaction hotspots room-by-room.
