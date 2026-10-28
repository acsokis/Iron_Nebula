# IRON NEBULA – Fejlesztési dosszié

## Termék és technológia

A projekt saját fejlesztésű, Katakis-jellegű, de egyedi modern sci-fi horizontális shooter. Kizárólag **Windows natív** alkalmazás, .NET 8 és MonoGame WindowsDX; webes/HTML változat nem cél. A fejlesztés Alpha verziókon keresztül, a felhasználó folyamatos gyakorlati tesztjei alapján haladt.

## Vizuális irányok és visszajelzések

- A korai 3D-szerű sprite-kísérletek függőleges mozgásnál ugráló/fel-le bólogató hajót eredményeztek. Az irányvonal a stabil, középpont-körül döntött/roll jellegű hajómozgás lett.
- A háttér DOF-nál a nagy zavaró részecskekörök, félátlátszó szellemszerű aszteroidák és fényudvarok elutasítva. Az elfogadott Rift grafika a **0.9.2.6** mérsékelten elmosott, felismerhető roncsait használja.
- Az űrháttér legyen látványos, de ne busy; a hajók és lövedékek jól elkülönüljenek.
- GUI: csak felül kompakt HUD, nagyobb, jól olvasható menü- és shopszövegek. A felhasználó az **Alpha 0.9.2.3**-ban bevezetett valódi font-eredetű atlaszt fogadta el.
- Mindhárom pálya korábbi egyszerű 2D-s ellenségeit és bossait a **0.9.7 HD Fleet** grafikai frissítés cserélte ki.

## Fegyverek és gazdaság

- Öt primary weapon; Pulse ingyenes, a többiekhez kredit kell. Az 1–7 szintű fejlesztés minden pickupra egy szintet emel.
- Gatling: gyors, gyengébb lövedékek szintenként fejlődő hullámzó szórással.
- Beam: nyomvatartott, folyamatos pulzáló sugár, fokozatosan szélesedő és erősödő; nem hét párhuzamos sugár.
- Alapshop árai: Lance 700, Arc 1250, Gatling 1850, Beam 2600, plusz élet 950 CR.
- Sector 01 credit cap 900 CR: cél, hogy az első pálya után jellemzően csak a Lance legyen megvehető.
- Szektorvégi összesítő, ritka kreditloot, rangok és hajófejlesztések.

## Fontos hibák és javítások

- `Microsoft.Xna` / TargetFramework hiba – korai WindowsDX/.NET referenciajavítás.
- Shop `ArgumentNullException(texture)` – a Beam nem normál projectile sprite-ot használ, külön shopikon kellett.
- Boss `ArgumentOutOfRangeException RemoveAt` – a törlés közben módosuló lövedéklista indexelésének védelme.
- `NAudio` típushibák – külső függőség eltávolítása, MonoGame hangstream.
- `PickupKind` logikai `||` típushiba – enum összehasonlítás javítása.
- `pos` lokális változónév ütközés – a 0.9.11.1 fordítási javítás.
- Magyar locale szerinti ezreselválasztó kérdőjelként – támogatott formátum és fontatlasz javítása.
- `.csproj` hibás XML `&` – escape javítása.
- Enemy HP-sáv túl alacsony belső margin – célzott HP-sáv render.
- 4K választás kisebb monitoron – monitorra illesztett ablakméret, a választott logikai felbontás megőrzésével.
- Egérkövetés túl lassú – közvetlen kurzorhoz kötött hajópozíció 0.9.11.2-ben.

## Szervezés

- A játékhoz kapcsolódó változások verziónként külön forrásfájlokat és asseteket érintenek.
- A használható alap a **0.9.11.2**, korábbi patchek egymásra építésével.
- A felhasználó kifejezetten **változott fájlokat tartalmazó PATCH ZIP-eket** kér, az eredeti fájlstruktúra megtartásával.
- A projekt később GitHub repositoryban követhető, rendszeres commitokkal és teljes changeloggal.