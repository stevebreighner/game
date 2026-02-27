extends Node2D

@onready var background: Sprite2D = $Background
@onready var player: CharacterBody2D = $Player
@onready var player_sprite: Sprite2D = $Player/Sprite2D
@onready var room_label: Label = $HUD/RoomLabel

var current_room := "yard"
var facing := "down"
var step_time := 0.0

const C_SKIN := Color("#e1bf98")
const C_TUNIC := Color("#5f7a4a")
const C_CLOAK := Color("#6b4e2f")
const C_BOOT := Color("#3c2b1b")
const C_HAIR := Color("#8a673e")
const C_SHADOW := Color(0, 0, 0, 0.28)

var bg_textures := {
	"yard": preload("res://assets/cottage.png"),
	"cottage": preload("res://assets/cottage_interior.png"),
	"forest": preload("res://assets/forest_path.png"),
}

var room_data := {
	"yard": {
		"spawn": Vector2(460, 690),
		"solids": [
			Rect2(45, 180, 520, 330),
			Rect2(0, 760, 380, 264),
			Rect2(600, 500, 280, 210),
			Rect2(940, 475, 420, 250),
		],
		"exits": [
			{"rect": Rect2(1120, 88, 290, 110), "target": "forest", "spawn": Vector2(1200, 640)},
			{"rect": Rect2(190, 370, 120, 120), "target": "cottage", "spawn": Vector2(790, 820)},
		],
	},
	"cottage": {
		"spawn": Vector2(790, 820),
		"solids": [
			Rect2(0, 0, 1536, 40),
			Rect2(0, 0, 36, 1024),
			Rect2(1500, 0, 36, 1024),
			Rect2(0, 975, 610, 49),
			Rect2(925, 975, 611, 49),
		],
		"exits": [
			{"rect": Rect2(610, 970, 320, 54), "target": "yard", "spawn": Vector2(250, 410)},
		],
	},
	"forest": {
		"spawn": Vector2(1200, 640),
		"solids": [
			Rect2(0, 0, 1536, 36),
			Rect2(0, 988, 1536, 36),
			Rect2(0, 0, 36, 1024),
			Rect2(1500, 0, 36, 1024),
			Rect2(72, 80, 400, 360),
			Rect2(1080, 80, 400, 380),
		],
		"exits": [
			{"rect": Rect2(1110, 72, 290, 120), "target": "yard", "spawn": Vector2(1240, 170)},
		],
	},
}

func _ready() -> void:
	# Disable texture-based character rendering.
	player_sprite.visible = false
	_set_room("yard", room_data["yard"]["spawn"])
	queue_redraw()

func _physics_process(delta: float) -> void:
	var axis := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var speed := 180.0
	var moved := false

	if axis.length() > 0.0:
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

		var old_pos := player.position
		_try_move(Vector2(axis.x * speed * delta, 0.0))
		_try_move(Vector2(0.0, axis.y * speed * delta))
		moved = player.position != old_pos

	if moved:
		step_time += delta * 10.0

	_check_exits()
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_E:
			pass

func _draw() -> void:
	_draw_sierra_player()

func _set_room(room_name: String, spawn: Vector2) -> void:
	current_room = room_name
	background.texture = bg_textures[current_room]
	background.position = Vector2.ZERO
	player.position = spawn
	room_label.text = "Room: %s" % current_room.capitalize()

func _player_hitbox(at_pos: Vector2) -> Rect2:
	return Rect2(at_pos.x - 16.0, at_pos.y - 52.0, 32.0, 52.0)

func _is_blocked(box: Rect2) -> bool:
	for solid in room_data[current_room]["solids"]:
		if box.intersects(solid):
			return true
	return false

func _try_move(delta_pos: Vector2) -> void:
	if delta_pos == Vector2.ZERO:
		return
	var candidate := player.position + delta_pos
	var box := _player_hitbox(candidate)
	if not _is_blocked(box):
		player.position = candidate

func _check_exits() -> void:
	var box := _player_hitbox(player.position)
	for e in room_data[current_room]["exits"]:
		if box.intersects(e["rect"]):
			_set_room(e["target"], e["spawn"])
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
