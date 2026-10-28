@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where dotnet >nul 2>&1
if errorlevel 1 (
 echo ERROR: .NET 8 SDK not found.
 pause
 exit /b 1
)
echo [1/2] NuGet restore...
dotnet restore IronNebula.csproj --force -r win-x64 --verbosity minimal
if errorlevel 1 goto :failed
echo [2/2] Self-contained Windows x64 publish...
dotnet publish IronNebula.csproj -c Release -r win-x64 --self-contained true --no-restore -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=none -p:DebugSymbols=false -o dist\IronNebula-win-x64
if errorlevel 1 goto :failed
echo.
echo SUCCESS: dist\IronNebula-win-x64\IronNebula.exe
echo A jatekhoz az Assets mappa is kell; a terjeszteskor tartsd egyutt az EXE-vel.
start "" "dist\IronNebula-win-x64\IronNebula.exe"
pause
exit /b 0
:failed
echo PUBLISH FAILED: ellenorizd a fenti nuget / forditasi hibakat.
pause
exit /b 1