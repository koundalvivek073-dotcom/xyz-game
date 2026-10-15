class_name LootSpawner
extends Node3D

enum LootType { WEAPON_AR, AMMO_556, MEDKIT, ARMOR_VEST }

@export var spawn_radius: float = 120.0
@export var loot_count: int = 40

var loot_weights: Dictionary = {
	LootType.WEAPON_AR: 15,
	LootType.AMMO_556: 45,
	LootType.MEDKIT: 25,
	LootType.ARMOR_VEST: 15
}

func _ready() -> void:
	spawn_world_loot()

func spawn_world_loot() -> void:
	for i in range(loot_count):
		var pos := get_random_spawn_point()
		var type := pick_weighted_loot()
		create_loot_item(pos, type)

func get_random_spawn_point() -> Vector3:
	var angle := randf() * TAU
	var dist := randf() * spawn_radius
	var x := cos(angle) * dist
	var z := sin(angle) * dist
	return Vector3(x, 1.0, z)

func pick_weighted_loot() -> LootType:
	var total_weight := 0
	for w in loot_weights.values():
		total_weight += w
		
	var roll := randi_range(0, total_weight)
	var cursor := 0
	for type in loot_weights.keys():
		cursor += loot_weights[type]
		if roll <= cursor:
			return type
	return LootType.AMMO_556

func create_loot_item(pos: Vector3, type: LootType) -> void:
	var area := Area3D.new()
	area.collision_layer = 4
	area.collision_mask = 2
	area.global_position = pos
	
	var col := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 1.4
	col.shape = sphere
	area.add_child(col)
	
	# Visual crate mesh
	var mesh_inst := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.8, 0.5, 0.5)
	mesh_inst.mesh = box
	
	var mat := StandardMaterial3D.new()
	match type:
		LootType.WEAPON_AR:
			mat.albedo_color = Color(0.9, 0.75, 0.3)
			mat.emission_enabled = true
			mat.emission = Color(0.9, 0.75, 0.3)
		LootType.MEDKIT:
			mat.albedo_color = Color(0.2, 0.8, 0.4)
		_:
			mat.albedo_color = Color(0.3, 0.6, 0.9)
	mesh_inst.material_override = mat
	area.add_child(mesh_inst)
	
	area.body_entered.connect(func(body: Node3D):
		if body is PlayerController:
			on_player_pickup(body, type)
			area.queue_free()
	)
	
	add_child(area)

func on_player_pickup(player: PlayerController, type: LootType) -> void:
	match type:
		LootType.MEDKIT:
			player.health = minf(player.max_health, player.health + 50.0)
			player.emit_signal("health_changed", player.health, player.max_health)
		LootType.AMMO_556:
			# ammo grant
			pass
		_:
			pass
