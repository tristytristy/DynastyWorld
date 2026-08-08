/**
 * THE ARTWORK THAT DOES NOT SHIP INSIDE THE APP, AND HOW TO TELL IF IT IS THERE.
 *
 * DynastyOS ships slim: the folders in electron-builder.js's `MEDIA_GLOBS`
 * (portraits, logos, helmets, jerseys…) are stripped from the installer so the
 * ~928 MB library is downloaded once and survives every app update. That split
 * has a cost the app has to own — when a game patch adds artwork to one of those
 * folders, NO app update can deliver it. The user has to be told, and given the
 * file.
 *
 * ONE MANIFEST, READ BY BOTH SIDES. The main process uses `probeFiles` to decide
 * what is missing on disk; the renderer uses the copy and the URL to say so. They
 * cannot drift, because there is only one of them.
 *
 * WHY FILES ON DISK AND NOT A VERSION NUMBER. The add-on installer records
 * `PatchArtVersion` in the registry, and reading that would be less code — but it
 * would be wrong for the case that matters most. Someone who installs a future
 * full Content Library gets these portraits with no add-on and no registry key,
 * and would be nagged forever to download something they already have. The files
 * are the fact; the registry key is a side effect of one way of getting them.
 */

/** A downloadable pack of artwork that lives outside the app installer. */
export interface AssetPack {
  /** Stable id — also the localStorage key a dismissal is remembered under, so never reuse one. */
  id: string;
  label: string;
  /** One sentence: what this is, in the user's terms. */
  blurb: string;
  sizeLabel: string;
  downloadUrl: string;
  /**
   * Paths relative to the image-data root that prove the pack is installed.
   * Checked with plain existence — cheap enough to run once at launch.
   */
  probeFiles: string[];
}

/**
 * The one-time ~928 MB library. Not an add-on and never probed: its absence is
 * the whole app failing to find artwork, which `AssetGate` already handles by
 * standing in front of everything. Listed here so the download link lives beside
 * every other artwork URL rather than being buried in a component.
 */
export const CONTENT_LIBRARY = {
  label: 'DynastyOS Content Library',
  sizeLabel: '~928 MB',
  downloadUrl:
    'https://github.com/matevanz/DynastyOS-Assets/releases/download/v4.0.0/DynastyOS-ContentLibrary-v4.exe',
} as const;

/**
 * ADD-ONS, NEWEST FIRST.
 *
 * The URL is a contract with the release that hosts it: GitHub builds a download
 * link out of the tag and the asset's filename, so `<tag>/<filename>` here must
 * match the release exactly or the button 404s. Both halves are quoted in
 * docs/releases/UPDATER.md for whoever cuts the next one.
 */
export const ASSET_ADDONS: AssetPack[] = [
  {
    id: 'patch-art-2026-08-06',
    label: 'New coach portraits',
    blurb:
      "The game's 2026-08-06 update added twelve coach portraits — Belichick, Ferentz, Cristobal, Deion Sanders and eight more. They live in your image folder, so a DynastyOS update can't bring them in.",
    sizeLabel: '190 KB',
    downloadUrl:
      'https://github.com/matevanz/DynastyOS-Assets/releases/download/patch-art-2026.08.06/DynastyOS-PatchArt-2026.08.06.exe',
    /*
      The two coaches the patch INTRODUCED, not the ten it replaced. A replaced
      portrait exists either way — checking one would report "installed" for
      everybody, including the people who need this. These two files exist only
      if the new art is actually there.
    */
    probeFiles: [
      'coaches/nilcp_Unique_C_BloeschMike_919.webp',
      'coaches/nilcp_Unique_C_BrownNeal_918.webp',
    ],
  },
];
