# 先悬停唤醒，再移动到目标点点击（DIP 坐标）
# 用法: powershell -File tools\click2.ps1 <hoverX> <hoverY> <clickX> <clickY>
$hx = [int]$args[0]
$hy = [int]$args[1]
$cx = [int]$args[2]
$cy = [int]$args[3]

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Mouse3 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
  public const uint DOWN = 0x0002, UP = 0x0004;
  public static void Move(int x, int y) { SetCursorPos(x, y); }
  public static void Click() {
    mouse_event(DOWN, 0, 0, 0, IntPtr.Zero);
    System.Threading.Thread.Sleep(45);
    mouse_event(UP, 0, 0, 0, IntPtr.Zero);
  }
}
'@
[Mouse3]::Move($hx, $hy)
Start-Sleep -Milliseconds 600
[Mouse3]::Move($cx, $cy)
Start-Sleep -Milliseconds 350
[Mouse3]::Click()
"hover $hx,$hy -> click $cx,$cy"
