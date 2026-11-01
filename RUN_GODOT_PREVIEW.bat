@echo off
setlocal
cd /d "%~dp0"
set "GODOT=%~dp0.engine\godot-nvidia\bin\godot.windows.editor.x86_64.exe"
if not exist "%GODOT%" (
 echo ERROR: The pinned Godot preview engine is not built.
 echo Build it with: powershell -ExecutionPolicy Bypass -File Godot\Build-Engine.ps1
 exit /b 1
)
"%GODOT%" %*
exit /b %ERRORLEVEL%
