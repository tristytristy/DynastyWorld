# Forces the pre-splash HTA (scripts\pre-splash.hta) to its intended 868x420
# size, centered on the primary display. Launched by hidden-relaunch.vbs
# immediately after starting mshta.exe.
#
# Exists because neither the HTA:APPLICATION WIDTH/HEIGHT attributes nor a
# script-based window.resizeTo actually took effect when tested for real —
# the HTA host opened some other, much larger default size regardless (close
# to 75% of the primary screen — IE's classic fallback for a rejected
# requested size). This resizes it from the outside via the Win32 API
# instead, which is deterministic where the HTA-internal mechanisms weren't.
#
# Uses EnumWindows + a manual title comparison rather than FindWindow —
# confirmed by direct testing that plain FindWindow(NULL, title) returns
# NULL for this specific HTA host window class even for an exact title match
# that EnumWindows finds without issue; not obviously a DPI/Unicode/ownership
# thing, just an empirical result. SetProcessDPIAware is defensive — this
# machine tested at 96 DPI / no scaling either way, but it costs nothing and
# avoids the equivalent bug on a genuinely scaled display.
#
# Matches on the HTA's window title, which is deliberately NOT "CFB Dynasty
# Hub" (the real Electron splash/main window's title) specifically so this
# can never grab and resize one of Electron's own windows in a race.

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class PreSplashWin32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    public static IntPtr FindByExactTitle(string title) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                if (sb.ToString() == title) {
                    found = hWnd;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

[PreSplashWin32]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms

$width = 868
$height = 420
$windowTitle = "DynastyOS Pre-Splash"

# mshta.exe's own startup is itself not instant — poll briefly rather than
# assuming the window already exists.
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 100; $i++) {
    $hwnd = [PreSplashWin32]::FindByExactTitle($windowTitle)
    if ($hwnd -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 20
}

if ($hwnd -ne [IntPtr]::Zero) {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $x = [int](($bounds.Width - $width) / 2)
    $y = [int](($bounds.Height - $height) / 2)
    [PreSplashWin32]::MoveWindow($hwnd, $x, $y, $width, $height, $true) | Out-Null
}
