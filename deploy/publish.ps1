# Publish a new version to the update channel.
#
# Usage:
#   powershell -File deploy\publish.ps1 -Version 1.6.0
#   powershell -File deploy\publish.ps1 -Version 1.6.0 -Notes "new stickers + light theme"
#
# Steps:
#   1. take dist\QingTools-<version>-setup.exe (build with npx electron-builder --win first)
#   2. compute sha256 / size
#   3. upload to /www/wwwroot/island/update/
#   4. write latest.json (the client "check update" reads it)
#   5. verify on the server
#   6. push the same package to Upyun (the client tries the CDN first)
#   7. refresh the marketing site (qingtools.ccyyqq.com) so it serves the new manifest;
#      pass -SkipSite to skip. Forgetting this step left the site on the previous
#      version's manifest (hit on 1.9.28), so it is now part of publishing.
#   8. print the version of all three manifests (server / site / CDN) with OK/MISMATCH
# NOTE: keep this file ASCII-only so Windows PowerShell 5.1 parses it without a BOM.

param(
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$Notes = '',
  [string]$Server = 'root@81.70.254.230',
  [switch]$SkipSite
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$exe = Join-Path $root "dist\QingTools-$Version-setup.exe"
if (-not (Test-Path $exe)) {
  throw "missing $exe - build it first (npx electron-builder --win)"
}

$file = Split-Path -Leaf $exe
$size = (Get-Item $exe).Length
$hash = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLower()

$manifest = [ordered]@{
  version = $Version
  file    = $file
  size    = $size
  sha256  = $hash
  notes   = $Notes
  at      = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
}
$json = $manifest | ConvertTo-Json -Depth 4
$tmp = Join-Path $env:TEMP 'latest.json'
[IO.File]::WriteAllText($tmp, $json, (New-Object Text.UTF8Encoding($false)))

Write-Host "version $Version / $([math]::Round($size / 1MB, 1)) MB / $hash" -ForegroundColor Cyan

ssh $Server 'mkdir -p /www/wwwroot/island/update'
scp $exe ($Server + ':/www/wwwroot/island/update/' + $file)
scp $tmp ($Server + ':/www/wwwroot/island/update/latest.json')

ssh $Server 'ls -l /www/wwwroot/island/update; cat /www/wwwroot/island/update/latest.json'

# Also push the same package to Upyun (the client tries the CDN first).
# Credentials come from upyun.local.json (or ISLAND_UPYUN_JSON / ISLAND_UPYUN_FILE).
$upCfg = Join-Path $root 'upyun.local.json'
if (Test-Path $upCfg) {
  if (-not $env:ISLAND_UPYUN_FILE) { $env:ISLAND_UPYUN_FILE = $upCfg }
  try {
    node tools\upyun-publish.mjs $Version $Notes
    if ($LASTEXITCODE -ne 0) { Write-Warning 'upyun publish failed, server copy is still usable' }
  } catch {
    Write-Warning ('upyun publish error: ' + $_.Exception.Message)
  }
}

# Refresh the marketing site so its latest.json and download links point at this release.
# Without this step the site keeps serving the previous version's manifest (happened on 1.9.28).
if (-not $SkipSite) {
  Write-Host ''
  Write-Host '[site] syncing qingtools.ccyyqq.com ...' -ForegroundColor Cyan
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'site.ps1') -Server $Server
    if ($LASTEXITCODE -ne 0) { Write-Warning 'site deploy failed - run deploy\site.ps1 manually' }
  } catch {
    Write-Warning ('site deploy error: ' + $_.Exception.Message)
  }
}

# Final check: the three manifests must agree with -Version.
# The CDN copy may lag (Upyun caches latest.json for days); that is a warning, not a failure.
Write-Host ''
Write-Host '[check] manifest versions' -ForegroundColor Cyan
$manifestUrls = @(
  'https://chat.ccyyqq.com/island/update/latest.json',
  'https://qingtools.ccyyqq.com/latest.json',
  'https://qing.ccyyqq.com/island/update/latest.json'
)
foreach ($u in $manifestUrls) {
  $v = '?'
  try {
    $raw = (ssh $Server ("curl -sS --max-time 15 '" + $u + "'")) -join "`n"
    $v = ($raw | ConvertFrom-Json).version
  } catch { }
  if ($v -eq $Version) { Write-Host ("  OK        " + $v + "  " + $u) -ForegroundColor Green }
  else { Write-Host ("  MISMATCH  " + $v + "  " + $u) -ForegroundColor Yellow }
}

Write-Host ''
Write-Host 'online: https://chat.ccyyqq.com/island/update/latest.json' -ForegroundColor Green
Write-Host 'cdn   : (see node tools/upyun-publish.mjs output)' -ForegroundColor Green
Write-Host 'site  : https://qingtools.ccyyqq.com/' -ForegroundColor Green
Write-Host 'Now the installed app can see it at Settings -> Check update.' -ForegroundColor Green
