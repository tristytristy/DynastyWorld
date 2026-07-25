; =========================================================================
;  CFB Dynasty Hub - Image Data installer
;
;  A standalone, one-time installer for the heavy image assets (player &
;  coach portraits, team logos, trophies). Kept SEPARATE from the app so the
;  ~900 MB library is installed once and survives app updates.
;
;  It lets the user choose the folder, extracts the image pack there, and
;  records the location under HKCU\Software\CFB Dynasty Hub\AssetsPath so the
;  app auto-detects it (see src/main/assetRoot.ts). No admin required.
;
;  Compile from the project root:
;    "<electron-builder NSIS>\makensis.exe" build\assets-installer.nsi
;  (File paths below are relative to the project root, i.e. makensis' CWD.)
; =========================================================================

Unicode true
SetCompress off            ; the payload is WebP/PNG (already compressed) — skip the wasted CPU

!define APPNAME "CFB Dynasty Hub Image Data"
!define VERSION "0.6.1"
!define REGKEY  "Software\CFB Dynasty Hub"
; File paths resolve relative to THIS script's folder (build\), so go up one
; level to the project root's public\assets.
!define SRC     "..\public\assets"

Name "${APPNAME} ${VERSION}"
OutFile "..\release\CFB Dynasty Hub Image Data ${VERSION}.exe"
InstallDir "$DOCUMENTS\CFB Dynasty Hub Assets"
RequestExecutionLevel user
ShowInstDetails show
BrandingText "${APPNAME} ${VERSION}"

DirText "Choose where to install the CFB Dynasty Hub image data. Pick any folder you like $\r$\n(you can move it later and re-point the app to it). About 1 GB of free space is needed." "Image data folder"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Image Data"
  SetOutPath "$INSTDIR"
  ; Each folder is recreated under the chosen root, e.g. <root>\playerportrait\...
  File /r "${SRC}\playerportrait"
  File /r "${SRC}\coaches"
  File /r "${SRC}\3d_logos"
  File /r "${SRC}\bowlgames"
  File /r "${SRC}\awards"
  File /r "${SRC}\confchamp"
  File /r "${SRC}\playoffs"
  File /r "${SRC}\icons"
  File /r "${SRC}\helmet"
  File /r "${SRC}\jersey"

  ; Pointer the app reads to auto-detect this folder.
  WriteRegStr HKCU "${REGKEY}" "AssetsPath" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "AssetsVersion" "${VERSION}"

  WriteUninstaller "$INSTDIR\Uninstall Image Data.exe"
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR\playerportrait"
  RMDir /r "$INSTDIR\coaches"
  RMDir /r "$INSTDIR\3d_logos"
  RMDir /r "$INSTDIR\bowlgames"
  RMDir /r "$INSTDIR\awards"
  RMDir /r "$INSTDIR\confchamp"
  RMDir /r "$INSTDIR\playoffs"
  RMDir /r "$INSTDIR\icons"
  RMDir /r "$INSTDIR\helmet"
  RMDir /r "$INSTDIR\jersey"
  Delete "$INSTDIR\Uninstall Image Data.exe"
  RMDir "$INSTDIR"
  ; Only clears the pointer if it still points here (avoids nuking a re-install elsewhere).
  ReadRegStr $0 HKCU "${REGKEY}" "AssetsPath"
  StrCmp $0 "$INSTDIR" 0 +3
    DeleteRegValue HKCU "${REGKEY}" "AssetsPath"
    DeleteRegValue HKCU "${REGKEY}" "AssetsVersion"
SectionEnd
