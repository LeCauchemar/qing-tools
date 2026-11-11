param(
  [string]$Mode = 'idle',
  [string]$Tab = 'mail',
  [string]$Out = 'shots\shot.png',
  [string]$Port = '9223'
)
$ErrorActionPreference = 'Stop'
$env:DSH_CDP_PORT = $Port

$setExpr = "(()=>{S.grace=Date.now()+600000;setPinned(true);setTab('$Tab');setMode('$Mode');return 'ok'})()"
& node tools\cdp.mjs $setExpr | Out-Null
Start-Sleep -Milliseconds 1100

$expr = "(()=>{const r=document.getElementById('island').getBoundingClientRect();" +
        "return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height,sx:window.screenX,sy:window.screenY})})()"
$raw = & node tools\cdp.mjs $expr 2>&1 | Select-String -Pattern '\{' | Select-Object -First 1
$info = $raw.ToString() | ConvertFrom-Json
Start-Sleep -Milliseconds 150

powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\shot.ps1 -Out 'shots\_tmp-screen.png' | Out-Null

$z = 1.5
$pad = 40
$padTop = 14
$x = [int](($info.sx + $info.x) * $z) - $pad
$y = [int](($info.sy + $info.y) * $z) - $padTop
$w = [int]($info.w * $z) + $pad * 2
$h = [int]($info.h * $z) + $pad + $padTop

$py = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
& $py -c "from PIL import Image; im=Image.open(r'shots\_tmp-screen.png'); im.crop(($x,$y,$($x+$w),$($y+$h))).save(r'$Out'); print('crop', im.size, '->', ($w,$h))"
Remove-Item 'shots\_tmp-screen.png' -Force
"$Mode/$Tab -> $Out"

