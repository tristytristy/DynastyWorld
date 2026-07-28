; =========================================================================
;  DynastyOS - Coach Polos add-on
;
;  A tiny companion to the full Image Data pack, for people who already have
;  the ~1 GB library installed and only need the artwork that's new in 2.0.
;  Re-downloading a gigabyte to gain 15 MB is a bad trade, so this ships the
;  coachpolos folder on its own.
;
;  It defaults to the image folder the app is ALREADY using (read from
;  HKCU\Software\CFB Dynasty Hub\AssetsPath), so the polos drop in beside the
;  existing artwork rather than creating a second library somewhere else.
;
;  Compile from the project root:
;    npm run package:polos
;  (File paths below resolve relative to this script's folder, i.e. build\.)
; =========================================================================

Unicode true
SetCompress off            ; payload is WebP - already compressed

!define APPNAME "DynastyOS Coach Polos"
!define VERSION "2.0.0"
!define REGKEY  "Software\CFB Dynasty Hub"
!define SRC     "..\public\assets"

Name "${APPNAME} ${VERSION}"
OutFile "..\release\DynastyOS Coach Polos ${VERSION}.exe"
; Fallback only - InstallDirRegKey below overrides this whenever the app has
; already recorded an image folder.
InstallDir "$DOCUMENTS\DynastyOS Assets"
InstallDirRegKey HKCU "${REGKEY}" "AssetsPath"
RequestExecutionLevel user
ShowInstDetails show
BrandingText "${APPNAME} ${VERSION}"

DirText "This adds the coach polos to your DynastyOS image folder. $\r$\nIf you already have the image data installed, this box is pre-filled with that folder — just click Install." "Image data folder"

Page directory
Page instfiles

Section "Coach Polos"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\coachpolos"

  ; Only claim the assets pointer if nothing has set it. Someone running this
  ; on a machine that already has the full library must keep pointing at that
  ; library — overwriting it here would repoint the app at a folder holding
  ; nothing but polos, and every other image would break.
  ReadRegStr $0 HKCU "${REGKEY}" "AssetsPath"
  StrCmp $0 "" 0 keep_existing
    WriteRegStr HKCU "${REGKEY}" "AssetsPath" "$INSTDIR"
    DetailPrint "No image folder was registered, so this one was set: $INSTDIR"
    DetailPrint "NOTE: install the full Image Data pack here too, or portraits and logos will be missing."
    Goto done
  keep_existing:
    DetailPrint "Using the image folder already registered: $0"
  done:

  WriteRegStr HKCU "${REGKEY}" "PolosVersion" "${VERSION}"
SectionEnd
