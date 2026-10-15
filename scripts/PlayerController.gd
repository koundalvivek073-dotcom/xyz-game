class_name PlayerController
extends CharacterBody3D

signal health_changed(current_hp: float, max_hp: float)
signal player_eliminated()
signal inventory_toggled(is_open: bool)
signal map_toggled(is_open: bool)
signal pause_toggled(is_open: bool)
signal weapon_selected(slot: int)

enum Stance { STAND, CROUCH, PRONE }

@export_group("Locomotion Speeds")
@export var walk_speed: float = 4.0
@export var sprint_speed: float = 7.0
@export var crouch_speed: float = 2.5
@export var prone_speed: float = 1.3
@export var acceleration: float = 18.0
@export var friction: float = 14.0
@export var air_control: float = 0.25
@export var jump_velocity: float = 5.2

@export_group("Stance Dimensions")
@export var stand_height: float = 1.8
@export var crouch_height: float = 1.2
@export var prone_height: float = 0.5

@export_group("Camera Settings")
@export var mouse_sensitivity: float = 0.003
@export var mouse_smoothing: float = 26.0
@export var normal_fov: float = 75.0
@export var ads_fov: float = 48.0
@export var camera_shoulder_offset: Vector3 = Vector3(0.48, 0.45, 0.0)
@export var ads_shoulder_offset: Vector3 = Vector3(0.28, 0.38, -0.45)

var current_stance: Stance = Stance.STAND
var is_aiming: bool = false
var is_sprinting: bool = false
var is_vaulting: bool = false

# UI / Window States
var is_inventory_open: bool = false
var is_map_open: bool = false
var is_paused: bool = false

var camera_pitch: float = 0.0
var camera_yaw: float = 0.0
var target_camera_pitch: float = 0.0
var target_camera_yaw: float = 0.0
var trauma: float = 0.0
var trauma_power: float = 2.0

var health: float = 100.0
var max_health: float = 100.0
var is_dead: bool = false

@onready var collision_shape: CollisionShape3D = $CollisionShape3D
@onready var spring_arm: SpringArm3D = $CameraRig/SpringArm3D
@onready var camera: Camera3D = $CameraRig/SpringArm3D/Camera3D
@onready var camera_rig: Node3D = $CameraRig
@onready var mesh_root: Node3D = $MeshRoot
@onready var ray_vault_chest: RayCast3D = $VaultCheckChest
@onready var ray_vault_head: RayCast3D = $VaultCheckHead

var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

func _ready() -> void:
	_setup_runtime_input_map()
	# Capture mouse on game start
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if spring_arm:
		spring_arm.add_excluded_object(get_rid())
	emit_signal("health_changed", health, max_health)

func _unhandled_input(event: InputEvent) -> void:
	if is_dead:
		return
		
	# 1. Mouse Look with configurable sensitivity
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		target_camera_yaw -= event.relative.x * mouse_sensitivity
		target_camera_pitch -= event.relative.y * mouse_sensitivity
		target_camera_pitch = clamp(target_camera_pitch, deg_to_rad(-75.0), deg_to_rad(65.0))
		
	# 2. Re-capture mouse click when visible in-game
	elif event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode == Input.MOUSE_MODE_VISIBLE:
			if not is_inventory_open and not is_map_open and not is_paused:
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

	# 3. Pause / Menu (Escape)
	if event.is_action_pressed("pause") or event.is_action_pressed("menu"):
		toggle_pause()
		get_viewport().set_input_as_handled()
		return
		
	# 4. Inventory (Tab / I)
	if event.is_action_pressed("inventory"):
		toggle_inventory()
		get_viewport().set_input_as_handled()
		return
		
	# 5. Map (M)
	if event.is_action_pressed("map"):
		toggle_map()
		get_viewport().set_input_as_handled()
		return

	# If UI overlay is open, block movement and combat inputs
	if is_inventory_open or is_map_open or is_paused:
		return

	# 6. Stances: Crouch (C / Left Ctrl) & Prone (Z)
	if event.is_action_pressed("crouch") or event.is_action_pressed("stance_crouch"):
		toggle_crouch()
	elif event.is_action_pressed("prone") or event.is_action_pressed("stance_prone"):
		toggle_prone()
		
	# 7. Weapon Switch: 1, 2, 3 / X (Holster)
	if event.is_action_pressed("weapon_1"):
		emit_signal("weapon_selected", 1)
	elif event.is_action_pressed("weapon_2"):
		emit_signal("weapon_selected", 2)
	elif event.is_action_pressed("weapon_holster") or event.is_action_pressed("holster"):
		emit_signal("weapon_selected", 0)

func toggle_inventory() -> void:
	if is_map_open:
		is_map_open = false
		emit_signal("map_toggled", false)
	is_inventory_open = not is_inventory_open
	emit_signal("inventory_toggled", is_inventory_open)
	_sync_mouse_mode()

func toggle_map() -> void:
	if is_inventory_open:
		is_inventory_open = false
		emit_signal("inventory_toggled", false)
	is_map_open = not is_map_open
	emit_signal("map_toggled", is_map_open)
	_sync_mouse_mode()

func toggle_pause() -> void:
	if is_inventory_open:
		is_inventory_open = false
		emit_signal("inventory_toggled", false)
		_sync_mouse_mode()
		return
	if is_map_open:
		is_map_open = false
		emit_signal("map_toggled", false)
		_sync_mouse_mode()
		return
		
	is_paused = not is_paused
	emit_signal("pause_toggled", is_paused)
	_sync_mouse_mode()

func _sync_mouse_mode() -> void:
	# Release mouse when opening inventory, map, or hitting Escape
	if is_inventory_open or is_map_open or is_paused:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _physics_process(delta: float) -> void:
	if is_dead or is_vaulting or is_paused:
		return
		
	handle_gravity(delta)
	handle_stance_transition(delta)
	handle_vault_check()
	handle_aiming(delta)
	handle_movement(delta)
	update_camera(delta)
	
	move_and_slide()

func handle_gravity(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta

func handle_movement(delta: float) -> void:
	is_sprinting = Input.is_action_pressed("sprint") and current_stance == Stance.STAND and not is_aiming
	
	# Clean 8-directional movement vector via Input.get_vector
	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
	var move_dir := (transform.basis * Vector3(input_dir.x, 0.0, input_dir.y)).normalized()
	
	var target_speed := walk_speed
	match current_stance:
		Stance.STAND: target_speed = sprint_speed if is_sprinting else walk_speed
		Stance.CROUCH: target_speed = crouch_speed
		Stance.PRONE: target_speed = prone_speed
		
	if Input.is_action_just_pressed("jump") and is_on_floor():
		if current_stance != Stance.STAND:
			set_stance(Stance.STAND)
		else:
			velocity.y = jump_velocity

	var target_vel := move_dir * target_speed
	var accel := acceleration if is_on_floor() else (acceleration * air_control)
	var fric := friction if is_on_floor() else 0.5
	
	if move_dir.length() > 0.1:
		velocity.x = lerp(velocity.x, target_vel.x, accel * delta)
		velocity.z = lerp(velocity.z, target_vel.z, accel * delta)
	else:
		velocity.x = lerp(velocity.x, 0.0, fric * delta)
		velocity.z = lerp(velocity.z, 0.0, fric * delta)
		
	rotation.y = lerp_angle(rotation.y, camera_yaw, 15.0 * delta)

func handle_aiming(delta: float) -> void:
	is_aiming = Input.is_action_pressed("aim") or Input.is_action_pressed("ads")
	var target_fov: float = ads_fov if is_aiming else normal_fov
	camera.fov = lerp(camera.fov, target_fov, 14.0 * delta)
	
	var target_offset: Vector3 = ads_shoulder_offset if is_aiming else camera_shoulder_offset
	spring_arm.position = spring_arm.position.lerp(target_offset, 12.0 * delta)

func toggle_crouch() -> void:
	set_stance(Stance.STAND if current_stance == Stance.CROUCH else Stance.CROUCH)

func toggle_prone() -> void:
	set_stance(Stance.STAND if current_stance == Stance.PRONE else Stance.PRONE)

func set_stance(new_stance: Stance) -> void:
	current_stance = new_stance

func handle_stance_transition(delta: float) -> void:
	var target_height := stand_height
	match current_stance:
		Stance.STAND: target_height = stand_height
		Stance.CROUCH: target_height = crouch_height
		Stance.PRONE: target_height = prone_height
		
	var capsule := collision_shape.shape as CapsuleShape3D
	if capsule:
		capsule.height = lerp(capsule.height, target_height, 12.0 * delta)
		collision_shape.position.y = capsule.height * 0.5

func handle_vault_check() -> void:
	if is_on_floor() and Input.is_action_just_pressed("jump"):
		if ray_vault_chest and ray_vault_chest.is_colliding():
			if ray_vault_head and not ray_vault_head.is_colliding():
				execute_vault(ray_vault_chest.get_collision_point())

func execute_vault(target_point: Vector3) -> void:
	is_vaulting = true
	var vault_dest := target_point + Vector3(0, 1.2, 0)
	var tween := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(self, "global_position", vault_dest, 0.42)
	tween.finished.connect(func(): is_vaulting = false)

func add_trauma(amount: float) -> void:
	trauma = clamp(trauma + amount, 0.0, 1.0)

func apply_damage(amount: float, _is_headshot: bool, _hit_pos: Vector3) -> void:
	if is_dead:
		return
	health = max(0.0, health - amount)
	emit_signal("health_changed", health, max_health)
	add_trauma(0.35)
	
	if health <= 0.0:
		is_dead = true
		emit_signal("player_eliminated")

func apply_recoil(pitch_kick: float, yaw_kick: float) -> void:
	target_camera_pitch = clamp(target_camera_pitch + pitch_kick, deg_to_rad(-75.0), deg_to_rad(65.0))
	target_camera_yaw += yaw_kick
	add_trauma(0.18)

func update_camera(delta: float) -> void:
	# Smoothly interpolate camera yaw and pitch
	camera_yaw = lerp_angle(camera_yaw, target_camera_yaw, mouse_smoothing * delta)
	camera_pitch = lerp(camera_pitch, target_camera_pitch, mouse_smoothing * delta)
	
	camera_rig.rotation.y = camera_yaw
	spring_arm.rotation.x = camera_pitch
	
	if trauma > 0.0:
		trauma = max(trauma - 0.85 * delta, 0.0)
		var shake := pow(trauma, trauma_power)
		camera.rotation.z = deg_to_rad(1.8) * shake * (randf() * 2.0 - 1.0)
		camera.rotation.x = deg_to_rad(1.4) * shake * (randf() * 2.0 - 1.0)
		camera.rotation.y = deg_to_rad(1.4) * shake * (randf() * 2.0 - 1.0)
	else:
		camera.rotation = Vector3.ZERO

func _setup_runtime_input_map() -> void:
	var key_actions: Dictionary = {
		"move_forward": [KEY_W],
		"move_backward": [KEY_S],
		"move_back": [KEY_S],
		"move_left": [KEY_A],
		"move_right": [KEY_D],
		"jump": [KEY_SPACE],
		"crouch": [KEY_C, KEY_CTRL],
		"stance_crouch": [KEY_C, KEY_CTRL],
		"prone": [KEY_Z],
		"stance_prone": [KEY_Z],
		"sprint": [KEY_SHIFT],
		"reload": [KEY_R],
		"interact": [KEY_E, KEY_F],
		"loot": [KEY_E, KEY_F],
		"weapon_1": [KEY_1],
		"weapon_2": [KEY_2],
		"weapon_holster": [KEY_3, KEY_X],
		"holster": [KEY_3, KEY_X],
		"inventory": [KEY_TAB, KEY_I],
		"map": [KEY_M],
		"pause": [KEY_ESCAPE],
		"menu": [KEY_ESCAPE],
		"heal": [KEY_H]
	}
	
	for action in key_actions:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for key in key_actions[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			if not InputMap.action_has_event(action, ev):
				InputMap.action_add_event(action, ev)
				
	var mouse_actions: Dictionary = {
		"fire": MOUSE_BUTTON_LEFT,
		"attack": MOUSE_BUTTON_LEFT,
		"aim": MOUSE_BUTTON_RIGHT,
		"ads": MOUSE_BUTTON_RIGHT
	}
	for action in mouse_actions:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		var ev_m := InputEventMouseButton.new()
		ev_m.button_index = mouse_actions[action]
		if not InputMap.action_has_event(action, ev_m):
			InputMap.action_add_event(action, ev_m)
