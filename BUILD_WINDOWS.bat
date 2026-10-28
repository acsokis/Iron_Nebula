@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title IRON NEBULA Alpha 0.9.2 - Build
set "LOG=%~dp0BUILD_REPORT.txt"

>"%LOG%" echo IRON NEBULA Alpha 0.9.2 - Build report
>>"%LOG%" echo Location: %CD%
>>"%LOG%" echo.

where dotnet >nul 2>&1
if errorlevel 1 (
    echo HIBA: Nem talalhato a .NET SDK.
    echo Telepitsd a .NET 8 SDK x64 verziot: https://dotnet.microsoft.com/download/dotnet/8.0
    >>"%LOG%" echo ERROR: dotnet not found in PATH.
    pause
    exit /b 1
)

echo [1/3] .NET kornyezet ellenorzese...
dotnet --list-sdks >>"%LOG%" 2>&1
if errorlevel 1 goto :failed

echo [2/3] MonoGame NuGet csomag letoltese / visszaallitasa (net8.0-windows)...
echo Elsore internetkapcsolat szukseges.
dotnet restore IronNebula.csproj --force --no-cache --verbosity normal >>"%LOG%" 2>&1
if errorlevel 1 goto :restorefailed

echo [3/3] Windows Release forditas...
dotnet build IronNebula.csproj -c Release --no-restore --verbosity minimal >>"%LOG%" 2>&1
if errorlevel 1 goto :failed

echo.
echo SIKER: A build befejezodott. Indul a jatek...
echo Reszletes naplo: BUILD_REPORT.txt
dotnet run --project IronNebula.csproj -c Release --no-build
if errorlevel 1 goto :failed
exit /b 0

:restorefailed
echo.
echo HIBA: A MonoGame NuGet restore sikertelen. A tobbi Xna/Vector2 hiba ennek kovetkezmenye lehet.
goto :failed

:failed
echo.
echo HIBA: A build nem sikerult.
echo Nyisd meg a BUILD_REPORT.txt fajlt, es kuldd el a hibas sorokat, kulonosen a NU/NETSDK kodokat.
echo.
echo --- Last 60 lines of BUILD_REPORT.txt ---
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 60" 2>nul
pause
exit /b 1