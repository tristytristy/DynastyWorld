# Premium Visual System & Motion Overhaul — Implementation Plan

**Date:** 2026-07-18 · **Spec:** user-provided 34-section "Premium Visual System and Motion Design Overhaul"
**Backup:** `D:\PROJECT\CFB27-Hub-Backups\2026-07-18_203800` (verified: DB byte-identical, 135 src files)

## Audit findings (what actually exists today)

1. **Token plumbing already built** (Phase A of the earlier UI/UX initiative): `src/design/defaultTokens.ts` → CSS custom properties applied pre-render (`applyTokens.ts`) → `tailwind.config.js` scales resolve through the variables. The Dev Mode token editor (Phase I) live-edits them. **The overhaul is therefore mostly a values-and-vocabulary upgrade on existing plumbing, not new architecture.** Current values deliberately match Tailwind defaults.
2. **The app renders square today**: `globals.css:58` forces `border-radius: 0 !important` on every button/input/`[class*='rounded']` element (the "angular global pass" of 2026-07-15). Underneath it, 107 arbitrary `rounded-[10–28px]` classes sit inert across 10 distinct values. The spec's shape language (§8: panels 10–14px, cards 8–12, buttons 6–8) means **removing the override and replacing the dead arbitrary values with a real tokenized scale.**
3. **Typography**: system-ui only; no bundled fonts; no `@font-face`; CSP is `default-src 'self'` so fonts must ship as local files. The de-facto "eyebrow" style (11px/10px + `tracking-[0.18–0.28em]` uppercase) appears 130+ / 210+ times as raw arbitrary values — this is the signature style to formalize, not invent.
4. **Motion**: no animation library; every transition is a Tailwind `transition*` utility; global reduced-motion clamp already exists and covers everything (`globals.css:90`). Motion tokens exist (150/200/300ms) but the spec wants a tighter, more mechanical scale.
5. **Components**: real shared pieces exist (`SurfaceCard`, `StatTile`, `StatisticsTable`, `StatisticsCategorySection`, `PlayerPortrait`, `CoachPortrait`, `TeamLogo`, `CoachCard`, modal family) but most page styling is inline Tailwind with the arbitrary values above. No `PageHeader` component — every page hand-rolls its header (spec §13 gap confirmed).
6. **Theming**: dark/light via `class` strategy + `ThemeProvider`; Team Mode via `--team-primary`/`--team-on-primary` (92/40 usages) set in `DynastyLayout`. Backgrounds are hand-written gradients in `globals.css`. Color usage otherwise is raw `slate-*` utilities everywhere.

## Font decisions (spec §3, licensing-safe)

- **Display — DIN direction with zero licensing risk:** `--font-display: "DIN Pro", "DIN Pro Cond", Bahnschrift, "Roboto Condensed", "Arial Narrow", sans-serif`. **Bahnschrift ships on every Windows 10/11 machine and is Microsoft's genuine licensed DIN 1451 implementation** — this app is Windows-only (electron-builder targets win only), so the DIN identity is real from day one without bundling anything. If licensed DIN Pro files are ever supplied, they drop into first position with no code change. DIN Pro is NOT bundled (commercial; spec forbids unlicensed bundling).
- **Body — Inter, bundled legally:** installed via `@fontsource/inter` (SIL OFL 1.1), woff2 subsets copied to `public/assets/fonts/`, declared with `@font-face` in `globals.css` (CSP `'self'`-compatible). Stack: `"Inter", "Segoe UI", system-ui, sans-serif`. Inter chosen over Source Sans/Plex/Public Sans for its tall x-height and tabular-numeral support (`font-feature-settings: "tnum"`) — this is a numbers-dense app.
- Two families total, per spec.

## Phase plan

### Phase 1 — Foundation (this session)
- Extend `DesignTokens` with: `fontDisplay`/`fontBody`, role-based type scale (display-xl, page-title, section-title, card-title, eyebrow, body, body-sm, meta, stat-lg/md/sm, table-header, button), surface tokens (canvas/primary/raised/interactive/overlay as bg+border pairs for both themes), retuned radius scale (sm 6px / md 10px / lg 12px / xl 14px / full), retuned shadows (3 controlled levels, less glossy), retuned motion (fast 120 / standard 180 / emphasis 260 / page 320; easing `cubic-bezier(0.2,0,0,1)` standard).
- Bundle Inter; add `@font-face`; wire `--font-display`/`--font-body` into Tailwind as `font-display`/`font-body`; keep `--font-sans` aliased to body for zero-risk continuity.
- **Remove the global `border-radius: 0 !important` override** and add semantic Tailwind utilities; migrate all 107 arbitrary `rounded-[Npx]` to the token scale (mechanical mapping: 20–28→`xl`, 14–18→`lg`, 10–12→`md`).
- Formalize the eyebrow/meta/stat styles as component classes (`@layer components`: `.type-eyebrow`, `.type-meta`, `.type-stat-*` etc.) so the 300+ arbitrary repetitions can migrate incrementally.
- Dev token editor: verify it still round-trips the extended token shape (it validates field-by-field; extending the interface must not break saved drafts).
- Verify: typecheck/lint/build + full-page screenshots (Dashboard, Coach Hub, Roster, Statistics) in both themes.

### Phase 2 — Core components
- New `PageHeader` (eyebrow/title/description/actions/tabs slots) adopted by all 12+ pages; new `Button` primitive (primary/secondary/tertiary/destructive/icon/compact) replacing per-page button styling; dedupe `EditButton` (3 copies → the `CoachCard` export, audit item); `SurfaceCard` gains surface-level prop (primary/raised/interactive/overlay); table system pass on `StatisticsTable` (header/row heights, numeric alignment via `tnum`, sticky first column, sort indicators); portrait/logo size tokens (`xs/sm/md/lg/hero`) applied through `PlayerPortrait`/`CoachPortrait`/`TeamLogo`; modal family unified on shared shell (overlay opacity, blur, width, header, motion).

### Phase 3 — Signature pages
- Coach Hub, Team Hub (DynastyOverview), Player/Recruit/Coach profile content, Statistics, Awards family. Hero treatments (editorial, portrait-dominant, no boxes behind transparent images), stat hierarchy, leader cards as the premium editorial pattern.

### Phase 4 — Data pages
- Schedule, Standings (NcaaHub), Recruiting, History, GameDetail. Density system applied (tables denser than profiles), week/conference hierarchy, user-team highlight consistency.

### Phase 5 — Theme/motion/perf audit
- Light-mode-specific pass (not inverted dark), Team Mode in both themes, reduced-motion re-verify, 1024/1400/1920 width sweep, animation cost audit (transform/opacity only, no large-list animation).

## Regression risks & mitigations
- **Radius un-flattening changes every page at once** → screenshots before/after per phase; the mechanical `rounded-[N]`→token mapping preserves relative hierarchy.
- **Dev token editor saved drafts** (localStorage) predate the extended interface → its field-validated merge keeps old drafts working; verify explicitly.
- **CSP** blocks external fonts → bundled woff2 only, no Google Fonts links.
- **Team Mode contrast** with new surfaces → Phase 5 dedicated check.
- **Portrait picker / screenshot tooling** untouched — no selector-relevant DOM changes in Phase 1.

## Out of scope (unchanged by this overhaul)
Navigation architecture, page responsibilities, data flows, IPC, database, extraction — per spec §2 ("refine and systematize what already exists").
