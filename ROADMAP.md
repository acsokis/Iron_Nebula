# IRON NEBULA – Teljes roadmap

**Alapállapot: Alpha 0.9.11.2 (2026. október 28.)**

## Elkészült mérföldkövek

| Állapot | Fő eredmény |
|---|---|
| 0.1–0.3 | Natív Windows prototípus, első szektor, harcrendszer |
| 0.4–0.5 | HD sprite-ok, stabil roll/döntés, füst/robbanás és DOF |
| 0.6 | Öt primary weapon, stackelhető 1–7 fejlesztés |
| 0.7 | Rift szektor, HUD, kreditpickup és alapshop |
| 0.8.1 | Rift bossok, Shop 2.0 |
| 0.8.2.1 | Hangrendszer, felhasználói zene, F1 Help és hangerők |
| 0.9.0–0.9.2 | Főmenü, új GUI, tartós mentés, billentyűk és kontroller |
| 0.9.2.3–0.9.2.6 | Olvasható font, enemy HP, végleges Rift DOF |
| 0.9.3–0.9.4 | Inferno Belt három szakasz, új ellenségek és bossok |
| 0.9.5–0.9.7 | Economy 3.0, új HD bossok, stabilitás, három nehézség |
| 0.9.9 | Combat/Audio polish, New Game difficulty választó |
| 0.9.10–0.9.11.2 | Felbontások, MSAA, glow/hit effekt, egér GUI és direct mouse flight |

## Következő prioritások

### Alpha 0.9.12 – Gameplay & Input Regression
- A mouse/keyboard/controller fókuszváltás, fullscreen/ablakos mód, DPI és többmonitoros környezet alapos tesztelése.
- 16:9 / 16:10 legördülő Resolution és MSAA független beállításának regressziós tesztje.
- Bossok és szektorváltások több órás tesztje, mentés/Continue minden szektorhatáron.
- Crash log és fejlesztői FPS panel finomhangolása; megmaradt kritikus hibák javítása.

### Alpha 0.9.13 – Campaign Endgame
- Teljes kampány lezáró képernyő a három szektor után.
- Összesített score, kreditek, loot, rangok, lejátszott idő és bossstatisztika.
- New Game+ vagy újrajátszhatósági megoldás, visszaállítható állapotokkal.

### Alpha 0.9.14 – Final Visual / Audio Polish
- Végleges HD boss/ellenség sérülés- és robbanásvisszajelzések.
- Pickup és projektil olvashatóság nagy felbontáson; kontrollált glow/blur.
- Szektorváltási animációk és hangok, keverés/szintezés.
- Fontok és UI hitboxok ellenőrzése 720p–4K és 16:10 esetén.

### Beta 1.0 – Release Candidate
- Teljes Windows build és self-contained Release EXE, tiszta gépes teszttel.
- Teljes végigjátszási teszt mindhárom szektoron, mindhárom nehézségen.
- Mentésverziók, grafikus beállítások, kontroller és audio tesztek.
- Teljesítménymérés (CPU/GPU/FPS), memóriaprofil, ütközési és lövedéklisták ellenőrzése.
- Harmadik féltől származó font, zene és egyéb assetek licencellenőrzése.

## Opcionális további fejlesztések

- Sector 04: Frozen Expanse – jeges roncsmező, új bossok.
- Sector 05: Machine Citadel – idegen gépbirodalom és kampánybővítés.
- Achievementek, ranglista, szektorválasztás és statisztikák.
- Lokális felhasználói profilok, accessibility funkciók, felbontás-/DPI-tesztek.

## Kiadási szabály

A fejlesztés közvetlenül a verziózott forrásban történik. A kiadás commitból, ellenőrzött builddel és CI-folyamattal készül; köztes forráscsomagok és kézi kicsomagolási lépések nélkül.
