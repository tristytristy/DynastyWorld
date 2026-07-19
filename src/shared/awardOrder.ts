/**
 * The exact order the playable game presents its annual awards in, per the
 * user (verified from actually watching the in-game award ceremony) — not
 * derivable from the save data itself, which has no ordering field. Lives in
 * `shared/` (not `renderer/lib/awardFormat.ts`, where the rest of the award
 * label/formatting logic lives) because `extract-awards.ts` (main-process
 * code) also needs it, to know which `AwardType` values count as "marquee"
 * season awards versus weekly/All-American honors — importing across the
 * main/renderer boundary would break this project's established layering.
 *
 * `BEST_DEF_1` (Bronko Nagurski) is deliberately excluded: confirmed not to
 * appear as its own distinct award in-game.
 */
export const AWARD_DISPLAY_ORDER: readonly string[] = [
  'BEST_PLAYER',
  'BEST_POTY',
  'BEST_HC',
  'BEST_QB',
  'BEST_DEF_2',
  'BEST_DB',
  'BEST_RB',
  'BEST_REC',
  'BEST_DL',
  'BEST_SR_QB',
  'BEST_DE',
  'BEST_IL',
  'BEST_TE',
  'BEST_AC',
  'BEST_LB',
  'BEST_C',
  'BEST_KICK',
  'BEST_PUNT',
  'BEST_SR',
  'BEST_FRESHMAN_POTY',
  'MOST_VERSATILE',
  'BEST_ACADEMIC',
];
