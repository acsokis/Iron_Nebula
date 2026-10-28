# MonoGame / Microsoft.Xna fordítási hibák — Alpha 0.2

A működő Alpha 0.1.2-ből örökölt projekt .NET célkeretrendszere:

```xml
<TargetFramework>net8.0-windows</TargetFramework>
<PackageReference Include="MonoGame.Framework.WindowsDX" Version="3.8.6" />
```

Ez a projektben továbbra is így szerepel. Ha a Visual Studio mégis sok `Microsoft.Xna`, `Vector2` vagy `SpriteBatch` hibát jelez, **először a NuGet csomag-visszaállítását** kell ellenőrizni. Ezek többnyire egyetlen dependency/restore hiba következményei.

1. Az új `IronNebula_Alpha_0.2_Combat_Visual_Upgrade` projektmappából dolgozz. Az eredeti Alpha 0.1 vagy Alpha 0.1.1 verziót ne nyisd meg véletlenül.
2. Futtasd a `BUILD_WINDOWS.bat` fájlt. A részletes napló: `BUILD_REPORT.txt`.
3. Ha nem sikerül, zárd be a Visual Studio-t, futtasd a `CLEAN_RESTORE.bat` fájlt, utána újra `BUILD_WINDOWS.bat`.
4. Ellenőrizd, hogy a .NET 8 SDK x64 telepítve van, és a NuGet-csomagforrás (https://api.nuget.org/v3/index.json) elérhető.
5. Visual Studio-ban a `IronNebula.sln` solutiont nyisd meg, ne különálló `.cs` fájlokat.
6. Ha a probléma megmarad, küldd el a **legelső** `error NU...`, `NETSDK...`, vagy `CS...` hibát és a napló utolsó 60 sorát.

A kiinduló 0.1.2 Windows alatt a felhasználó visszajelzése szerint már működött; a cél az új Alpha 0.2 forrás friss fordításának tesztelése.