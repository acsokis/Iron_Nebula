# Browser release hardening and bounded security audit

Scope: the static WebGL browser adaptation, browser P2P admission/state transport,
phone-controller capability, local storage, dependencies and Pages artifact. This
is a source review plus automated checks; it is not a penetration-test certificate,
malware-free guarantee or proof of third-party service reliability.

## Trust boundaries and controls

| Boundary | Controls / observed implementation |
| --- | --- |
| Guest → host | Host assigns seats; clients send only bounded input. Clients cannot submit damage, purchases, credits or an arbitrary player ID. Six seats include the host. Lobby-only admission. |
| Host → guest | Protocol/build check, bounded complete state, numeric/enum/array limits before rendering, no executable state or dynamic code. |
| Data channel | WebRTC transport encryption; random room capability. Separate small-input and snapshot budgets. Replay/sequence and rate checks. |
| Large snapshots | Compact projectile records; JSON-channel-safe fragments. One bounded assembly per connection, bounded part count/length, duplicate rejection and assembly expiry. No arbitrary decompression or archive extraction. |
| Phone → local input | Separate 70-bit pairing code / peer namespace, one admitted phone, role-specific packet validation, sequence/rate checks, neutral-input deadline, explicit unpair. Phone does not become a party seat or a host authority. |
| Dead peers / rendering stalls | Independent simulation/heartbeat timers, input freshness deadline, bounded output backpressure, close handling, local-stall grace. Old callbacks cannot mutate a replaced connection. |
| Player names / errors | Length/control-character limits; dynamic text uses DOM textContent/createTextNode. No remote HTML, eval or executable URLs. |
| ICE/TURN configuration | Whitelisted STUN/TURN URL schemes and bounded fields; user-supplied credentials stay in memory. They are not embedded in QR/invite links or saved. |
| Local browser storage | Solo state and settings only. Compatibility/shape/bounds checks before use. Native Windows saves/settings are not read or modified. |
| Static content | Same-origin bundled runtime scripts/assets. CSP blocks external scripts, eval, inline handlers, objects and form submission. Referrer policy is no-referrer. No camera/microphone request. |
| Dependency/install chain | Exact direct versions, npm lock integrity/source checks, reproducible `npm ci --ignore-scripts`, advisory audit, third-party notices. |
| Build/artifact | Production build removes test mutation hooks/local signaling overrides. Safe relative paths, no symlinks, approved file types/size budget, SHA256 for assets and all release files. No maps, native executables, user saves, tokens, caches or original soundtrack. |

## Issues found and addressed during implementation

- PeerJS JSON messages above its single-message MTU closed busy rooms. Replaced
  unbounded sends with compact snapshots and bounded fragment/reassembly logic;
  tested a full six-browser combat snapshot above the original limit.
- Connection teardown could race a queued input callback and access a deleted
  peer record. Added connection identity checks and stale-callback guards.
- Coupling network liveness to animation frames caused false timeout/readiness
  behavior during rendering stalls. Separated timers, retained ready state while
  neutralizing stale movement/fire, and added local-stall liveness grace.
- Development-only test mutation hooks were explicitly checked against production
  output. The verifier fails if their marker appears in the release bundle.
- Added explicit limits for fields that could otherwise create invalid shader/UI
  state, including fractional weapon indices, non-finite coordinates, malformed
  light colors and oversized arrays.

## Automated evidence

- Pure simulation/protocol checks cover all five weapons' actual collision/damage,
  six-player independent state, all-ready campaign transitions, host-only shop
  purchases, malformed packets, replay/rate limits, chunk budgets/expiry, compact
  snapshots and invalid render values.
- Playwright executes a real WebGL 2 renderer, graphics/HDR fallback toggles,
  audio startup and input-profile switching. Gamepad identity is emulated here;
  physical vibration/trigger feel is not thereby verified.
- Phone checks use separate desktop/phone browser contexts and a real WebRTC link,
  native pointer events and explicit disconnect/release assertions. A mobile
  viewport is not a physical iOS/Android device or radio/network test.
- Six-context P2P checks use a loopback-only PeerServer and actual browser data
  channels, not a mocked connection. Software WebGL and relaxed background timer
  throttling are used only by the test harness; they are not performance evidence.
- `npm audit` checks the current known advisory database. A zero finding is not
  proof that packages, upstream code or the browser have no unknown vulnerabilities.

## Release verification

`npm run release:verify` emits `dist/release-manifest.json`, with each file's
SHA256 and explicit private-state/source-map/native-binary exclusions. Original
texture conversions are separately checked against `assets/manifest.json`.
Dependency licenses/notices are included with the static release. CI uses pinned
official actions and grants Pages write/OIDC permission only to the deploy job.

## Residual limitations / manual validation

- P2P deliberately exposes address information to peers and signaling/STUN
  services. The random code is capability admission, not verified user identity.
- A malicious admitted host can control its game world or end its own session.
  This is not a competitive anti-cheat or authoritative dedicated-server service.
- PeerJS Cloud, STUN and any configured TURN are external trust/availability
  dependencies. No public relay SLA, secret credentials or backend billing account
  is provisioned by the static game.
- GitHub Pages constrains response-header policy. A meta CSP cannot provide
  header-only policies such as `frame-ancestors`; do not claim those are enforced.
- Large hostile traffic can still consume browser/network resources before app
  validation. Caps reduce application exposure; they are not DDoS protection.
- Host migration, mid-run reconnect, cross-native/browser co-op and persistent
  party saves are not implemented. Host tab power/background throttling can affect
  simulation; keep the host foregrounded.
- Real Internet NAT/TURN paths, six physical devices, physical controller haptics,
  native HDR brightness/color accuracy and long-session/mobile thermals still need
  external/hardware testing. The HDR UI must not treat wide gamut as native HDR.
- Game artwork retains its original ownership. This audit does not certify asset
  ownership or grant redistribution rights beyond the requested project release.
