param([int]$Jobs=8,[string]$Python='python')
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$pin=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'engine.json') -Raw | ConvertFrom-Json
$engine=Join-Path $repo '.engine/godot-nvidia'
$venv=Join-Path $repo '.engine/build-env'
function Invoke-Checked([string]$Executable,[string[]]$Arguments) {
    & $Executable @Arguments
    if($LASTEXITCODE -ne 0){throw "$Executable failed with exit code $LASTEXITCODE"}
}
if(!(Test-Path -LiteralPath $engine)){
    Invoke-Checked 'git' @('clone','--depth','1','--single-branch','--branch',$pin.branch,$pin.repository,$engine)
}
$remote=& git -C $engine remote get-url origin
if($LASTEXITCODE -ne 0 -or $remote -ne $pin.repository){throw 'Unexpected engine source origin'}
$head=& git -C $engine rev-parse HEAD
if($head -ne $pin.commit){
    $dirty=& git -C $engine status --porcelain
    if($dirty){throw 'Engine source has local changes; refusing to switch its revision'}
    Invoke-Checked 'git' @('-C',$engine,'fetch','--depth','1','origin',$pin.commit)
    Invoke-Checked 'git' @('-C',$engine,'checkout','--detach',$pin.commit)
}
if(!(Test-Path -LiteralPath $venv)){Invoke-Checked $Python @('-m','venv',$venv)}
$buildPython=Join-Path $venv 'Scripts/python.exe'
Invoke-Checked $buildPython @('-m','pip','install',('scons=='+$pin.scons))
# Keep generated dependency/build trees out of the Godot resource importer.
foreach($relative in @('Web/node_modules','Web/.browsers','Web/dist','Web/test-results','bin','obj')){
    $directory=Join-Path $repo $relative
    if(Test-Path -LiteralPath $directory){[IO.File]::WriteAllText((Join-Path $directory '.gdignore'),'')}
}
Invoke-Checked $buildPython @('-m','SCons','-C',$engine,'platform=windows','target=editor','arch=x86_64','d3d12=no','vulkan=yes','opengl3=yes','angle=no','accesskit=no','use_streamline=yes','debug_symbols=no','optimize=speed','lto=none',('-j'+[Math]::Min(32,[Math]::Max(1,$Jobs))))
Write-Output (Join-Path $engine 'bin/godot.windows.editor.x86_64.exe')
