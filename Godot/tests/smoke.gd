extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run_checks")

func check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)

func key(code: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.pressed = pressed
	Input.parse_input_event(event)

func run_checks() -> void:
	var scene := load("res://Godot/arena.tscn") as PackedScene
	check(scene != null, "Arena scene must load")
	if scene == null:
		quit(1)
		return
	var arena = scene.instantiate()
	root.add_child(arena)
	await process_frame
	check(arena.pilot is CharacterBody3D, "Flight uses a real 3D physics body")
	check(arena.pilot.has_node("VisualSlot"), "Visual model stays separate from collision")
	check(arena.WEAPONS.size() == 5, "All five primary weapon modes are available")
	for mode in range(arena.WEAPONS.size()):
		arena.select_weapon(mode)
		var before_shots: int = arena.shots.size()
		arena.fire_volley()
		var expected_shots: int = arena.WEAPONS[mode]["angles"].size()
		check(arena.shots.size() - before_shots == expected_shots, "%s fires its expected volley pattern" % arena.WEAPONS[mode]["name"])
		if expected_shots > 0:
			check(arena.shots[before_shots]["damage"] == arena.WEAPONS[mode]["damage"], "%s applies its configured damage" % arena.WEAPONS[mode]["name"])
		arena.shots.clear()
		arena.fire_clock = 0
	arena.shots.resize(arena.SHOT_LIMIT - 1)
	arena.select_weapon(2)
	arena.fire_volley()
	check(arena.shots.size() == arena.SHOT_LIMIT, "Spread volleys respect the bounded projectile pool")
	arena.shots.clear()
	var select_beam := InputEventKey.new()
	select_beam.physical_keycode = KEY_5
	select_beam.pressed = true
	arena._unhandled_key_input(select_beam)
	check(arena.weapon_mode == 4, "Number keys select the matching weapon")
	var select_pulse := InputEventKey.new()
	select_pulse.physical_keycode = KEY_1
	select_pulse.pressed = true
	arena._unhandled_key_input(select_pulse)
	check(arena.weapon_mode == 0, "Pulse remains the default weapon")
	var before: float = arena.pilot.position.x
	key(KEY_D, true)
	for i in range(45):
		await physics_frame
	key(KEY_D, false)
	check(arena.pilot.position.x > before + 4, "Keyboard input moves the pilot smoothly")
	check(is_zero_approx(arena.pilot.position.z), "Pilot remains on the XY flight plane")
	check(arena.pilot.collision_layer == 1 and (arena.pilot.collision_mask & 1) == 0, "Players never physically block other players")
	var friend = arena.make_body("ship", Vector2(7.1, 2.68))
	friend.collision_layer = 1
	friend.collision_mask = 2 | 4 | 8
	friend.position = arena.pilot.position + Vector3(4, 0, 0)
	for i in range(30):
		await physics_frame
		friend.velocity = Vector3(-25, 0, 0)
		friend.move_and_slide()
	check(friend.position.x < arena.pilot.position.x - 3, "Real Jolt movement allows friendly players to cross")
	friend.queue_free()
	check(not arena.enemies.is_empty(), "Enemy spawn creates a physics target")
	if not arena.enemies.is_empty():
		arena.enemies[0].position = arena.pilot.position + Vector3(8, 0, 0)
	key(KEY_SPACE, true)
	for i in range(150):
		await physics_frame
	key(KEY_SPACE, false)
	check(arena.shots.size() > 0, "Firing creates live projectiles")
	check(arena.shots.size() <= arena.SHOT_LIMIT, "Projectile storage remains bounded")
	check(arena.score > 0, "Swept 3D projectile queries hit spawned enemies")
	check(arena.projectile_mesh.multimesh.visible_instance_count == arena.shots.size(), "GPU batch matches live projectile count")
	for sector in range(3):
		arena.set_sector(sector)
		await process_frame
		check(arena.sector == sector and arena.backdrops.size() == 3, "Every sector retains three endless tiles")
	var model := Node3D.new()
	model.name = "ImportedModel"
	var packed := PackedScene.new()
	check(packed.pack(model) == OK, "Replacement visual scene packs")
	model.free()
	var slot = arena.pilot.get_node("VisualSlot")
	slot.configure(arena.art("ship"), Vector2.ONE, packed)
	await process_frame
	check(slot.has_node("ImportedModel"), "A model scene replaces the sprite without replacing the pilot body")
	check(arena.pilot.has_node("Muzzle"), "Weapon mount survives visual replacement")
	key(KEY_D, true)
	for i in range(150):
		await physics_frame
	key(KEY_D, false)
	check(arena.pilot.position.x < 23, "Solid world boundaries stop the pilot without transform clamping")
	check(not arena.spawn_is_clear(arena.pilot.position, Vector2(7.1, 2.68)), "Spawner rejects occupied full-body volume")
	if failures.is_empty():
		print("PASS: Godot XY flight, physics hits, GPU batch bounds, three sector tiles and replaceable visual model")
	arena.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
