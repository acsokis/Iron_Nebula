class_name NebulaVisualSlot
extends Node3D

## Replace artwork with an imported .glb/.gltf scene without changing the body,
## collision, flight plane or weapon mounts owned by its parent.
func configure(art: Texture2D, dimensions: Vector2, model: PackedScene = null, mirror: bool = false, metallic_frame: bool = false) -> void:
	for child in get_children():
		child.queue_free()
	if model != null:
		add_child(model.instantiate())
		return
	if metallic_frame:
		var frame := MeshInstance3D.new()
		frame.name = "MetallicFrame"
		var frame_mesh := QuadMesh.new()
		frame_mesh.size = dimensions * 1.08
		frame.mesh = frame_mesh
		frame.position.z = -0.06
		var frame_material := StandardMaterial3D.new()
		frame_material.albedo_texture = art
		frame_material.albedo_color = Color("9ab0bd")
		frame_material.metallic = 0.94
		frame_material.roughness = 0.28
		frame_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
		frame_material.alpha_scissor_threshold = 0.025
		frame_material.cull_mode = BaseMaterial3D.CULL_DISABLED
		frame_material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
		if mirror:
			frame_material.uv1_scale.x = -1
			frame_material.uv1_offset.x = 1
		frame.material_override = frame_material
		add_child(frame)
	var quad := MeshInstance3D.new()
	quad.name = "HullSprite"
	var mesh := QuadMesh.new()
	mesh.size = dimensions
	quad.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_texture = art
	material.albedo_color = Color.BLACK
	material.emission_enabled = true
	material.emission = Color.WHITE
	material.emission_texture = art
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	material.alpha_scissor_threshold = 0.025
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	if mirror:
		material.uv1_scale.x = -1
		material.uv1_offset.x = 1
	quad.material_override = material
	add_child(quad)
