class_name SafeZone
extends Node3D

signal zone_phase_changed(phase_index: int, time_left: float, state_name: String)

@export var mesh_cylinder: MeshInstance3D
@export var damage_interval: float = 1.0

var phases: Array[Dictionary] = [
	{ "wait": 45.0, "shrink": 35.0, "radius": 180.0, "damage": 2.0 },
	{ "wait": 40.0, "shrink": 30.0, "radius": 100.0, "damage": 4.0 },
	{ "wait": 35.0, "shrink": 25.0, "radius": 50.0,  "damage": 8.0 },
	{ "wait": 25.0, "shrink": 20.0, "radius": 15.0,  "damage": 14.0 },
	{ "wait": 15.0, "shrink": 15.0, "radius": 0.0,   "damage": 25.0 }
]

var current_center: Vector2 = Vector2.ZERO
var current_radius: float = 300.0
var next_center: Vector2 = Vector2.ZERO
var next_radius: float = 180.0
var shrink_start_center: Vector2 = Vector2.ZERO
var shrink_start_radius: float = 300.0

var current_phase_idx: int = 0
var state: String = "waiting" # "waiting" or "shrinking"
var phase_timer: float = 45.0
var damage_timer: float = 0.0

func _ready() -> void:
	calculate_next_circle()
	update_mesh()

func calculate_next_circle() -> void:
	if current_phase_idx >= phases.size():
		return
	var phase: Dictionary = phases[current_phase_idx]
	next_radius = phase.radius
	
	var max_offset := maxf(0.0, current_radius - next_radius - 10.0)
	var angle := randf() * TAU
	var dist := randf() * max_offset * 0.75
	next_center = current_center + Vector2(cos(angle), sin(angle)) * dist

func _process(delta: float) -> void:
	if current_phase_idx >= phases.size():
		return
		
	phase_timer -= delta
	var current_phase: Dictionary = phases[current_phase_idx]
	
	if state == "waiting":
		if phase_timer <= 0.0:
			state = "shrinking"
			phase_timer = current_phase.shrink
			shrink_start_center = current_center
			shrink_start_radius = current_radius
	elif state == "shrinking":
		var progress := clampf(1.0 - (phase_timer / current_phase.shrink), 0.0, 1.0)
		current_center = shrink_start_center.lerp(next_center, progress)
		current_radius = lerpf(shrink_start_radius, next_radius, progress)
		
		if phase_timer <= 0.0:
			current_center = next_center
			current_radius = next_radius
			current_phase_idx += 1
			
			if current_phase_idx < phases.size():
				state = "waiting"
				phase_timer = phases[current_phase_idx].wait
				calculate_next_circle()
			else:
				state = "closed"
				phase_timer = 0.0
				
	update_mesh()
	emit_signal("zone_phase_changed", current_phase_idx, phase_timer, state)

func update_mesh() -> void:
	if not mesh_cylinder:
		return
	mesh_cylinder.global_position.x = current_center.x
	mesh_cylinder.global_position.z = current_center.y
	mesh_cylinder.scale.x = maxf(0.1, current_radius)
	mesh_cylinder.scale.z = maxf(0.1, current_radius)

func is_outside_safe_zone(pos_3d: Vector3) -> bool:
	var dist := Vector2(pos_3d.x, pos_3d.z).distance_to(current_center)
	return dist > current_radius

func get_current_damage() -> float:
	var idx := mini(current_phase_idx, phases.size() - 1)
	return phases[idx].damage
