# IRON NEBULA — Windows desktop Alpha 0.9.12

A Windows kiadás C# / .NET 8 / MonoGame WindowsDX alapú. A projekt három szektort,
öt primary fegyvert, mentést, shopot, kontrollerkezelést és 2–6 fős Online/LAN
kooperatív módot tartalmaz.

## Fordítás és publikálás

- Forrásfordítás: `BUILD_WINDOWS.bat`.
- Self-contained Windows x64 mappakiadás: `PUBLISH_WINDOWS.bat`.
- Kimenet: `dist/IronNebula-win-x64/`; az `IronNebula.exe`, a függőségei és az
  `Assets/` mappa együtt szükségesek.
- A publikálás ellenőrzi a kötelező artwork fájlokat, SHA-256 ellenőrzőösszeget
  készít az EXE-ről, és nem indítja el automatikusan a játékot.
- Az eredeti fejlesztő megerősítette a `Propulsive Peak` terjesztési engedélyét;
  az MP3 és a streamelt WAV is része a Windows kiadásnak.

## Automatizált ellenőrzések

```powershell
dotnet build IronNebula.csproj -c Release
dotnet run --project Tools/ControllerChecks/ControllerChecks.csproj -c Release
dotnet run --project Tools/CoopChecks/CoopChecks.csproj -c Release
dotnet run --project Tools/VisualChecks/VisualChecks.csproj -c Release
```

Ezek a tesztek nem helyettesítik a fizikai kontrolleres, tiszta gépes vagy teljes
kampánytesztet. A kooperatív teszt valós loopback TCP klienseket használ; internetes
NAT-viselkedést nem igazol.
