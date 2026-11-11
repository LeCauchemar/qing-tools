# Deploy the marketing site (site\ folder) to qingtools.ccyyqq.com.
#
# Usage:
#   powershell -File deploy\site.ps1
#
# Steps:
#   1. copy site\* to /www/wwwroot/qingtools.ccyyqq.com/
#   2. fix ownership (www:www)
#   3. refresh latest.json from the update channel (the page shows version/size/notes)
#   4. quick verification
# NOTE: keep this file ASCII-only so Windows PowerShell 5.1 parses it without a BOM.

param(
  [string]$Server = 'root@81.70.254.230',
  [string]$SiteDir = '/www/wwwroot/qingtools.ccyyqq.com'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'site'
if (-not (Test-Path $src)) { throw "missing $src" }
Set-Location $root

Write-Host '[site] uploading...' -ForegroundColor Cyan
ssh $Server "mkdir -p $SiteDir/assets/shots"
# every top-level page (index.html, changelog.html, ...) plus the assets folder
$pages = @(Get-ChildItem -Path $src -Filter *.html -File | ForEach-Object { $_.FullName })
$targets = $pages + @((Join-Path $src 'assets'))
scp -r $targets ($Server + ':' + $SiteDir + '/')
Write-Host ("  pages: " + (($pages | ForEach-Object { Split-Path -Leaf $_ }) -join ', '))

Write-Host '[site] fixing ownership + latest.json' -ForegroundColor Cyan
ssh $Server "chown -R www:www $SiteDir 2>/dev/null; cp -f /www/wwwroot/island/update/latest.json $SiteDir/latest.json; ls -l $SiteDir | head -8"

Write-Host '[site] verify' -ForegroundColor Cyan
$page = ssh $Server "curl -sS -o /dev/null -w '%{http_code} %{size_download}' https://qingtools.ccyyqq.com/"
$dl = ssh $Server "curl -sS -o /dev/null -w '%{http_code} %{size_download}' https://qingtools.ccyyqq.com/download/latest.json"
Write-Host "  page  : $page"
Write-Host "  latest: $dl"
Write-Host ''
Write-Host 'site : https://qingtools.ccyyqq.com/' -ForegroundColor Green
Write-Host 'file : https://qingtools.ccyyqq.com/download/QingTools-<ver>-setup.exe' -ForegroundColor Green
