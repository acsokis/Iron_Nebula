# IRON NEBULA – GitHub feltöltés

Cél-repository: **https://github.com/vizisiklo/Iron_Nebula** (nyilvános)

Az itt mellékelt teljes forráscsomag lokálisan minden játékassetet tartalmaz. A nyilvános GitHubnál a felhasználó által adott *Propulsive Peak* hangsáv publikálási jogát ellenőrizni kell. Alapértelmezetten az alábbi ZIP-ből Git feltöltő segédscript **nem tölti fel** a hangsávot; a helyi projektfájlok megmaradnak.

## Első teljes feltöltés Windows alatt

1. A teljes forráscsomagot csomagold ki külön mappába.
2. Telepítsd a [Git for Windows](https://git-scm.com/download/win) programot, és jelentkezz be a GitHubba.
3. A mappában futtasd a `GITHUB_PUSH_WINDOWS.bat` fájlt.
4. A szkript inicializálja a helyi Gitet, és a saját `vizisiklo/Iron_Nebula` repository `main` ágára küldi a fájlokat. Ha a távoli repóban már vannak commitok, kézi összevonás lehet szükséges; a szkript **nem force-pushol**.
5. Ellenőrizd GitHubon, hogy a `Source/`, `Assets/`, `IronNebula.csproj` és dokumentáció megjelent.

## Nagy fájlok és jogok

- GitHub 100 MiB fölötti egyedi fájlokat blokkol; az aktuális projektben a legnagyobb egyedi WAV ~30 MB, de a teljes Git repository sok nagy assetet tartalmaz.
- A publikus feltöltésből a *Propulsive Peak* MP3 és WAV **alapból ki van zárva**, amíg nincs jogi visszaigazolás.
- A játék forrásból való teljes reprodukálásához a zene helyben az `Assets/Audio/` mappában szükséges, vagy alternatív licencelt zene használható.
- A felhasznált grafikai elemek és betűtípusok licenceit is ellenőrizd nyilvános terjesztés előtt.

## Későbbi verziók

A PATCH ZIP-et csomagold a saját működő munkamappádba, majd commit/push az új fájlokkal. A PATCH ZIP nem teljes projekt, ezért GitHubon célszerű a teljes aktuális forrásállapotot verziózni.