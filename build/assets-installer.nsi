; =========================================================================
;  DynastyOS - Image Data installer
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

!define APPNAME "DynastyOS Image Data"
!define VERSION "2.0.0"
!define REGKEY  "Software\CFB Dynasty Hub"
; File paths resolve relative to THIS script's folder (build\), so go up one
; level to the project root's public\assets.
!define SRC     "..\public\assets"

Name "${APPNAME} ${VERSION}"
OutFile "..\release\DynastyOS Image Data ${VERSION}.exe"
InstallDir "$DOCUMENTS\DynastyOS Assets"
; If the app already knows an assets folder, default to THAT — so someone who
; only wants the new coach polos drops them straight into the library they
; already have instead of re-pointing the app at a second folder.
InstallDirRegKey HKCU "${REGKEY}" "AssetsPath"
RequestExecutionLevel user
ShowInstDetails show
BrandingText "${APPNAME} ${VERSION}"

DirText "Choose where to install the DynastyOS image data. $\r$\nIf you already have an image folder, this box is pre-filled with it — installing there simply adds the new artwork to what you have." "Image data folder"

; Components first, so the folder page can be skipped past quickly by someone
; who only needs the new art. The full library is ~928 MB; the coach polos are
; 1.5 MB — which is why they also ship standalone (build/polos-installer.nsi).
Page components
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

; -------------------------------------------------------------------------
; Existing users only need the polos, so the big library is its own section
; they can untick — re-extracting a gigabyte to add one folder is a bad trade.
; -------------------------------------------------------------------------
Section "Full image library (portraits, logos, trophies, helmets, jerseys)" SEC_FULL
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
SectionEnd

Section "Coach polos (new in 2.0)" SEC_POLOS
  SetOutPath "$INSTDIR"
  File /r "${SRC}\coachpolos"
SectionEnd

Section "-Finish" ; leading '-' = hidden and always run
  SetOutPath "$INSTDIR"
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
  RMDir /r "$INSTDIR\coachpolos"
  Delete "$INSTDIR\Uninstall Image Data.exe"
  RMDir "$INSTDIR"
  ; Only clears the pointer if it still points here (avoids nuking a re-install elsewhere).
  ReadRegStr $0 HKCU "${REGKEY}" "AssetsPath"
  StrCmp $0 "$INSTDIR" 0 +3
    DeleteRegValue HKCU "${REGKEY}" "AssetsPath"
    DeleteRegValue HKCU "${REGKEY}" "AssetsVersion"
SectionEnd
