@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "OUTPUT=dist\IronNebula-win-x64"
where dotnet >nul 2>&1
if errorlevel 1 (
 echo ERROR: .NET 8 SDK not found.
 exit /b 1
)
if not exist "Assets\HD\outer_frontier_cinematic.png" (
 echo ERROR: Required desktop artwork is missing: Assets\HD\outer_frontier_cinematic.png
 echo Restore the complete Assets folder before publishing.
 exit /b 1
)
if not exist "Assets\ui_atlas.png" (
 echo ERROR: Required desktop artwork is missing: Assets\ui_atlas.png
 echo Restore the complete Assets folder before publishing.
 exit /b 1
)
echo [1/2] NuGet restore...
dotnet restore IronNebula.csproj --force -r win-x64 --verbosity minimal
if errorlevel 1 goto :failed
echo [2/2] Self-contained Windows x64 folder publish...
if exist "%OUTPUT%" rmdir /s /q "%OUTPUT%"
if exist "%OUTPUT%" goto :failed
dotnet publish IronNebula.csproj -c Release -r win-x64 --self-contained true --no-restore -p:DebugType=none -p:DebugSymbols=false -o "%OUTPUT%"
if errorlevel 1 goto :failed
if not exist "%OUTPUT%\IronNebula.exe" (
 echo ERROR: Published executable is missing.
 goto :failed
)
if not exist "%OUTPUT%\Assets\HD\outer_frontier_cinematic.png" (
 echo ERROR: Required published artwork is missing.
 goto :failed
)
if not exist "%OUTPUT%\Assets\ui_atlas.png" (
 echo ERROR: Required published UI artwork is missing.
 goto :failed
)
if exist "%OUTPUT%\Assets\Audio\Propulsive Peak.mp3" (
 echo ERROR: The unlicensed user-supplied soundtrack must not be published.
 goto :failed
)
if exist "%OUTPUT%\Assets\Audio\Propulsive Peak_stream.wav" (
 echo ERROR: The unlicensed user-supplied soundtrack must not be published.
 goto :failed
)
powershell -NoProfile -Command "(Get-FileHash -LiteralPath '%OUTPUT%\IronNebula.exe' -Algorithm SHA256).Hash" > "%OUTPUT%\IronNebula.exe.sha256"
if errorlevel 1 goto :failed
echo.
echo SUCCESS: dist\IronNebula-win-x64\IronNebula.exe
echo SHA-256:
type "%OUTPUT%\IronNebula.exe.sha256"
echo Keep the published Assets folder beside the executable.
exit /b 0
:failed
echo PUBLISH FAILED: ellenorizd a fenti nuget / forditasi hibakat.
exit /b 1