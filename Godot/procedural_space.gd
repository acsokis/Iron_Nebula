extends Node3D

const SEED_VALUE = 87321
var rng := RandomNumberGenerator.new()
var orbiters: Array[RigidBody3D] = []
var clock := 0.0
var spawn_timer := 0.0

func _ready() -> void:
	rng.seed = int(ProjectSettings.get_setting("iron_nebula/world/seed", SEED_VALUE))
	make_station(Vector3(8, 7, 0))
	# Initial reservations are explicit because physics registration is deferred.
	var reservations: Array[Vector3] = [Vector3(8, 7, 0), Vector3(-13, 0, 0)]
	for i in range(8):
		var candidate := Vector3(rng.randf_range(-5, 29), rng.randf_range(-10, 10), 0)
		var free := true
		for previous in reservations:
			if previous.distance_to(candidate) < 6:
				free = false
		if free:
			reservations.append(candidate)
			make_orbiter(candidate, i % 3 == 0)

func material(color: Color, emissive: bool = false) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = 0.8
	result.metallic = 0.65 if emissive else 0.2
	result.emission_enabled = emissive
	result.emission = color
	result.emission_energy_multiplier = 2
	return result

func make_station(center: Vector3) -> void:
	var station := StaticBody3D.new()
	station.name = "Station"
	station.collision_layer = 4
	station.collision_mask = 1 | 2 | 4
	station.position = center
	add_child(station)
	for i in range(5):
		var mesh := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(1.8, 2.4 if i % 2 == 0 else 1.1, 1.7)
		box.material = material(Color("394955"))
		mesh.mesh = box
		mesh.position.x = (i - 2) * 1.9
		mesh.gi_mode = GeometryInstance3D.GI_MODE_STATIC
		station.add_child(mesh)
		var collision := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = box.size
		collision.shape = shape
		collision.position = mesh.position
		station.add_child(collision)
		var lamp := MeshInstance3D.new()
		var lamp_mesh := BoxMesh.new()
		lamp_mesh.size = Vector3(1.2, 0.12, 0.1)
		lamp_mesh.material = material(Color("51e8ff"), true)
		lamp.mesh = lamp_mesh
		lamp.position = mesh.position + Vector3(0, 0, 0.9)
		lamp.gi_mode = GeometryInstance3D.GI_MODE_STATIC
		station.add_child(lamp)

func make_orbiter(center: Vector3, wreck: bool) -> void:
	var radius := rng.randf_range(0.5, 1.2)
	var body := RigidBody3D.new()
	body.name = "Wreck" if wreck else "Asteroid"
	body.gravity_scale = 0
	body.axis_lock_linear_z = true
	body.continuous_cd = true
	body.linear_damp = 0
	body.collision_layer = 4
	body.collision_mask = 1 | 2 | 4
	body.position = center
	body.set_meta("health", ceili(radius * 6))
	body.linear_velocity = Vector3(-rng.randf_range(0.4, 1.2), rng.randf_range(-0.25, 0.25), 0)
	body.angular_velocity.z = rng.randf_range(-0.3, 0.3)
	var mesh := MeshInstance3D.new()
	var shape: Shape3D
	if wreck:
		var box := BoxMesh.new()
		box.size = Vector3(radius * 2, radius, radius)
		box.material = material(Color("687783"))
		mesh.mesh = box
		var solid := BoxShape3D.new()
		solid.size = box.size
		shape = solid
	else:
		var sphere := SphereMesh.new()
		sphere.radius = radius
		sphere.height = radius * 2
		sphere.radial_segments = 9
		sphere.rings = 5
		sphere.material = material(Color("5b5752"))
		mesh.mesh = sphere
		var solid := SphereShape3D.new()
		solid.radius = radius
		shape = solid
	mesh.gi_mode = GeometryInstance3D.GI_MODE_DYNAMIC
	body.add_child(mesh)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	body.add_child(collision)
	add_child(body)
	orbiters.append(body)

func _physics_process(delta: float) -> void:
	clock += delta
	spawn_timer -= delta
	for body in orbiters:
		if body.position.x < -31:
			body.queue_free()
	orbiters = orbiters.filter(func(body): return not body.is_queued_for_deletion())
	if spawn_timer <= 0 and orbiters.size() < 16:
		var candidate := Vector3(29, rng.randf_range(-10, 10), 0)
		var query := PhysicsShapeQueryParameters3D.new()
		var shape := SphereShape3D.new()
		shape.radius = 1.8
		query.shape = shape
		query.transform.origin = candidate
		query.collision_mask = 1 | 2 | 4
		if get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty():
			make_orbiter(candidate, rng.randf() < 0.35)
		spawn_timer = 3
