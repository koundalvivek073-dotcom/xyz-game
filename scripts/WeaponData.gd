class_name WeaponData
extends Resource

@export var weapon_name: String = "AR-4"
@export var damage: float = 34.0
@export var headshot_multiplier: float = 2.2
@export var fire_rate: float = 0.09        # ~660 RPM
@export var muzzle_velocity: float = 850.0  # m/s
@export var max_range: float = 500.0
@export var bullet_drop_gravity: float = 9.8
@export var hybrid_raycast_cutoff: float = 15.0 # Instant hit <= 15m

@export_group("Ammunition & Reload")
@export var mag_size: int = 30
@export var extended_mag_size: int = 40
@export var reload_time: float = 1.9

@export_group("Recoil & Accuracy")
@export var vertical_recoil_base: float = 0.024
@export var horizontal_recoil_range: float = 0.012
@export var recoil_recovery_speed: float = 8.5
@export var base_bloom_spread: float = 0.014
@export var max_bloom_spread: float = 0.055
