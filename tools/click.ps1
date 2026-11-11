# 在 DIP 坐标处点击一次（用于端到端验证点击穿透）
param([int]$X, [int]$Y)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Mouse2 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
  public const uint DOWN = 0x0002, UP = 0x0004;
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(120);
    mouse_event(DOWN, 0, 0, 0, IntPtr.Zero);
    System.Threading.Thread.Sleep(40);
    mouse_event(UP, 0, 0, 0, IntPtr.Zero);
  }
}
'@
[Mouse2]::Click($X, $Y)
"clicked $X,$Y"
