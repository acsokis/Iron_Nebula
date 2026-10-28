@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>&1 || (echo [ERROR] Git for Windows hianyzik. & exit /b 1)
echo.
echo IRON NEBULA - feltoltes: https://github.com/vizisiklo/Iron_Nebula
echo A repository NYILVANOS. Zenei anyag es grafikai licencek ellenorzese szukseges.
echo A Propulsive Peak zenek kimaradnak a Git-feltoltesbol az .gitignore szerint.
echo.
if not exist .git (git init || exit /b 1)
git checkout -B main || exit /b 1
git remote get-url origin >nul 2>&1
if errorlevel 1 (git remote add origin https://github.com/vizisiklo/Iron_Nebula.git)
git add . || exit /b 1
git status --short
echo.
choice /M "Biztosan commitolod es feltoltod a fenti fajlokat a NYILVANOS GitHubra"
if errorlevel 2 exit /b 0
git diff --cached --quiet
if errorlevel 1 (git commit -m "Import IRON NEBULA Alpha 0.9.11.2 full source and development history" || exit /b 1)
git push -u origin main
if errorlevel 1 (
 echo [FIGYELEM] A push nem sikerult; lehet, hogy a tavoli ag mar tartalmaz commitot.
 echo Ellenorizd a tavoli repot, es vegezz kezi osszefesulest. FORCE PUSH NEM TORTENT.
 exit /b 1
)
echo GitHub feltoltes sikeres.
endlocal