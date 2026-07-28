' Internal helper for "Launch DynastyOS.bat" — not meant to be run directly.
' A .bat file can never hide its own console window; the only reliable way on
' Windows is to have a windowed script host (wscript.exe, unlike cscript.exe,
' has no console of its own) re-launch the .bat with a hidden window style.
Dim shell, fso, targetPath, projectRoot
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
targetPath = WScript.Arguments(0)
projectRoot = fso.GetParentFolderName(targetPath)

' Clear any stale ready-flag from a previous run BEFORE launching the
' pre-splash — otherwise pre-splash.hta's very first poll could see a leftover
' flag from last time and close itself instantly. (The .bat also does this
' later, but by then this script may have already launched the HTA.)
On Error Resume Next
fso.DeleteFile shell.ExpandEnvironmentStrings("%TEMP%") & "\dynastyos-splash-ready.flag", True
On Error Goto 0

' Fire the instant pre-splash (scripts\pre-splash.hta) right here, in parallel
' with relaunching the hidden .bat, instead of waiting for a second hidden
' cmd.exe to boot and reach its own mshta line first — every millisecond here
' is a millisecond of the user seeing literally nothing. pre-splash.hta's
' SINGLEINSTANCE="yes" means the .bat's own (now-redundant) launch of it later
' just re-activates this same window rather than opening a second one.
shell.Run """mshta.exe"" """ & projectRoot & "\scripts\pre-splash.hta""", 0, False

' The HTA's own WIDTH/HEIGHT attributes don't reliably take effect (tested —
' the host opens some other, much larger default size regardless), so this
' forces the real 868x420 bounds from the outside via the Win32 API. Also
' fire-and-forget; it polls briefly for the window to exist.
shell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & projectRoot & "\scripts\force-resize-pre-splash.ps1""", 0, False

shell.Run """" & targetPath & """ RELAUNCHED", 0, False
