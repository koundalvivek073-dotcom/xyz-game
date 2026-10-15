class_name HUD
extends CanvasLayer

@export var health_bar: ProgressBar
@export var ammo_label: Label
@export var compass_label: Label
@export var killfeed_container: VBoxContainer
@export var minimap_texture_rect: TextureRect

var player: PlayerController

func setup_player_bindings(p: PlayerController) -> void:
	player = p
	player.health_changed.connect(_on_health_changed)

func _process(_delta: float) -> void:
	if player and not player.is_dead:
		update_compass()

func _on_health_changed(hp: float, max_hp: float) -> void:
	if health_bar:
		health_bar.max_value = max_hp
		health_bar.value = hp

func update_ammo(current: int, reserve: int) -> void:
	if ammo_label:
		ammo_label.text = "%d / %d" % [current, reserve]

func update_compass() -> void:
	if not compass_label or not player:
		return
	var deg := int(rad_to_deg(-player.camera_yaw)) % 360
	if deg < 0:
		deg += 360
	var dirs := ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
	var idx := int(round(float(deg) / 45.0)) % 8
	compass_label.text = "%s  %d°" % [dirs[idx], deg]

func add_killfeed_entry(killer: String, victim: String) -> void:
	if not killfeed_container:
		return
	var label := Label.new()
	label.text = "%s ☠ %s" % [killer, victim]
	label.add_theme_color_override("font_color", Color(0.9, 0.8, 0.4))
	killfeed_container.add_child(label)
	
	# Auto remove after 5 seconds
	get_tree().create_timer(5.0).timeout.connect(func():
		if is_instance_valid(label):
			label.queue_free()
	)
