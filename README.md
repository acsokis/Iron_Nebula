# IRON NEBULA

**Browser edition 0.9.14:** a roguelike bullet-hell space arcade adaptation with
Endless Orbit, the native side-view ship/cockpit/effect/pickup artwork, scrolling
parallax backgrounds and optional default-on tethered pointer flight. Touch drag
continuously steers the ship. The original desktop soundtrack is available along
with original synthesized Atari-style effects and optional chiptune music.
About credits name both contributors and their roles. Up to six players connect over
WebRTC, phone controllers, automatic Xbox/PlayStation button icons, dynamic lighting,
2D GI, bloom, fog, smoke and synthesized chip audio. HDR lighting and experimental
HDR display output are capability-gated. See [browser setup and controls](Web/README.md)
and the [release security audit](Web/SECURITY_AUDIT.md). Browser rooms and saves are
separate from the native Windows edition. GitHub Pages deployment is included.

**[Play the browser edition](https://acsokis.github.io/Iron_Nebula/)** — published
from the contributor fork. Choose **Host wing / Join wing** for browser co-op or
**Phone pad** to pair a phone. See the browser guide for NAT/TURN and HDR limits.

Xbox and native PS5 DualSense support: see [Controller support](CONTROLLER_SUPPORT.md)
for controls, adaptive triggers, USB haptics, and validation status. Bluetooth HD
haptics is an experimental option and is **disabled by default**.

**New: playable 2–6-player Online/LAN co-op.** Open **ONLINE / LAN CO-OP** in the
main menu, host a party, then share the displayed `address:port/roomcode` with guests.
See [Co-op setup and validation](COOP_SUPPORT.md) for controls, Internet connectivity
requirements and the first-alpha limitations. Smooth mouse flight and controller
icons remain supported. Co-op does not overwrite solo saves/high scores.

**Alpha 0.9.12 — Online Co-op** · Windows desktop · C# / .NET 8 / MonoGame WindowsDX

A saját fejlesztésű, vízszintesen scrollozó sci-fi shoot ’em up játék. Három szektor, öt váltható és fejleszthető primary weapon, minibossok és főbossok, szektorvégi shop, mentés/Continue, billentyűzet-, egér- és Xbox-kompatibilis kontrollerkezelés.

> **Validation:** Windows Release build and controller/loopback checks pass. A real
> game host plus five client processes exercised six ships, all weapons, all three
> sectors and a rendered guest. Physical multi-PC Internet/LAN testing and a full
> human campaign playthrough remain pending. See [details](COOP_SUPPORT.md).

## Indítás Windowson

1. Telepítsd a **.NET 8 SDK-t**.
2. A teljes forrásprojekt gyökeréből futtasd a `BUILD_WINDOWS.bat` fájlt.
3. Kiadáshoz használd a `PUBLISH_WINDOWS.bat` parancsfájlt. Ez a self-contained x64 mappakiadást a `dist/IronNebula-win-x64/` alá teszi, ellenőrzi a szükséges képeket, SHA-256 ellenőrzőösszeget ír, és nem indítja el automatikusan a játékot. Az EXE, a függőségei és az `Assets/` együtt maradjanak.
4. A teljes runtime-képanyag és a hanganyag az `Assets/` alatt legyen. Az eredeti fejlesztő megerősítette a `Propulsive Peak` terjesztési engedélyét; az MP3 és a streamelt WAV is bekerül a Windows kiadási csomagba.

A projekt Windowsra készült; a fő projektfájl: `IronNebula.csproj`. A MonoGame-csomag a projektben rögzített verzióval áll vissza.

## Játékmenet

- **Sector 01 – Outer Frontier:** HD űrháttér, normál ellenségek, Warden miniboss, Sentinel főboss.
- **Sector 02 – The Rift:** lila–zöld űrvilág, homályos mélységi roncsok, Guardian miniboss és Colossus főboss.
- **Sector 03 – Inferno Belt:** három vörös–narancs pályaszakasz, új flotta, Inferno Guardian és Inferno Titan.
- **Primary weapons:** Pulse (alapfegyver), Lance, Arc, Gatling, Beam; fegyverfejlesztés 1–7 szintig. Az új fegyvereket kreditekért kell feloldani.
- **Gazdaság:** kreditpickupok, szektorvégi eredményösszesítő, három shopkategória, hajó- és fegyverfejlesztések; Sector 01 kreditbevételének plafonja 900 CR.
- **Nehézség:** Easy / Normal / Hard; New Game indításakor választható.
- **Kijelző:** nagy betűk, F1 Help, F10 diagnosztika, testreszabható SFX/music hangerő.
- **Megjelenítés:** 16:9 / 16:10, 720p–4K választható módok, MSAA, lövedékglow, találat utáni rövid blur/rázkódás, ablakméret monitorhoz illesztése.
- **Irányítás:** billentyűzet, egér (hajó közvetlenül a kurzornál), kontroller; a menük egérrel is használhatók.

## Projektstruktúra

```text
Source/             C# játéklogika, UI, mentés, audio, grafika
Assets/HD/          űrhajók, hátterek, sprite-ok
Assets/Rift/        Rift-szektor, DOF drifters
Assets/Inferno/     Inferno-szektor, hajók és bossok
Assets/FX/          sérülés, robbanás, fény- és harci effektek
Assets/UI/          HUD és menüelemek
Assets/Audio/       zene és hanghatások
Tools/              ellenőrző segédprogramok
BUILD_WINDOWS.bat   Windows forrásfordítás
PUBLISH_WINDOWS.bat Windows publikálás
CHANGELOG.md        változástörténet
ROADMAP.md          további terv
DEVELOPMENT_HISTORY.md teljes fejlesztési idővonal
```

## Fontos megjegyzés a zenei jogokról

A *Propulsive Peak* asztali hangsáv terjesztését az eredeti fejlesztő engedélyezte. A Windows csomag tartalmazza az MP3-forrást és a streamelt WAV-változatot.

## Dokumentáció

- [Teljes változástörténet](CHANGELOG.md)
- [Mérföldkövek és történet](DEVELOPMENT_HISTORY.md)
- [Roadmap](ROADMAP.md)

A fejlesztés közvetlenül a Git-repó forrásfájljain történik. Codexben ellenőrizhető módosításokkal, tesztekkel, commitokkal és CI-közzététellel dolgozunk; köztes forráscsomagokat nem készítünk.
