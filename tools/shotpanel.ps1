param(
  [string]$Mode = 'panel',
  [string]$Tab = 'notes',
  [string]$Out = 'shots\panel.png',
  [string]$Port = '9222'
)
$ErrorActionPreference = 'Stop'
$env:DSH_CDP_PORT = $Port
$env:DSH_CDP_MATCH = 'index.html'

$expr = "(()=>{S.grace=Date.now()+600000;setPinned(true);setTab('" + $Tab + "');setMode('" + $Mode + "');" +
        "const r=document.getElementById('island').getBoundingClientRect();" +
        "return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()"
$raw = & node tools\cdp.mjs $expr 2>&1 | Select-String -Pattern '\{' | Select-Object -First 1
$info = $raw.ToString() | ConvertFrom-Json
Start-Sleep -Milliseconds 1200

powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\shot.ps1 -Out 'shots\_full.png' | Out-Null

$z = 1.5
$padX = 34
$padTop = 10
$padBottom = 34
$x = [int]($info.x * $z) - $padX
$y = [int]($info.y * $z) - $padTop
$w = [int]($info.w * $z) + $padX * 2
$h = [int]($info.h * $z) + $padTop + $padBottom
if ($x -lt 0) { $x = 0 }
if ($y -lt 0) { $y = 0 }

$py = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
& $py -c "from PIL import Image; im=Image.open(r'shots\_full.png'); im.crop(($x,$y,$($x+$w),$($y+$h))).save(r'$Out'); print('crop',($x,$y,$w,$h))"
Remove-Item 'shots\_full.png' -Force
"$Mode/$Tab -> $Out"
