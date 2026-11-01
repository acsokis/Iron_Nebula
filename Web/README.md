# Iron Nebula Web — 0.9.14

A static **WebGL 2** browser adaptation of the current Iron Nebula project. No
native installer or game server is required for solo play. WebRTC co-op uses one
browser as the authoritative host and up to five guest browsers. The original
Windows/MonoGame build remains separate: native TCP rooms and native saves are
not compatible with browser rooms/saves.

## Play

- **Launch solo** starts a new roguelike bullet-hell space arcade run.
  Settings selects Endless Orbit (default) or the finite three-sector campaign
  before launch. Each new run has a fresh procedural seed and resets run upgrades.
  Orbit loops the sectors with stronger enemies, retaining the current run's upgrades.
  A solo browser save is kept in localStorage; Continue resumes it. Browser saves/settings never overwrite the
  Windows save files.
- **Host wing** opens a WebRTC room. Share the room code or invite link. Guests
  choose **Join wing**. The host launches once at least one guest joins.
- At the shop, the host spends team credits. Every pilot toggles **Ready** before
  advancing. Mid-run late join/reconnect and host migration are not implemented.
- Keep the host tab open and visible. Heartbeats and simulation are independent
  of drawing, but browsers can still throttle background or power-saving tabs.
- Controls: WASD/arrows or mouse flight, Space/left mouse fire, Shift/right mouse
  precision, Tab/Q previous/next unlocked weapon, 1–5 direct selection, P/Esc menu,
  O settings and C ready. Xbox/DualSense standard gamepads are supported.
- Hints and menu navigation switch to the last-used keyboard/mouse, Xbox,
  PlayStation or phone. Newly detected controllers change the visible button
  family; movement/buttons then keep the active family current.

## Phone controller

Select **Phone pad** on the game PC. Scan the QR code with a phone and open the
link. The phone page has a virtual joystick, held fire/precision, shoulder buttons,
Confirm/Back, Menu/Ready and Settings. It controls that browser's local pilot and
does not consume a co-op seat. Each guest can pair their own phone.

Pairing uses a separate random, temporary capability code and a separate WebRTC
link. Unpair invalidates the old code. Control input is neutralized after a short
input timeout; touch cancellation, page blur and disconnect release held controls.
The phone page requests no camera/microphone access; use the phone's normal camera
app only to scan the QR code. Use the deployed HTTPS URL: a localhost QR code does
not point to the game PC from another physical device.

## Graphics and sound

- Dynamic weapon/explosion/engine lighting, analytic soft shadows and bloom.
- **2D GI approximation:** low-resolution, screen-space radiance diffusion, not
  ray-traced 3D global illumination. Existing painted backgrounds remain painted.
- Moving fog/light scatter and lit smoke sprites; adjustable quality, bloom and fog.
- **HDR lighting ON/OFF** uses floating-point WebGL render targets when supported.
- **HDR display output ON/OFF** is separately feature-gated. On a secure page with
  an HDR display and compatible WebGPU canvas, an optional float bridge presents
  through `rgba16float` / extended tone mapping. This is an experimental, more
  expensive presentation path. Unsupported setups remain SDR; Display-P3 alone
  is not labeled HDR. Actual HDR luminance requires physical display validation.
- Original, synthesized Atari-inspired chip sounds, per-weapon effects, noise
  explosions, low space ambience and an original arpeggio. Audio starts after a
  user gesture; music and effects have independent volume controls. No game
  ROM samples are bundled. **Propulsive Peak**, the user-provided desktop
  soundtrack, is now available on the web at the user's explicit request and is
  the default music source. Settings can select original procedural chiptune.
  No Creative Commons or royalty-free claim is made for the desktop track.
- Browser gamepad vibration is best-effort. Native DualSense adaptive-trigger
  effects and USB actuator audio remain Windows-build features.

## P2P service / networking

The default PeerJS Cloud service performs signaling. Game/control data uses WebRTC
data channels. STUN helps establish a direct path; symmetric NATs or restrictive
networks may require a TURN relay. Optional ICE/TURN settings are entered under
Settings and kept in memory, not in invite URLs or localStorage. No TURN provider,
credentials or guaranteed relay capacity is supplied by this project.

P2P links can reveal network addresses to peers and signaling/STUN operators. A
room invite grants access to its host; share only with intended players. Phone
invites grant control of the local pilot. Transport encryption does not establish
a real-world identity for a player. A free signaling service has no project-owned
availability guarantee; surface its failures instead of pretending to connect.

Full snapshots use compact projectile records, bounded JSON fragmentation and an
adaptive 8–20 Hz send cadence. Simulation remains 60 Hz when the browser can keep
up. Outgoing backpressure drops superseded snapshots; stale input becomes neutral.
Real-world bandwidth/latency on six physical Internet connections is not yet measured.

## Develop and verify

Node 24 is used by the workflow. Dependencies are exact-pinned with a lockfile.

```powershell
cd Web
npm.cmd ci --ignore-scripts
npm.cmd test
node scripts/build-notices.mjs
npm.cmd run build
npm.cmd run release:verify
npm.cmd run dev
```

The optimized web textures are tracked. To regenerate from a complete local
Windows asset tree: `npm.cmd run assets -- ../Assets`. Never include the excluded
unapproved audio. The explicitly requested desktop track is separately hash-pinned
in `public/audio/manifest.json`. Runtime game assets must remain same-origin.

Browser checks use Playwright and a local test-only PeerServer:

```powershell
node node_modules/playwright/cli.js install chromium
npm.cmd run test:browser
```

If the shared browser cache is incomplete, set `PLAYWRIGHT_BROWSERS_PATH` to a new
project-local `.browsers` directory before installing. The test wrapper reuses that
directory when present. Test mutation hooks and local signaling overrides exist
only in Vite development mode; the release verifier rejects leaked hooks.

The checks cover the WebGL 2 runtime, lighting/HDR fallback controls, synthesized
audio startup, emulated controller icons, phone control through real WebRTC, and
six separate browser contexts exchanging movement/shots/ready state. They do not
replace physical phone/controller/HDR or cross-network testing.

## Publish with GitHub Pages

The repository workflow builds `Web/dist`, checks it and deploys that directory
using official GitHub Pages actions. Enable Pages with **GitHub Actions** as the
publishing source. The relative Vite base supports a repository subpath, and QR
and invite links derive from the currently deployed URL. No Sites hosting or
external runtime script CDN is required. Upstream publication requires the owner
to merge/enable the workflow; a contributor can publish their own fork.

See [security and release audit](SECURITY_AUDIT.md). The native game and browser
adaptation now use the same side-view player, original pickups, cockpit,
engine plume, damage layers and explosion/impact art. The browser keeps its
own responsive menu layout and WebGL postprocessing; pixel-identical output
across DirectX and browser displays has not been certified. Backgrounds use
continuous mirrored tiles with three independent parallax depths. Decorative
asteroids now use sharp source art; far/mid/near drift at 35/140/340 world units
per second. Texture-coordinate mirroring keeps enemy noses toward the player
and makes the mirrored background edges meet correctly.
The desktop background plates now use the same endless mirrored scrolling in
all three sectors. Transparent browser sprites use lossless WebP at up to 1280
pixels, preserving alpha and reducing compression fringes. Collectibles have
consistent metal-rimmed badges, a steady 108-unit size and restrained glow.
Tethered pointer flight is on by default and can be disabled in Settings.
Finger dragging captures the touch pointer and follows continuously without
page scrolling; physical iOS/Android validation remains separate from the
automated Chromium touch-event checks.

The native game and browser
adaptation share artwork and design but are not asserted to be perfectly identical
in every spawn pattern, balance value or boss phase.

## GPU rendering and GTX 10xx target

The web renderer uses WebGL 2 instanced quads for projectiles and a smoke atlas.
Billboard transforms, smoke drift/expansion, sampling and blending execute on the
GPU. Collision and multiplayer authority stay in the CPU simulation. The game is
2.5D: 2D gameplay with layered depth, parallax and GPU effects, not a full 3D model port.

Balanced is the default preset: 75% render scale, 48 visual effects, GI enabled,
soft shadows disabled. Performance uses 50%, 24 visual effects and disables GI;
High uses 100%, 100 effects and soft shadows. Presets never remove hostile bullets.
GTX 10xx is a target class, not a measured minimum or a guaranteed frame rate.
No mandatory WebGPU, compute shaders or ray tracing is used for this path.

The native Windows edition already renders its projectile/smoke sprites through
MonoGame's DirectX SpriteBatch and layered parallax. F6 toggles its DOF layer;
F7/F8 control combat/weapon effects. Physical GTX 10xx benchmarking remains pending.
