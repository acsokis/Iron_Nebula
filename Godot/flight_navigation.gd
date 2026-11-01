extends RefCounted

var routes: Dictionary = {}

func corridor(body: CharacterBody3D, start: Vector3, finish: Vector3) -> bool:
	var collision := body.get_child(0) as CollisionShape3D
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = collision.shape
	query.transform = Transform3D(body.global_basis * collision.basis, start)
	query.exclude = [body.get_rid()]
	query.collision_mask = body.collision_mask
	query.margin = 0.06
	var space := body.get_world_3d().direct_space_state
	if not space.intersect_shape(query, 1).is_empty():
		return false
	query.motion = finish - start
	var result := space.cast_motion(query)
	return result.size() == 2 and result[0] >= 0.9999

func plan(body: CharacterBody3D, goal: Vector3) -> Array[Vector3]:
	var start := body.global_position
	if corridor(body, start, goal):
		return [goal]
	var open: Array[Dictionary] = [{"point": start, "cost": 0.0, "estimate": 0.0, "path": []}]
	var visited: Dictionary = {}
	var expanded := 0
	while not open.is_empty() and expanded < 100:
		open.sort_custom(func(a, b): return a.estimate > b.estimate)
		var node: Dictionary = open.pop_back()
		expanded += 1
		var point: Vector3 = node.point
		if corridor(body, point, goal):
			var path: Array[Vector3] = []
			path.assign(node.path)
			path.append(goal)
			return path
		for y in range(-1, 2):
			for x in range(-1, 2):
				if x == 0 and y == 0:
					continue
				var next := Vector3(snappedf(point.x, 2) + x * 2, snappedf(point.y, 2) + y * 2, 0)
				if absf(next.x) > 29 or absf(next.y) > 11:
					continue
				var cost: float = node.cost + point.distance_to(next)
				var key := Vector2i(roundi(next.x / 2), roundi(next.y / 2))
				if cost >= float(visited.get(key, INF)) or not corridor(body, point, next):
					continue
				visited[key] = cost
				var path: Array = node.path.duplicate()
				path.append(next)
				open.append({"point": next, "cost": cost, "estimate": cost + next.distance_to(goal), "path": path})
	return []

func direction(body: CharacterBody3D, goal: Vector3, tick: int) -> Vector3:
	var id := body.get_instance_id()
	if not routes.has(id) or tick >= int(routes[id].next):
		routes[id] = {"path": plan(body, goal), "next": tick + 18 + id % 7}
	var path: Array = routes[id].path
	while not path.is_empty() and body.global_position.distance_to(path[0]) < 0.5:
		path.pop_front()
	if path.is_empty():
		return Vector3.ZERO
	if not corridor(body, body.global_position, path[0]):
		routes[id].next = tick
		return Vector3.ZERO
	return body.global_position.direction_to(path[0])

func forget(body: CharacterBody3D) -> void:
	routes.erase(body.get_instance_id())
