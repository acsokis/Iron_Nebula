extends SceneTree

func _initialize() -> void:
	call_deferred("bake")

func bake() -> void:
	var scene := load("res://Godot/arena.tscn") as PackedScene
	var arena = scene.instantiate()
	root.add_child(arena)
	await process_frame
	arena.set_physics_process(false)
	arena.get_node("ProceduralSpace").set_physics_process(false)
	var gi := VoxelGI.new()
	gi.size = Vector3(64, 28, 12)
	gi.subdiv = VoxelGI.SUBDIV_64
	arena.add_child(gi)
	gi.bake(arena)
	if gi.data == null:
		push_error("VoxelGI bake did not produce data")
		quit(1)
		return
	var result := ResourceSaver.save(gi.data, "res://Godot/space_gi.res")
	print("VoxelGI station bake: %s" % error_string(result))
	quit(0 if result == OK else 1)
