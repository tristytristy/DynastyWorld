; =========================================================================
;  DynastyOS - Content Library installer
;
;  A standalone, one-time installer for the heavy artwork (player & coach
;  portraits, team logos, trophies, helmets, jerseys). Kept SEPARATE from the
;  app so the ~900 MB library is installed once and survives app updates.
;
;  NAMED FOR THE ARTIFACT, versioned by MAJOR only: the library changes when
;  artwork is added, not when the app ships a patch, so tying it to the apps
;  4.0.1s and 4.0.2s would imply re-downloading a gigabyte that did not change.
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

!define APPNAME "DynastyOS Content Library"
!define VERSION "4"
!define REGKEY  "Software\CFB Dynasty Hub"
; File paths resolve relative to THIS script's folder (build\), so go up one
; level to the project root's public\assets.
!define SRC     "..\public\assets"

Name "${APPNAME} ${VERSION}"
OutFile "..\release\DynastyOS-ContentLibrary-v${VERSION}.exe"
InstallDir "$DOCUMENTS\DynastyOS Assets"
; If the app already knows an assets folder, default to THAT — so someone who
; only wants the new coach polos drops them straight into the library they
; already have instead of re-pointing the app at a second folder.
InstallDirRegKey HKCU "${REGKEY}" "AssetsPath"
RequestExecutionLevel user
ShowInstDetails show
BrandingText "${APPNAME} ${VERSION}"

DirText "Choose where to install the DynastyOS content library. $\r$\nIf you already have one, this box is pre-filled with it — installing there simply adds the new artwork to what you have." "Content library folder"

; Components first, so the folder page can be skipped past quickly by someone
; who only needs the add-on art. The full library is ~928 MB; the coach polos are
; 1.2 MB — which is why they also ship standalone (build/polos-installer.nsi).
Page components
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

; -------------------------------------------------------------------------
; THE COMPLETE LIST, AND WHY IT IS THIS LIST.
;
; These eleven folders are exactly the ones the app serves over cfbmedia://,
; and they are exactly the ones electron-builder.js drops from the app in a
; SLIM build (its MEDIA_GLOBS). The two lists must stay identical: a folder in
; MEDIA_GLOBS but missing here ships in NEITHER artifact and renders as a
; broken image for every user.
;
; Every OTHER folder under public\assets (fonts, Logo, splash, conf, rivalry)
; is referenced by a plain relative path, travels inside the app bundle, and
; must NOT be added here.
;
; Existing users only ever need the add-on art, so the big library is its own
; section they can untick — re-extracting a gigabyte to add one folder is a bad
; trade.
; -------------------------------------------------------------------------
Section "Full content library (portraits, logos, trophies, helmets, jerseys)" SEC_FULL
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

Section "Coach polos" SEC_POLOS
  SetOutPath "$INSTDIR"
  File /r "${SRC}\coachpolos"
SectionEnd

Section "-Finish" ; leading '-' = hidden and always run
  SetOutPath "$INSTDIR"
  ; Pointer the app reads to auto-detect this folder. Written under BOTH names:
  ; the legacy "CFB Dynasty Hub" key is what assetRoot.ts has always read (and
  ; what InstallDirRegKey above pre-fills from, so it must keep being written),
  ; and the DynastyOS key matches the app's current name and is the one
  ; assetRoot.ts checks first.
  WriteRegStr HKCU "${REGKEY}" "AssetsPath" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "AssetsVersion" "${VERSION}"
  WriteRegStr HKCU "Software\DynastyOS" "AssetsPath" "$INSTDIR"
  WriteRegStr HKCU "Software\DynastyOS" "AssetsVersion" "${VERSION}"

  WriteUninstaller "$INSTDIR\Uninstall Content Library.exe"
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
  Delete "$INSTDIR\Uninstall Content Library.exe"
  ; The pre-4 installer wrote this name; delete it too so upgrading in place
  ; does not strand an uninstaller that no longer matches anything.
  Delete "$INSTDIR\Uninstall Image Data.exe"
  RMDir "$INSTDIR"
  ; Only clears a pointer if it still points here (avoids nuking a re-install elsewhere).
  ReadRegStr $0 HKCU "${REGKEY}" "AssetsPath"
  StrCmp $0 "$INSTDIR" 0 +3
    DeleteRegValue HKCU "${REGKEY}" "AssetsPath"
    DeleteRegValue HKCU "${REGKEY}" "AssetsVersion"
  ReadRegStr $1 HKCU "Software\DynastyOS" "AssetsPath"
  StrCmp $1 "$INSTDIR" 0 +3
    DeleteRegValue HKCU "Software\DynastyOS" "AssetsPath"
    DeleteRegValue HKCU "Software\DynastyOS" "AssetsVersion"
SectionEnd
