/**
 * Dropdown option lists for the player/recruit editor's enum fields. Values are
 * the save's real enum members (pulled directly from each field's schema enum,
 * not guessed — sentinel members like First_/Last_/Count_/Invalid are dropped);
 * labels are humanized for display. An unknown current value is still shown via
 * the editor's fallback option so nothing is ever silently changed.
 */
import { DEALBREAKER_LABELS, IDEAL_PITCH_LABELS } from '../../shared/recruitPreferences';

export interface EnumOption {
  value: string;
  label: string;
}

/** College development traits (the four CFB uses). */
export const TRAIT_DEV_OPTIONS: EnumOption[] = [
  { value: 'Normal', label: 'Normal' },
  { value: 'College_Impact', label: 'Impact' },
  { value: 'College_Star', label: 'Star' },
  { value: 'College_Elite', label: 'Elite' },
];

export const PERSONALITY_OPTIONS: EnumOption[] = [
  { value: 'Leader', label: 'Leader' },
  { value: 'Intense', label: 'Intense' },
  { value: 'Entertainer', label: 'Entertainer' },
  { value: 'TeamPlayer', label: 'Team Player' },
  { value: 'Unpredictable', label: 'Unpredictable' },
];

export const ROLE_OPTIONS: EnumOption[] = [
  { value: 'NoRole', label: 'None' },
  { value: 'BridgeQB', label: 'Bridge QB' },
  { value: 'MentorQB', label: 'Mentor QB' },
  { value: 'FranchiseQB', label: 'Franchise QB' },
  { value: 'QBofTheFuture', label: 'QB of the Future' },
  { value: 'DualThreat', label: 'Dual Threat' },
  { value: 'FeatureBack', label: 'Feature Back' },
  { value: 'DeepThreat', label: 'Deep Threat' },
  { value: 'ElitePassRusher', label: 'Elite Pass Rusher' },
  { value: 'ShutdownCorner', label: 'Shutdown Corner' },
  { value: 'Playmaker', label: 'Playmaker' },
  { value: 'AllPro', label: 'All-Pro' },
  { value: 'FutureStar', label: 'Future Star' },
  { value: 'GenerationalTalent', label: 'Generational Talent' },
  { value: 'FutureHallofFame', label: 'Future Hall of Fame' },
  { value: 'Underachiever', label: 'Underachiever' },
  { value: 'InjuryProne', label: 'Injury Prone' },
  { value: 'FumbleProne', label: 'Fumble Prone' },
  { value: 'ContractExpiring', label: 'Contract Expiring' },
];

/** Schemes, grouped so the dropdown can render Offense / Defense optgroups. */
export const SCHEME_OFFENSE_OPTIONS: EnumOption[] = [
  { value: 'OFF_PRO_STYLE', label: 'Pro Style' },
  { value: 'OFF_WEST_COAST_ZONE_RUN', label: 'West Coast Zone Run' },
  { value: 'OFF_MULTIPLE_OFFENSE', label: 'Multiple Offense' },
  { value: 'OFF_SPREAD', label: 'Spread' },
  { value: 'OFF_SPREAD_OPTION', label: 'Spread Option' },
  { value: 'OFF_POWER_SPREAD', label: 'Power Spread' },
  { value: 'OFF_AIR_RAID', label: 'Air Raid' },
  { value: 'OFF_RUN_AND_SHOOT', label: 'Run and Shoot' },
  { value: 'OFF_VEER_AND_SHOOT', label: 'Veer and Shoot' },
  { value: 'OFF_PISTOL', label: 'Pistol' },
  { value: 'OFF_OPTION', label: 'Option' },
];
export const SCHEME_DEFENSE_OPTIONS: EnumOption[] = [
  { value: 'DEF_BASE4_3', label: 'Base 4-3' },
  { value: 'DEF_BASE3_4', label: 'Base 3-4' },
  { value: 'DEF_4_2_5', label: '4-2-5' },
  { value: 'DEF_3_3_5', label: '3-3-5' },
  { value: 'DEF_3_3_5_TITE', label: '3-3-5 Tite' },
  { value: 'DEF_3_2_6', label: '3-2-6' },
  { value: 'DEF_MULTIPLE_DEFENSE', label: 'Multiple Defense' },
  { value: 'DEF_4_3_MULTIPLE', label: '4-3 Multiple' },
  { value: 'DEF_3_4_MULTIPLE', label: '3-4 Multiple' },
];

/**
 * Both recruit-preference lists are DERIVED from the shared wording maps rather
 * than written out here. They used to be a hand-kept copy, and the National
 * Recruits page labelled the same enums through a camelCase splitter instead —
 * so the two surfaces disagreed on seven values ("Coachs Favorite" vs "Coach's
 * Favorite", "TVTime" vs "TV Time"). One source means that cannot recur.
 *
 * Order follows the maps, which are alphabetical by enum member; `Invalid` is
 * absent from both by design — it is the game's "not revealed yet" sentinel,
 * not something to offer as a choice.
 */
const toOptions = (labels: Readonly<Record<string, string>>): EnumOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const DEALBREAKER_OPTIONS: EnumOption[] = toOptions(DEALBREAKER_LABELS);

export const IDEAL_PITCH_OPTIONS: EnumOption[] = toOptions(IDEAL_PITCH_LABELS);
