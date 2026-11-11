# Package the HarmonyOS (ArkTS) source and publish it next to the Android APK.
#   server : /www/wwwroot/island/update/QingToolsSMS-harmony.zip
#   upyun  : island/update/QingToolsSMS-harmony.zip
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File deploy\upload-harmony.ps1
param(
  [string]$Server = 'root@81.70.254.230'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'mobile\harmony'
$zip  = Join-Path $root 'dist\QingToolsSMS-harmony.zip'
$name = 'QingToolsSMS-harmony.zip'

if (-not (Test-Path $src)) { throw "missing $src" }
New-Item -ItemType Directory -Force -Path (Split-Path $zip) | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip -CompressionLevel Optimal
$kb = [math]::Round((Get-Item $zip).Length / 1KB, 1)
Write-Host "zip $name $kb KB" -ForegroundColor Cyan

ssh $Server 'mkdir -p /www/wwwroot/island/update'
scp $zip ($Server + ':/www/wwwroot/island/update/' + $name)
if ($LASTEXITCODE -ne 0) { throw 'scp failed' }

$cfg = Join-Path $root 'upyun.local.json'
if (Test-Path $cfg) {
  $env:ISLAND_UPYUN_FILE = $cfg
  node (Join-Path $root 'tools\upyun-upload-one.mjs') $zip ('island/update/' + $name) 'application/zip'
  if ($LASTEXITCODE -ne 0) { Write-Warning 'upyun upload failed, server copy still works' }
} else {
  Write-Warning 'upyun.local.json not found - skipped CDN upload'
}

foreach ($u in @("https://qing.ccyyqq.com/island/update/$name", "https://qingtools.ccyyqq.com/download/$name")) {
  try {
    $r = Invoke-WebRequest -Uri $u -Method Head -UseBasicParsing -TimeoutSec 20
    Write-Host ("OK  {0}  {1} bytes" -f $r.StatusCode, $r.Headers['Content-Length']) -ForegroundColor Green
  } catch {
    Write-Warning ("check failed {0}: {1}" -f $u, $_.Exception.Message)
  }
}
