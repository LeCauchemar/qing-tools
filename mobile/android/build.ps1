# Build Qing Tools SMS forwarder APK without Gradle.
# Pipeline: aapt2 link -> javac -> d8 -> jar (add classes.dex) -> zipalign -> apksigner
# NOTE: keep this file ASCII-only; Windows PowerShell 5.1 decodes .ps1 as ANSI and mangles UTF-8 comments.
# NOTE: d8.bat / apksigner.bat from build-tools silently do nothing in this shell, so call the jars directly.
# Native tools (aapt2 etc.) write warnings to stderr; with ErrorActionPreference=Stop
# PowerShell would abort on those. Rely on $LASTEXITCODE checks instead.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$bt = Join-Path $sdk 'build-tools\30.0.3'
$androidJar = Join-Path $sdk 'platforms\android-33\android.jar'
$javaHome = 'C:\Program Files\Java\jdk1.8.0_202'
$java = Join-Path $javaHome 'bin\java.exe'

if (!(Test-Path $androidJar)) { throw "android.jar not found: $androidJar" }
if (!(Test-Path (Join-Path $bt 'aapt2.exe'))) { throw "aapt2 not found in $bt" }

$out = Join-Path $root 'out'
$gen = Join-Path $out 'gen'
$cls = Join-Path $out 'classes'
$dex = Join-Path $out 'dex'
Remove-Item -Recurse -Force $out -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $out, $gen, $cls, $dex | Out-Null

Write-Host '[1/6] aapt2 link'
$base = Join-Path $out 'base.apk'
$aapt = Join-Path $bt 'aapt2.exe'
$linkArgs = @('link', '-o', $base, '--manifest', (Join-Path $root 'AndroidManifest.xml'),
  '-I', $androidJar, '--min-sdk-version', '23', '--target-sdk-version', '33',
  '--version-code', '4', '--version-name', '1.4', '--java', $gen)
& $aapt @linkArgs
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

Write-Host '[2/6] javac'
$sources = Get-ChildItem -Recurse (Join-Path $root 'src') -Filter *.java | ForEach-Object { $_.FullName }
$javacArgs = @('-encoding', 'UTF-8', '-source', '8', '-target', '8',
  '-bootclasspath', $androidJar, '-classpath', $androidJar, '-d', $cls) + $sources
& (Join-Path $javaHome 'bin\javac.exe') @javacArgs
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

Write-Host '[3/6] d8'
$classFiles = Get-ChildItem -Recurse $cls -Filter *.class | ForEach-Object { $_.FullName }
$d8Args = @('-cp', (Join-Path $bt 'lib\d8.jar'), 'com.android.tools.r8.D8',
  '--lib', $androidJar, '--min-api', '23', '--output', $dex) + $classFiles
& $java @d8Args
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }
if (!(Test-Path (Join-Path $dex 'classes.dex'))) { throw 'd8 produced no classes.dex' }

Write-Host '[4/6] add classes.dex to apk'
$unsigned = Join-Path $out 'unsigned.apk'
Copy-Item $base $unsigned -Force
& (Join-Path $javaHome 'bin\jar.exe') uf $unsigned -C $dex classes.dex
if ($LASTEXITCODE -ne 0) { throw 'jar failed' }

Write-Host '[5/6] zipalign'
$aligned = Join-Path $out 'aligned.apk'
& (Join-Path $bt 'zipalign.exe') -f 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

Write-Host '[6/6] sign'
$ks = Join-Path $root 'qingtools-debug.keystore'
if (!(Test-Path $ks)) {
  & (Join-Path $javaHome 'bin\keytool.exe') -genkeypair -v -keystore $ks -storepass qingtools `
    -keypass qingtools -alias qingtools -keyalg RSA -keysize 2048 -validity 10000 `
    -dname 'CN=Qing Tools, OU=Personal, O=QingTools, L=Local, ST=Local, C=CN'
}
$final = Join-Path $root 'QingToolsSMS.apk'
$signArgs = @('-jar', (Join-Path $bt 'lib\apksigner.jar'), 'sign', '--ks', $ks,
  '--ks-pass', 'pass:qingtools', '--key-pass', 'pass:qingtools', '--out', $final, $aligned)
& $java @signArgs
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }

$verifyArgs = @('-jar', (Join-Path $bt 'lib\apksigner.jar'), 'verify', '--print-certs', $final)
& $java @verifyArgs
Write-Host ''
Write-Host ('APK: ' + $final)
Write-Host ('size: ' + [math]::Round((Get-Item $final).Length / 1024, 1) + ' KB')
