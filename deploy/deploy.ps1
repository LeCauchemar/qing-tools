# 把 server\ 目录部署到服务器并重启服务
# 用法: pwsh -File .\deploy\deploy.ps1
param(
  [string]$HostName = '81.70.254.230',
  [string]$UserName = 'root',
  [switch]$SkipUpload
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root 'server'
$target = "$UserName@$HostName"
$remoteApp = '/www/wwwroot/island/app'

if (-not $SkipUpload) {
  Write-Host "[deploy] 准备目录 $remoteApp" -ForegroundColor Cyan
  ssh -o BatchMode=yes $target "mkdir -p /www/wwwroot/island && rm -rf $remoteApp && mkdir -p $remoteApp"

  Write-Host "[deploy] 上传文件" -ForegroundColor Cyan
  scp -o BatchMode=yes -r "$src" "$target`:/www/wwwroot/island/app"
  # scp -r 会把 server 目录本身复制成 app，这里把内容摊平
  ssh -o BatchMode=yes $target "if [ -d $remoteApp/server ]; then cp -a $remoteApp/server/. $remoteApp/ && rm -rf $remoteApp/server; fi"
}

Write-Host "[deploy] 执行安装脚本" -ForegroundColor Cyan
ssh -o BatchMode=yes $target "sed -i 's/\r$//' $remoteApp/install.sh && chmod +x $remoteApp/install.sh && bash $remoteApp/install.sh"
Write-Host "[deploy] 完成" -ForegroundColor Green
