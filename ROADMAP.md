# Iron Nebula — executive roadmap

Iron Nebula is a roguelike bullet-hell space arcade game. Releases represent complete player outcomes. Individual implementation steps belong in commits and issues.

## Current position

| Area | Implemented foundation | Remaining evidence |
|---|---|---|
| Windows | Three sectors, bosses, five weapons, upgrades, shop, saves and controller input | Clean-machine and extended gameplay validation |
| Browser | WebGL2 combat, native artwork/music, touch flight, endless orbit and GPU effects | Target-hardware measurements and current deployment verification |
| Co-op | Browser 2–6-player P2P and phone controller; separate native networking | Multi-machine Internet/NAT coverage and sustained sessions |
| Godot | Dedicated NVIDIA engine development branch | Playable migration, rendering/physics validation and feature parity |

Implementation, automated validation, physical-device tests and live multiplayer evidence are separate states. An engine source checkout is not a completed migration.

## Release milestones

| Milestone | Player outcome | Acceptance criteria |
|---|---|---|
| Alpha stabilization | Reliable desktop and browser play | Campaign/endless playthrough; saves and input regression; seamless layered backgrounds; reproducible deployment; no release-blocking defects |
| Godot migration | Playable 2.5D game ready for 3D visual models | Complete combat loop and menus; original assets; validated physics; supported-hardware RTX and tested fallback; explicit parity report |
| Connected co-op | Dependable 2–6-player online/LAN sessions | Multi-machine NAT tests; bounded network input; documented disconnect behavior; phone-controller and extended six-player tests |
| 1.0 release candidate | Complete and supportable game | Clean installation; measured performance on target hardware; asset/license and security audits; documented known limitations |

Work can proceed in parallel. Dates and release numbers are assigned when scope and acceptance evidence are concrete. Advanced rendering and haptics depend on hardware; experimental Bluetooth HD haptics stays off by default.

## Versioning policy

- Use `MAJOR.MINOR.PATCH`. Preserve published historical identifiers; do not renumber old releases.
- A minor release delivers a cohesive feature set. The next feature release after 0.9.x is **0.10.0**, once its agreed scope passes acceptance.
- A patch release is a published corrective release. Routine edits, visual tweaks, documentation and intermediate fixes do not automatically bump the product version.
- Distributed development builds use a prerelease label and commit identity, for example `0.10.0-alpha.1+<commit>`. Increment the prerelease only for a new distributed test build.
- Use `1.0.0-rc.1` for a release candidate and `1.0.0` for the accepted stable release.
- Product release, network protocol and save schema have separate compatibility contracts. Change protocol/schema identifiers only when those contracts change.
- Release notes describe shipped outcomes and breaking changes. Small implementation steps stay in Git history.

## Delivery

Edit the canonical repository directly and build through CI. Keep the working native/browser versions available while the Godot branch matures. Ship the engine migration with a parity report and known limitations. Do not use intermediate patch archives or duplicate source trees.
