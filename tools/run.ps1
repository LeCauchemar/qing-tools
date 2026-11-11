# 重启开发实例：杀掉旧的 island 进程 → 清日志 → 启动
param([switch]$KeepLog)

$root = 'D:\deepseek harness daily\dynamic-island'
$exe = Join-Path $root 'node_modules\electron\dist\electron.exe'
$log = Join-Path $env:APPDATA 'DynamicIsland\logs\main.log'

Get-CimInstance Win32_Process -Filter "Name='electron.exe'" |
  Where-Object { $_.CommandLine -like '*dynamic-island*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Milliseconds 900
if (-not $KeepLog -and (Test-Path $log)) { Remove-Item $log -Force -ErrorAction SilentlyContinue }

Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath $exe -ArgumentList '.', '--dev', '--remote-debugging-port=9222' -WorkingDirectory $root
Start-Sleep -Seconds 4
if (Test-Path $log) { Get-Content $log -Tail 6 } else { 'log not created' }
