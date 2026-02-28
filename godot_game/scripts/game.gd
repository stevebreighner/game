extends Node2D

@onready var background: Sprite2D = $Background
@onready var player: CharacterBody2D = $Player
@onready var player_sprite: Sprite2D = $Player/Sprite2D
@onready var room_label: Label = $HUD/RoomLabel

var current_room: String = "yard"
var facing: String = "down"
var step_time: float = 0.0
var anim_time: float = 0.0
var is_moving: bool = false
var char_tex: Texture2D = null
var use_char_sheet: bool = false

const DOWN_FRAMES: Array[Rect2] = [
	Rect2(281, 48, 132, 268),
	Rect2(565, 48, 134, 268),
]
const UP_FRAMES: Array[Rect2] = [
	Rect2(838, 48, 137, 269),
	Rect2(1104, 48, 137, 269),
]
const RIGHT_FRAMES: Array[Rect2] = [
	Rect2(284, 352, 137, 261),
	Rect2(566, 352, 137, 261),
	Rect2(847, 353, 134, 260),
	Rect2(1114, 351, 132, 262),
]
const LEFT_FRAMES: Array[Rect2] = [
	Rect2(289, 655, 141, 257),
	Rect2(575, 653, 139, 259),
	Rect2(851, 652, 141, 259),
	Rect2(1108, 653, 139, 258),
]
const DOWN_WALK_SEQ: Array[int] = [0, 1, 0, 1]
const UP_WALK_SEQ: Array[int] = [0, 1, 0, 1]
const RIGHT_WALK_SEQ: Array[int] = [0, 3, 0, 3]
const LEFT_WALK_SEQ: Array[int] = [0, 3, 0, 3]

const WALK_FPS: float = 8.0
const WALK_BOB_AMPLITUDE: float = 1.0
const IDLE_BOB_AMPLITUDE: float = 0.8
const IDLE_BOB_SPEED: float = 2.0
const VERTICAL_SWAY_AMPLITUDE: float = 1.6

const C_SKIN: Color = Color("#e1bf98")
const C_TUNIC: Color = Color("#5f7a4a")
const C_CLOAK: Color = Color("#6b4e2f")
const C_BOOT: Color = Color("#3c2b1b")
const C_HAIR: Color = Color("#8a673e")
const C_SHADOW: Color = Color(0, 0, 0, 0.28)

var bg_paths: Dictionary = {
	"yard": "res://assets/cottage.png",
	"cottage": "res://assets/cottage_interior.png",
	"forest": "res://assets/forest_path.png",
}
var bg_cache: Dictionary = {}

var room_data: Dictionary = {
	"yard": {
		"spawn": Vector2(720, 760),
		"solids": [
			# House + woodpile + hay
			Rect2(0, 120, 690, 430),
			# Bottom-left water + dock + shore rocks
			Rect2(0, 640, 470, 384),
			# Well in the center
			Rect2(462, 416, 352, 292),
			# Garden plot / fenced crops
			Rect2(834, 414, 504, 296),
			# Table and stool
			Rect2(890, 540, 272, 176),
			# Cart by upper-right path
			Rect2(1080, 280, 332, 218),
			# Stump + logs at lower-right
			Rect2(1124, 662, 412, 230),
			# Keep player out of dense tree canopy band at the top
			Rect2(0, 0, 1536, 74),
		],
		"exits": [
			# Stone gate opening at top-right.
			{"rect": Rect2(1048, 96, 312, 166), "target": "forest", "spawn": Vector2(1110, 290)},
			# Cottage door.
			{"rect": Rect2(228, 310, 124, 162), "target": "cottage", "spawn": Vector2(780, 600)},
		],
	},
	"cottage": {
		"spawn": Vector2(780, 600),
		"solids": [
			# Keep movement on the visible floor area.
			Rect2(0, 0, 1536, 190),
			Rect2(0, 0, 120, 1024),
			Rect2(1420, 0, 116, 1024),
			Rect2(0, 880, 1536, 144),
			# Fireplace / chimney block
			Rect2(60, 180, 470, 434),
			# Back workbench wall furniture
			Rect2(440, 204, 448, 266),
			# Bed area right
			Rect2(876, 338, 520, 374),
			# Center table and chairs
			Rect2(372, 570, 374, 294),
			# Front-right desk
			Rect2(956, 572, 512, 294),
		],
		"exits": [
			# Front door on back wall.
			{"rect": Rect2(708, 210, 188, 168), "target": "yard", "spawn": Vector2(286, 448)},
		],
	},
	"forest": {
		"spawn": Vector2(1110, 290),
		"solids": [
			# Dense canopy/brush and rock walls
			Rect2(0, 0, 1536, 110),
			Rect2(0, 0, 200, 1024),
			Rect2(1366, 0, 170, 1024),
			Rect2(0, 905, 1536, 119),
			Rect2(0, 120, 330, 630),
			Rect2(1180, 120, 356, 700),
			# Stream and rocky bank on right side of path
			Rect2(860, 414, 676, 370),
			# Large stumps
			Rect2(0, 442, 222, 234),
			Rect2(1178, 408, 240, 238),
		],
		"exits": [
			{"rect": Rect2(1016, 90, 290, 150), "target": "yard", "spawn": Vector2(1170, 260)},
		],
	},
}

func _ready() -> void:
	var char_path: String = "res://assets/main_char.png"
	use_char_sheet = FileAccess.file_exists(char_path)
	if use_char_sheet:
		char_tex = _load_char_texture(char_path)
	player_sprite.visible = use_char_sheet
	if use_char_sheet:
		player_sprite.texture = char_tex
		player_sprite.centered = true
		player_sprite.position = Vector2.ZERO
		player_sprite.region_enabled = true
		player_sprite.z_as_relative = false
		player_sprite.z_index = 20
		player_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		player_sprite.modulate = Color(1.0, 1.0, 1.0, 1.0)

	# Ensure background never overdraws the code-rendered player.
	background.z_as_relative = false
	background.z_index = -20
	var yard: Dictionary = room_data["yard"] as Dictionary
	_set_room("yard", yard["spawn"] as Vector2)
	queue_redraw()

func _physics_process(delta: float) -> void:
	anim_time += delta

	var axis: Vector2 = Vector2.ZERO
	if Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A):
		axis.x -= 1.0
	if Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D):
		axis.x += 1.0
	if Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W):
		axis.y -= 1.0
	if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S):
		axis.y += 1.0

	var speed: float = 180.0
	var has_input: bool = axis.length() > 0.0
	var moved: bool = false

	if has_input:
		axis = axis.normalized()
		if abs(axis.x) > abs(axis.y):
			if axis.x < 0.0:
				facing = "left"
			else:
				facing = "right"
		else:
			if axis.y < 0.0:
				facing = "up"
			else:
				facing = "down"

		var old_pos: Vector2 = player.position
		_try_move(Vector2(axis.x * speed * delta, 0.0))
		_try_move(Vector2(0.0, axis.y * speed * delta))
		moved = player.position != old_pos

	if has_input:
		step_time += delta * WALK_FPS
	else:
		step_time = 0.0
	is_moving = has_input

	_check_exits()
	_update_player_visual()
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_E:
			pass

func _draw() -> void:
	if not use_char_sheet:
		_draw_sierra_player()

func _set_room(room_name: String, spawn: Vector2) -> void:
	current_room = room_name
	background.texture = _get_bg_texture(current_room)
	background.position = Vector2.ZERO
	player.position = spawn
	room_label.text = "Room: %s" % current_room.capitalize()
	_update_player_visual()

func _get_bg_texture(room_name: String) -> Texture2D:
	if bg_cache.has(room_name):
		return bg_cache[room_name] as Texture2D

	var path: String = bg_paths[room_name] as String
	var img: Image = Image.new()
	var err: int = img.load(path)
	if err != OK:
		push_error("Failed to load background image: %s (err %d)" % [path, err])
		var fallback: Image = Image.create(1536, 1024, false, Image.FORMAT_RGBA8)
		fallback.fill(Color(0.12, 0.16, 0.20, 1.0))
		var fallback_tex: Texture2D = ImageTexture.create_from_image(fallback)
		bg_cache[room_name] = fallback_tex
		return fallback_tex

	var tex: Texture2D = ImageTexture.create_from_image(img)
	bg_cache[room_name] = tex
	return tex

func _load_char_texture(path: String) -> Texture2D:
	var img: Image = Image.new()
	var err: int = img.load(path)
	if err != OK:
		push_error("Could not load character sheet: %s (err %d)" % [path, err])
		var fallback: Image = Image.create(64, 64, false, Image.FORMAT_RGBA8)
		fallback.fill(Color(1.0, 0.0, 1.0, 1.0))
		return ImageTexture.create_from_image(fallback)
	img.convert(Image.FORMAT_RGBA8)
	return ImageTexture.create_from_image(img)

func _update_player_visual() -> void:
	if not use_char_sheet:
		return

	var frames: Array[Rect2] = DOWN_FRAMES
	var seq: Array[int] = DOWN_WALK_SEQ
	match facing:
		"up":
			frames = UP_FRAMES
			seq = UP_WALK_SEQ
		"right":
			frames = RIGHT_FRAMES
			seq = RIGHT_WALK_SEQ
		"left":
			frames = LEFT_FRAMES
			seq = LEFT_WALK_SEQ

	var frame_index: int = 0
	if is_moving and seq.size() > 1:
		var seq_index: int = int(floor(step_time)) % seq.size()
		frame_index = seq[seq_index]
		if frame_index >= frames.size():
			frame_index = 0
	var src: Rect2 = frames[frame_index]
	player_sprite.region_rect = src

	# Keep character readable without oversized sprites.
	var y_ratio: float = clampf(player.position.y / 1024.0, 0.0, 1.0)
	var s: float = lerpf(0.34, 0.48, y_ratio)
	player_sprite.scale = Vector2(s, s)

	# Subtle bounce keeps motion alive in classic adventure style.
	var bob: float = 0.0
	var sway_x: float = 0.0
	if is_moving:
		bob = sin(step_time * PI) * WALK_BOB_AMPLITUDE
		if facing == "up" or facing == "down":
			sway_x = sin(step_time * PI * 2.0) * VERTICAL_SWAY_AMPLITUDE
	else:
		bob = sin(anim_time * IDLE_BOB_SPEED) * IDLE_BOB_AMPLITUDE
	player_sprite.position = Vector2(sway_x, bob)

func _player_hitbox(at_pos: Vector2) -> Rect2:
	# Sierra-style: use a small footprint around the feet for walkability.
	# This avoids the upper body colliding with scenery that should visually overlap.
	return Rect2(at_pos.x - 8.0, at_pos.y - 12.0, 16.0, 12.0)

func _is_blocked(box: Rect2) -> bool:
	var room_entry: Dictionary = room_data[current_room] as Dictionary
	var solids: Array = room_entry["solids"] as Array
	for solid_variant in solids:
		var solid: Rect2 = solid_variant as Rect2
		if box.intersects(solid):
			return true
	return false

func _try_move(delta_pos: Vector2) -> void:
	if delta_pos == Vector2.ZERO:
		return
	var candidate: Vector2 = player.position + delta_pos
	var box: Rect2 = _player_hitbox(candidate)
	if not _is_blocked(box):
		player.position = candidate

func _check_exits() -> void:
	var box: Rect2 = _player_hitbox(player.position)
	var room_entry: Dictionary = room_data[current_room] as Dictionary
	var exits: Array = room_entry["exits"] as Array
	for exit_variant in exits:
		var e: Dictionary = exit_variant as Dictionary
		var exit_rect: Rect2 = e["rect"] as Rect2
		if box.intersects(exit_rect):
			_set_room(e["target"] as String, e["spawn"] as Vector2)
			return

func _draw_sierra_player() -> void:
	var y_ratio: float = clampf(player.position.y / 1024.0, 0.0, 1.0)
	var s: float = lerpf(0.80, 1.10, y_ratio)

	var body_w: float = 22.0 * s
	var body_h: float = 34.0 * s
	var feet_x: float = player.position.x
	var feet_y: float = player.position.y
	var x: float = feet_x - body_w * 0.5
	var y: float = feet_y - body_h

	# Contact shadow
	draw_rect(Rect2(x + 4.0 * s, feet_y - 3.0 * s, body_w - 8.0 * s, 4.0 * s), C_SHADOW)

	# Head + hair
	draw_rect(Rect2(x + 5.0 * s, y + 1.0 * s, body_w - 10.0 * s, 8.0 * s), C_SKIN)
	draw_rect(Rect2(x + 4.0 * s, y + 0.0, body_w - 8.0 * s, 3.0 * s), C_HAIR)

	# Torso
	draw_rect(Rect2(x + 3.0 * s, y + 9.0 * s, body_w - 6.0 * s, body_h - 14.0 * s), C_TUNIC)
	draw_rect(Rect2(x + 3.0 * s, y + 9.0 * s, body_w - 6.0 * s, 6.0 * s), C_CLOAK)

	var walk: int = int(step_time) % 2
	var leg_offset: float = float(walk) * s

	# Legs/boots
	draw_rect(Rect2(x + 3.0 * s + leg_offset, y + body_h - 6.0 * s, 6.0 * s, 6.0 * s), C_BOOT)
	draw_rect(Rect2(x + body_w - 9.0 * s - leg_offset, y + body_h - 6.0 * s, 6.0 * s, 6.0 * s), C_BOOT)

	# Direction accents
	match facing:
		"left":
			draw_rect(Rect2(x - 1.0 * s, y + 14.0 * s, 4.0 * s, 6.0 * s), C_CLOAK)
		"right":
			draw_rect(Rect2(x + body_w - 3.0 * s, y + 14.0 * s, 4.0 * s, 6.0 * s), C_CLOAK)
		"up":
			draw_rect(Rect2(x + 6.0 * s, y + 1.0 * s, body_w - 12.0 * s, 2.0 * s), C_CLOAK)
		"down":
			draw_rect(Rect2(x + 6.0 * s, y + body_h - 2.0 * s, body_w - 12.0 * s, 2.0 * s), C_CLOAK)
