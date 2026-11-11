param([int]$X1, [int]$Y1, [int]$X2, [int]$Y2)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class M {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  public const uint DOWN = 0x0002, UP = 0x0004;
}
"@
[M]::SetCursorPos($X1, $Y1)
Start-Sleep -Milliseconds 250
[M]::mouse_event([M]::DOWN, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 120
$steps = 18
for ($i = 1; $i -le $steps; $i++) {
  $x = [int]($X1 + ($X2 - $X1) * $i / $steps)
  $y = [int]($Y1 + ($Y2 - $Y1) * $i / $steps)
  [M]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 30
}
Start-Sleep -Milliseconds 150
[M]::mouse_event([M]::UP, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 250
"dragged $X1,$Y1 -> $X2,$Y2"
