; =========================================================================
;  DynastyOS - Patch Art add-on (game patch of 2026-08-06)
;
;  Twelve coach portraits the game's 2026-08-06 patch added or replaced. They
;  live in the image library rather than the app (coaches/ is one of the folders
;  a slim build strips), so a 4.4.0 app update alone will not bring them in.
;
;  SHIPPED ON ITS OWN, not as a rebuilt library. The full pack is ~928 MB and
;  this is 190 KB — asking every existing user to re-download a gigabyte to gain
;  twelve portraits is the trade build/polos-installer.nsi already refused to
;  make, and this follows it. New installs still need the full library first;
;  the pack should be rebuilt to fold these in whenever it is next cut.
;
;  Named files rather than the whole folder ON PURPOSE. `File /r coaches` would
;  ship all ~500 portraits, which is most of what makes the full pack big — the
;  point here is to move only what changed.
;
;  The Battle of I-75 trophy from the same patch is NOT here: rivalry art is
;  outside MEDIA_GLOBS, so it travels inside the app and already shipped in
;  4.4.0.
;
;  Defaults to the image folder the app is ALREADY using (read from
;  HKCU\Software\CFB Dynasty Hub\AssetsPath), so the portraits drop in beside
;  the existing artwork instead of creating a second library.
;
;  Compile from the project root:
;    node build/compile-assets-installer.js patch-art-installer.nsi
;  (File paths below resolve relative to this script's folder, i.e. build\.)
; =========================================================================

Unicode true
SetCompress off            ; payload is WebP - already compressed

!define APPNAME "DynastyOS Patch Art"
!define VERSION "2026.08.06"
!define REGKEY  "Software\CFB Dynasty Hub"
!define SRC     "..\public\assets"

Name "${APPNAME} ${VERSION}"
OutFile "..\release\DynastyOS-PatchArt-${VERSION}.exe"
; Fallback only - InstallDirRegKey below overrides this whenever the app has
; already recorded an image folder.
InstallDir "$DOCUMENTS\DynastyOS Assets"
InstallDirRegKey HKCU "${REGKEY}" "AssetsPath"
RequestExecutionLevel user
ShowInstDetails show
BrandingText "${APPNAME} ${VERSION}"

DirText "This adds the 2026-08-06 patch's coach portraits to your DynastyOS image folder. $\r$\nIf you already have the image data installed, this box is pre-filled with that folder — just click Install." "Image data folder"

Page directory
Page instfiles

Section "Coach portraits (2026-08-06 patch)"
  SetOutPath "$INSTDIR\coaches"

  ; Real likenesses replacing generic capped models
  File "${SRC}\coaches\nilcp_Unique_C_BelichickBill_647.webp"
  File "${SRC}\coaches\nilcp_Unique_C_FerentzKirk_551.webp"
  File "${SRC}\coaches\nilcp_Unique_C_CristobalMario_602.webp"
  File "${SRC}\coaches\nilcp_Unique_C_MendenhallBronco_791.webp"
  File "${SRC}\coaches\nilcp_Unique_C_SandersDeion_494.webp"
  File "${SRC}\coaches\nilcp_Unique_C_AndersonBlake_720.webp"
  File "${SRC}\coaches\nilcp_Unique_C_BoldenJoe_922.webp"
  File "${SRC}\coaches\nilcp_Unique_C_PetrinoNick_627.webp"
  File "${SRC}\coaches\nilcp_Unique_C_PowledgeMatt_460.webp"
  File "${SRC}\coaches\nilcp_Unique_C_ScottLD_628.webp"

  ; New coaches the patch introduced
  File "${SRC}\coaches\nilcp_Unique_C_BloeschMike_919.webp"
  File "${SRC}\coaches\nilcp_Unique_C_BrownNeal_918.webp"

  ; Only claim the assets pointer if nothing has set it. Someone running this on
  ; a machine that already has the full library must keep pointing at that
  ; library — overwriting it here would repoint the app at a folder holding
  ; nothing but twelve portraits, and every other image would break.
  ReadRegStr $0 HKCU "${REGKEY}" "AssetsPath"
  StrCmp $0 "" 0 keep_existing
    WriteRegStr HKCU "${REGKEY}" "AssetsPath" "$INSTDIR"
    DetailPrint "No image folder was registered, so this one was set: $INSTDIR"
    DetailPrint "NOTE: install the full Image Data pack here too, or portraits and logos will be missing."
    Goto done
  keep_existing:
    DetailPrint "Using the image folder already registered: $0"
  done:

  WriteRegStr HKCU "${REGKEY}" "PatchArtVersion" "${VERSION}"
SectionEnd
