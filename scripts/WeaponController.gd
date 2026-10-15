class_name WeaponController
extends Node3D

signal ammo_updated(current: int, reserve: int)
signal hit_registered(is_headshot: bool, hit_pos: Vector3, damage: float)

@export var weapon_data: WeaponData
@export var muzzle_node: Marker3D
@export var ejection_port: Marker3D
@export var player_cam: Camera3D
@export var player_controller: Node3D

var current_mag: int = 30
var current_reserve: int = 150
var fire_timer: float = 0.0
var is_reloading: bool = false
var recoil_offset: Vector2 = Vector2.ZERO
var current_bloom: float = 0.0

var active_bullets: Array[Dictionary] = []

func _ready() -> void:
	if weapon_data:
		current_mag = weapon_data.mag_size
	emit_signal("ammo_updated", current_mag, current_reserve)

func _process(delta: float) -> void:
	if fire_timer > 0.0:
		fire_timer -= delta
		
	# Smooth recoil recovery
	recoil_offset = recoil_offset.lerp(Vector2.ZERO, weapon_data.recoil_recovery_speed * delta)
	current_bloom = lerp(current_bloom, weapon_data.base_bloom_spread, 10.0 * delta)
	
	if Input.is_action_pressed("fire") and fire_timer <= 0.0 and not is_reloading:
		shoot()
		
	if Input.is_action_just_pressed("reload") and not is_reloading:
		start_reload()
		
	update_ballistic_bullets(delta)

func shoot() -> void:
	if current_mag <= 0:
		start_reload()
		return
		
	current_mag -= 1
	fire_timer = weapon_data.fire_rate
	emit_signal("ammo_updated", current_mag, current_reserve)
	
	# Recoil Kick
	var v_kick := weapon_data.vertical_recoil_base
	var h_kick := randf_range(-weapon_data.horizontal_recoil_range, weapon_data.horizontal_recoil_range)
	recoil_offset += Vector2(h_kick, v_kick)
	
	if player_controller:
		if player_controller.has_method("apply_recoil"):
			player_controller.apply_recoil(v_kick, h_kick)
		elif player_controller.has_method("add_trauma"):
			player_controller.camera_pitch += v_kick
			player_controller.camera_yaw += h_kick
			player_controller.add_trauma(0.18)
		
	# Muzzle ray
	var origin: Vector3 = player_cam.global_position if player_cam else global_position
	var forward: Vector3 = -player_cam.global_transform.basis.z if player_cam else -global_transform.basis.z
	
	# Bloom cone spread
	var spread_offset := Vector3(
		randf_range(-current_bloom, current_bloom),
		randf_range(-current_bloom, current_bloom),
		0.0
	)
	var shoot_dir := (forward + (player_cam.global_transform.basis * spread_offset if player_cam else spread_offset)).normalized()
	
	# Instant Raycast <= 15m
	var space_state := get_world_3d().direct_space_state
	var ray_query := PhysicsRayQueryParameters3D.create(origin, origin + shoot_dir * weapon_data.hybrid_raycast_cutoff)
	if player_controller:
		ray_query.exclude = [player_controller.get_rid()]
	var result := space_state.intersect_ray(ray_query)
	
	if result:
		process_hit(result.collider, result.position, result.normal)
	else:
		# Physical bullet projectile past 15m
		spawn_physical_bullet(origin + shoot_dir * weapon_data.hybrid_raycast_cutoff, shoot_dir)
		
	current_bloom = min(current_bloom + 0.007, weapon_data.max_bloom_spread)

func spawn_physical_bullet(start_pos: Vector3, dir: Vector3) -> void:
	active_bullets.append({
		"position": start_pos,
		"velocity": dir * weapon_data.muzzle_velocity,
		"distance_traveled": weapon_data.hybrid_raycast_cutoff,
		"alive": true
	})

func update_ballistic_bullets(delta: float) -> void:
	var space_state := get_world_3d().direct_space_state
	
	for i in range(active_bullets.size() - 1, -1, -1):
		var b: Dictionary = active_bullets[i]
		if not b.alive:
			active_bullets.remove_at(i)
			continue
			
		var prev_pos: Vector3 = b.position
		b.velocity.y -= weapon_data.bullet_drop_gravity * delta
		var step: Vector3 = b.velocity * delta
		b.position += step
		b.distance_traveled += step.length()
		
		var query := PhysicsRayQueryParameters3D.create(prev_pos, b.position)
		if player_controller:
			query.exclude = [player_controller.get_rid()]
		var result := space_state.intersect_ray(query)
		
		if result:
			process_hit(result.collider, result.position, result.normal)
			active_bullets.remove_at(i)
		elif b.distance_traveled >= weapon_data.max_range:
			active_bullets.remove_at(i)

func process_hit(target: Object, hit_pos: Vector3, normal: Vector3) -> void:
	var is_headshot := false
	var final_damage := weapon_data.damage
	
	if target is Node and target.name == "HeadHitbox":
		is_headshot = true
		final_damage *= weapon_data.headshot_multiplier
		
	if target and target.has_method("apply_damage"):
		target.apply_damage(final_damage, is_headshot, hit_pos)
		
	if DecalManager.instance:
		DecalManager.instance.spawn_impact_decal(hit_pos, normal, "concrete")
		
	emit_signal("hit_registered", is_headshot, hit_pos, final_damage)

func start_reload() -> void:
	if current_mag >= weapon_data.mag_size or current_reserve <= 0:
		return
	is_reloading = true
	get_tree().create_timer(weapon_data.reload_time).timeout.connect(_on_reload_finished)

func _on_reload_finished() -> void:
	var needed := weapon_data.mag_size - current_mag
	var take := mini(needed, current_reserve)
	current_mag += take
	current_reserve -= take
	is_reloading = false
	emit_signal("ammo_updated", current_mag, current_reserve)
