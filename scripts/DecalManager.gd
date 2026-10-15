class_name DecalManager
extends Node

static var instance: DecalManager

@export var max_decals: int = 120
var _decal_pool: Array[Decal] = []
var _pool_index: int = 0

func _enter_tree() -> void:
	instance = self

func _ready() -> void:
	_init_pool()

func _init_pool() -> void:
	for i in range(max_decals):
		var decal := Decal.new()
		decal.size = Vector3(0.3, 0.3, 0.3)
		decal.distance_fade_enabled = true
		decal.distance_fade_begin = 35.0
		decal.distance_fade_length = 15.0
		decal.visible = false
		add_child(decal)
		_decal_pool.append(decal)

func spawn_impact_decal(pos: Vector3, normal: Vector3, surface_type: String = "concrete") -> void:
	if _decal_pool.is_empty():
		return
		
	var decal: Decal = _decal_pool[_pool_index]
	_pool_index = (_pool_index + 1) % max_decals
	
	decal.global_position = pos
	
	if normal.is_equal_approx(Vector3.UP):
		decal.look_at(pos + normal, Vector3.FORWARD)
	else:
		decal.look_at(pos + normal, Vector3.UP)
		
	decal.visible = true
