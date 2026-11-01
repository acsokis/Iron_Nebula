extends Node3D

## Playable migration foundation, not yet a campaign/co-op replacement.
@export var ship_model: PackedScene
const VisualSlot = preload("res://Godot/visual_slot.gd")
const FlightNavigation = preload("res://Godot/flight_navigation.gd")
const ProceduralSpace = preload("res://Godot/procedural_space.gd")
const BACKDROPS = ["spaceFrontier", "spaceRift", "spaceInferno"]
const FIELD = Vector2(48, 27)
const SHOT_LIMIT = 512
const WEAPONS := [
	{"name": "PULSE", "interval": 0.10, "speed": 38.0, "damage": 1, "angles": [0.0], "scale": Vector3.ONE},
	{"name": "LANCE", "interval": 0.32, "speed": 52.0, "damage": 2, "angles": [0.0], "scale": Vector3(1.8, 0.75, 0.75)},
	{"name": "ARC", "interval": 0.24, "speed": 34.0, "damage": 1, "angles": [-0.14, 0.0, 0.14], "scale": Vector3(0.8, 0.8, 0.8)},
	{"name": "GATLING", "interval": 0.055, "speed": 43.0, "damage": 1, "angles": [0.0], "scale": Vector3(0.65, 0.65, 0.65)},
	{"name": "BEAM", "interval": 0.14, "speed": 56.0, "damage": 3, "angles": [0.0], "scale": Vector3(2.4, 0.55, 0.55)},
]
var camera: Camera3D
var pilot: CharacterBody3D
var muzzle: Marker3D
var environment: Environment
var status: Label
var backdrops: Array[Node3D] = []
var scenery: Array[Node3D] = []
var shots: Array[Dictionary] = []
var enemies: Array[CharacterBody3D] = []
var projectile_mesh: MultiMeshInstance3D
var elapsed := 0.0
var fire_clock := 0.0
var spawn_clock := 0.0
var weapon_mode := 0
var sector := 0
var score := 0
var tethered := true
var rtx_active := false
var navigation = FlightNavigation.new()

func art(name: String) -> Texture2D:
	return load("res://Web/public/assets/%s.webp" % name) as Texture2D

func _ready() -> void:
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_PERSPECTIVE
	camera.fov = rad_to_deg(2 * atan(FIELD.y / 120))
	camera.position = Vector3(0, 0, 60)
	add_child(camera)
	camera.current = true
	environment = Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("030715")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("8fa4be")
	environment.ambient_light_energy = 0.6
	environment.tonemap_mode = Environment.TONE_MAPPER_ACES
	environment.glow_enabled = true
	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)
	configure_rtx()
	var light := OmniLight3D.new()
	light.position = Vector3(-6, 5, 8)
	light.light_color = Color("69dfff")
	light.light_energy = 6
	light.omni_range = 36
	add_child(light)
	for i in range(3):
		var tile := VisualSlot.new()
		tile.position.z = -30
		add_child(tile)
		backdrops.append(tile)
	for i in range(12):
		var rock := VisualSlot.new()
		var depth := i % 3
		rock.configure(art("rock" if i % 2 else "rock2"), Vector2.ONE * (1.7 + depth * 0.7))
		rock.position = Vector3(0, fposmod(i * 6.57, 25.0) - 12.5, -15 + depth * 3)
		add_child(rock)
		scenery.append(rock)
	set_sector(0)
	pilot = make_body("ship", Vector2(7.1, 2.68), ship_model)
	pilot.collision_layer = 1
	pilot.collision_mask = 2 | 4 | 8
	pilot.position.x = -13
	make_boundary(Vector3(0, 14.5, 0), Vector3(70, 2, 8), 4)
	make_boundary(Vector3(0, -14.5, 0), Vector3(70, 2, 8), 4)
	make_boundary(Vector3(-33, 0, 0), Vector3(2, 30, 8), 4)
	make_boundary(Vector3(33, 0, 0), Vector3(2, 30, 8), 4)
	# Player-only screen boundaries let enemies enter from outside the viewport.
	make_boundary(Vector3(-25, 0, 0), Vector3(2, 30, 8), 8)
	make_boundary(Vector3(25, 0, 0), Vector3(2, 30, 8), 8)
	var space := ProceduralSpace.new()
	space.name = "ProceduralSpace"
	add_child(space)
	if not rtx_active and RenderingServer.get_current_rendering_method() == "forward_plus" and ResourceLoader.exists("res://Godot/space_gi.res"):
		var gi := VoxelGI.new()
		gi.size = Vector3(64, 28, 12)
		gi.data = load("res://Godot/space_gi.res") as VoxelGIData
		add_child(gi)
		print("Iron Nebula raster VoxelGI: baked station volume active")
	muzzle = Marker3D.new()
	muzzle.name = "Muzzle"
	muzzle.position.x = 3.2
	pilot.add_child(muzzle)
	projectile_mesh = MultiMeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.12
	mesh.height = 0.24
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("96ecff")
	material.emission_enabled = true
	material.emission = Color("43caff")
	material.emission_energy_multiplier = 4
	mesh.material = material
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.mesh = mesh
	batch.instance_count = SHOT_LIMIT
	batch.visible_instance_count = 0
	projectile_mesh.multimesh = batch
	add_child(projectile_mesh)
	var hud := CanvasLayer.new()
	add_child(hud)
	status = Label.new()
	status.position = Vector2(28, 24)
	status.add_theme_font_size_override("font_size", 24)
	hud.add_child(status)
	if "--capture-preview" in OS.get_cmdline_user_args():
		capture_preview.call_deferred()

func capture_preview() -> void:
	for i in range(60):
		await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var result := image.save_png("res://.godot/engine-preview-raster.png" if "--raster-preview" in OS.get_cmdline_user_args() else "res://.godot/engine-preview.png")
	print("Engine viewport capture: %s" % error_string(result))

func configure_rtx() -> void:
	# NVIDIA fork properties are discovered dynamically, so stock Godot can still
	# run this scene. No fictional Vortex plugin or unbaked VoxelGI is advertised.
	var rd := RenderingServer.get_rendering_device()
	var fork_available := false
	for property in environment.get_property_list():
		if property.name == "pathtracing_enabled":
			fork_available = true
	rtx_active = fork_available and rd != null and rd.has_feature(12) and bool(ProjectSettings.get_setting("iron_nebula/rendering/request_rtx", true)) and not "--raster-preview" in OS.get_cmdline_user_args()
	if fork_available:
		# DLSS runtime libraries are a separate vendor dependency. Use the explicit
		# supported NONE denoiser until their availability is validated.
		environment.set("pathtracing_denoiser", 0)
		environment.set("pathtracing_enabled", rtx_active)
	print("Iron Nebula engine preview: renderer=%s, NVIDIA fork=%s, RTX active=%s, denoiser=NONE" % [RenderingServer.get_current_rendering_method(), fork_available, rtx_active])

func make_body(texture: String, dimensions: Vector2, model: PackedScene = null, mirror: bool = false) -> CharacterBody3D:
	var body := CharacterBody3D.new()
	body.motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	body.axis_lock_linear_z = true
	body.collision_layer = 2
	body.collision_mask = 1 | 2 | 4
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = dimensions.y * 0.36
	shape.height = maxf(dimensions.x * 0.84, shape.radius * 2)
	collision.shape = shape
	collision.rotation.z = PI / 2
	body.add_child(collision)
	var visual := VisualSlot.new()
	visual.name = "VisualSlot"
	visual.configure(art(texture), dimensions, model, mirror)
	body.add_child(visual)
	add_child(body)
	return body

func make_boundary(center: Vector3, size: Vector3, layer: int) -> void:
	var wall := StaticBody3D.new()
	wall.collision_layer = layer
	wall.collision_mask = 0
	wall.position = center
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	wall.add_child(collision)
	add_child(wall)

func select_weapon(value: int) -> void:
	weapon_mode = posmod(value, WEAPONS.size())

func fire_volley() -> void:
	var weapon: Dictionary = WEAPONS[weapon_mode]
	for angle: float in weapon["angles"]:
		if shots.size() >= SHOT_LIMIT:
			break
		var direction := Vector3(cos(angle), sin(angle), 0)
		shots.append({
			"position": muzzle.global_position,
			"velocity": direction * float(weapon["speed"]),
			"damage": int(weapon["damage"]),
			"scale": weapon["scale"],
		})
	fire_clock = float(weapon["interval"])

func spawn_is_clear(center: Vector3, dimensions: Vector2) -> bool:
	var query := PhysicsShapeQueryParameters3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = dimensions.y * 0.36 + 0.1
	shape.height = maxf(dimensions.x * 0.84 + 0.2, shape.radius * 2)
	query.shape = shape
	query.transform = Transform3D(Basis(Vector3.BACK, PI / 2), center)
	query.collision_mask = 1 | 2 | 4
	return get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()

func set_sector(value: int) -> void:
	sector = posmod(value, BACKDROPS.size())
	for i in range(backdrops.size()):
		backdrops[i].configure(art(BACKDROPS[sector]), Vector2(FIELD.x * 1.5, (FIELD.y + 2.5) * 1.5))
		var quad: MeshInstance3D = backdrops[i].get_child(backdrops[i].get_child_count() - 1)
		var material := StandardMaterial3D.new()
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.albedo_texture = art(BACKDROPS[sector])
		material.albedo_color = Color.BLACK
		material.emission_enabled = true
		material.emission = Color.WHITE
		material.emission_texture = art(BACKDROPS[sector])
		material.cull_mode = BaseMaterial3D.CULL_DISABLED
		quad.material_override = material

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode >= KEY_1 and event.physical_keycode <= KEY_5:
			select_weapon(event.physical_keycode - KEY_1)
		elif event.physical_keycode == KEY_TAB:
			set_sector(sector + 1)
		elif event.physical_keycode == KEY_T:
			tethered = not tethered
		elif event.physical_keycode == KEY_ESCAPE:
			get_tree().quit()

func _physics_process(delta: float) -> void:
	elapsed += delta
	var axes := Vector2(float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_W)) - float(Input.is_physical_key_pressed(KEY_S)))
	var pads := Input.get_connected_joypads()
	var firing := Input.is_physical_key_pressed(KEY_SPACE) or Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	if not pads.is_empty():
		var pad := pads[0]
		var stick := Vector2(Input.get_joy_axis(pad, JOY_AXIS_LEFT_X), -Input.get_joy_axis(pad, JOY_AXIS_LEFT_Y))
		if stick.length() > 0.16:
			axes = stick
		firing = firing or Input.get_joy_axis(pad, JOY_AXIS_TRIGGER_RIGHT) > 0.2 or Input.is_joy_button_pressed(pad, JOY_BUTTON_X)
	var desired := axes.limit_length() * 16
	if axes.length() < 0.1 and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		var mouse := get_viewport().get_mouse_position()
		var point = Plane(Vector3.BACK, 0).intersects_ray(camera.project_ray_origin(mouse), camera.project_ray_normal(mouse))
		if point != null:
			var difference: Vector3 = point - pilot.position
			desired = Vector2(difference.x, difference.y) * (7 if tethered else 3)
			desired = desired.limit_length(20)
	pilot.velocity = pilot.velocity.lerp(Vector3(desired.x, desired.y, 0), 1 - exp(-delta * 12))
	pilot.move_and_slide()
	fire_clock -= delta
	if firing and fire_clock <= 0 and shots.size() < SHOT_LIMIT:
		fire_volley()
	spawn_clock -= delta
	if spawn_clock <= 0 and enemies.size() < 24:
		var candidate := Vector3(27, sin(elapsed * 1.7) * 9, 0)
		if spawn_is_clear(candidate, Vector2(3.5, 1.6)):
			var enemy := make_body("scout", Vector2(3.5, 1.6), null, true)
			enemy.set_meta("health", 2)
			enemy.position = candidate
			enemies.append(enemy)
			spawn_clock = 1.1
		else:
			spawn_clock = 0.2
	for enemy in enemies:
		enemy.velocity = navigation.direction(enemy, Vector3(-28, clampf(enemy.position.y, -10, 10), 0), Engine.get_physics_frames()) * 5
		enemy.move_and_slide()
		if enemy.position.x < -28:
			navigation.forget(enemy)
			enemy.queue_free()
	for i in range(shots.size() - 1, -1, -1):
		var shot: Dictionary = shots[i]
		var previous: Vector3 = shot.position
		shot.position += shot.velocity * delta
		var ray := PhysicsRayQueryParameters3D.create(previous, shot.position, 2 | 4 | 8, [pilot.get_rid()])
		var hit := get_world_3d().direct_space_state.intersect_ray(ray)
		if not hit.is_empty():
			if hit.collider is RigidBody3D and hit.collider.has_meta("health"):
				var health: int = int(hit.collider.get_meta("health")) - int(shot["damage"])
				hit.collider.set_meta("health", health)
				if health <= 0:
					hit.collider.queue_free()
					score += 25
			if hit.collider is CharacterBody3D and hit.collider in enemies and not hit.collider.is_queued_for_deletion():
				var health: int = int(hit.collider.get_meta("health")) - int(shot["damage"])
				if health <= 0:
					navigation.forget(hit.collider)
					hit.collider.queue_free()
					score += 100
				else:
					hit.collider.set_meta("health", health)
			shots.remove_at(i)
		elif shot.position.x > 29:
			shots.remove_at(i)
	enemies = enemies.filter(func(enemy): return not enemy.is_queued_for_deletion())
	for i in range(shots.size()):
		var shot: Dictionary = shots[i]
		projectile_mesh.multimesh.set_instance_transform(i, Transform3D(Basis.from_scale(shot["scale"]), shot["position"]))
	projectile_mesh.multimesh.visible_instance_count = shots.size()
	var offset := fposmod(elapsed * 0.35, FIELD.x * 2)
	var tile_index := int(offset / FIELD.x)
	for i in range(3):
		var tile := backdrops[i]
		tile.position.x = ((i - 1) * FIELD.x - fposmod(offset, FIELD.x)) * 1.5
		tile.position.y = sin(elapsed / 95) * 0.55
	for i in range(scenery.size()):
		var depth := i % 3
		scenery[i].position.x = fposmod(i * 9.7 - elapsed * [0.875, 3.5, 8.5][depth], 64) - 32
	status.text = "ENGINE PREVIEW | %s | %s | %s | SCORE %d\nWASD / left stick · LMB / RT fire · 1-5 weapon · T tether %s · Tab sector · Esc quit" % [BACKDROPS[sector].to_upper(), "RTX (no denoiser)" if rtx_active else "RASTER", WEAPONS[weapon_mode]["name"], score, "ON" if tethered else "OFF"]
