# Godot NVIDIA engine preview

This branch contains an experimental playable **2.5D migration foundation**, not a replacement for the existing campaign or co-op builds. There is no new product release/version bump for this step.

## Build and run

Requires Windows, Python, Git, Visual Studio C++ tools and a Windows SDK. From the repository root:

```powershell
./Godot/Build-Engine.ps1
./.engine/godot-nvidia/bin/godot.windows.editor.x86_64.exe --path . --editor
./.engine/godot-nvidia/bin/godot.windows.editor.x86_64.exe --path .
```

The helper checks out the official NVIDIA source at the immutable revision in [engine.json](./engine.json), installs pinned SCons into a project-local virtual environment, and builds the editor. It does not install or invoke any AI service. Engine sources, intermediate objects and executables stay ignored; no source ZIP or patch workflow is used. This minimal source build omits optional AccessKit and ANGLE dependencies; it does not establish accessibility readiness for a release.

Use `--rendering-method gl_compatibility` on hardware without Forward+ support. The browser game remains the existing WebGL2 implementation; this preview does not export hardware RTX to the browser.

Import assets and run the headless movement/collision/model-slot check:

```powershell
./.engine/godot-nvidia/bin/godot.windows.editor.x86_64.exe --headless --path . --editor --import
./.engine/godot-nvidia/bin/godot.windows.editor.x86_64.exe --headless --path . --script Godot/tests/smoke.gd
```

Headless checks validate scene/script/physics behavior; they do not validate GPU rendering or physical controller input.

## What this preview implements

- Fixed narrow-perspective 3D camera framing an XY flight plane; Jolt 3D character bodies and swept physics queries for projectile hits. Perspective is required by the tested NVIDIA path tracer; flight remains planar.
- A replaceable `VisualSlot` child on each body. Textured ships/enemies use an alpha-matched metallic backing frame beneath the hull; imported GLB/glTF models replace both sprite layers. Flight, collision and muzzle nodes remain independent of the visual model.
- Shared original textures loaded directly from `Web/public/assets`. Three generated space plates scroll without mirroring. Browser/native use an edge overlap; Godot uses opaque emission-mapped periodic planes compatible with the path tracer. Scenery, physical wrecks, asteroids and a modular station occupy separate depth layers.
- A separately seeded, bounded procedural physical field with zero-gravity Jolt rigid bodies, CCD, full-volume spawn checks and destructible near-field asteroids/wrecks. Capsule-based flight navigation checks complete swept corridors and waits when blocked; players exclude one another from collision masks.
- WASD/left-stick flight, mouse/RT fire, five selectable primary weapons (`1`-`5`) with distinct cadence, damage, spread and projectile scale, default tethered mouse following, bounded GPU-instanced projectiles, enemy spawning and hit scoring. `T` toggles tethering, `Tab` previews the next sector, `Esc` exits.
- A requested-by-default NVIDIA path-tracing setting that activates only if the fork exposes the property and Vulkan reports ray-tracing pipeline support. The HUD reports the selected path. Raster mode is the fallback.

## Rendering and parity boundaries

The pinned upstream source documents `Environment.pathtracing_enabled` and `RenderingDevice.SUPPORTS_RAYTRACING_PIPELINE` (feature 12). Path tracing replaces the raster path; it is not layered on top of raster GI. The initial preview explicitly selects **no denoiser**: DLSS runtime libraries are not bundled or claimed working. Noise, material support and performance still require runtime evaluation.

“VortexGI” and “Vortex physics” have not been identified as specific compatible plugins. Jolt is the actual configured physics backend. A real 64-subdivision VoxelGI bake for the static station is included for the Forward+ raster fallback. Rebuild it with `--path . --script Godot/bake_gi.gd` using the actual GPU renderer after changing static geometry; headless dummy rendering cannot serialize useful GI texture data. RTX uses path-traced lighting instead of this raster GI. The dynamic asteroid field is not baked into the static volume.

Local validation: source-built NVIDIA engine, headless movement/collision/model replacement checks, and Vulkan Forward+ execution on an RTX 4080 with `RTX active=true`. This establishes backend activation, not a frame-rate or image-quality guarantee. DLSS denoising remains unavailable in this preview.

`-- --raster-preview` selects the VoxelGI fallback for comparison. Both modes were viewport-captured locally; the path-traced preview uses emission-mapped cutout sprite art and opaque emission background planes. The experimental fork still prints `OpTypeForwardPointer is not supported yet`; full material/denoiser parity remains outside this preview's acceptance evidence.

Campaign progression, bosses, full weapon progression and balance parity, shop/upgrades/saves, native-style menus, audio, touch/phone input, advanced haptics and network co-op are **not ported to this preview yet**. Use the existing native/browser builds for those features. See the [executive roadmap](../ROADMAP.md) for migration acceptance criteria.
