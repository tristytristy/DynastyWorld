import { ALL_RATING_FIELDS } from '../shared/playerEditorFields';
import type { PlayerEditFields, RosterPlayer } from '../shared/types';

/**
 * A team's roster as XML — the archive's player record plus every rating.
 *
 * Two sources, because the app keeps them in two places and only one of them is
 * always available:
 *
 *   the archive  identity, position, class, overall, physicals, hometown,
 *                redshirt, NIL — captured at every sync, so it exists for every
 *                season the dynasty has ever recorded
 *   the save     the 50-odd individual ratings, which are NOT archived; the
 *                editor reads them live and so does this
 *
 * A player therefore always exports with his profile, and exports WITH ratings
 * only when the save still holds him. That gap is real — a past season's roster
 * is long gone from a current save — so it's stated in the file rather than
 * filled with zeros, which would read as a roster of terrible players.
 */

/** XML 1.0 forbids most control characters outright; strip them rather than emit a file no parser will open. */
function escapeXml(value: string): string {
  return value
    // Targeting control characters is the point: XML 1.0 cannot represent them
    // at all, escaped or otherwise, so they have to go before anything else.
    // eslint-disable-next-line no-control-regex
    .replace(new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F]', 'g'), '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, value: string | number | boolean | null, indent: string): string {
  if (value === null || value === '') return `${indent}<${name} />`;
  return `${indent}<${name}>${escapeXml(String(value))}</${name}>`;
}

/** Shared by both writers — the CSV in `rosterCsvExport.ts` renders the same material as a table. */
export interface RosterExportOptions {
  teamName: string;
  seasonYear: number;
  /** Ratings by player id — absent entries simply export without a <ratings> block. */
  ratingsByPlayer: Map<number, PlayerEditFields>;
  /** Why ratings are missing, when they are, so the file explains itself. */
  ratingsNote: string | null;
}

export function buildRosterXml(players: RosterPlayer[], options: RosterExportOptions): string {
  const { teamName, seasonYear, ratingsByPlayer, ratingsNote } = options;
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<roster');
  lines.push(`  team="${escapeXml(teamName)}"`);
  lines.push(`  season="${seasonYear}"`);
  lines.push(`  playerCount="${players.length}"`);
  lines.push(`  exportedAt="${new Date().toISOString()}"`);
  lines.push('  generator="DynastyOS">');

  if (ratingsNote) {
    lines.push(`  <!-- ${escapeXml(ratingsNote)} -->`);
  }

  for (const player of players) {
    const ratings = ratingsByPlayer.get(player.id);
    lines.push(`  <player id="${player.id}">`);
    lines.push(tag('firstName', player.firstName, '    '));
    lines.push(tag('lastName', player.lastName, '    '));
    lines.push(tag('position', player.position, '    '));
    lines.push(tag('jerseyNumber', player.jerseyNumber, '    '));
    lines.push(tag('class', player.schoolYear, '    '));
    lines.push(tag('redshirtStatus', player.redshirtStatus, '    '));
    lines.push(tag('overall', player.overallRating, '    '));
    lines.push(tag('archetype', player.archetype, '    '));
    lines.push(tag('developmentTrait', player.developmentTrait, '    '));
    lines.push(tag('heightInches', player.heightInches, '    '));
    lines.push(tag('weightPounds', player.weightPounds, '    '));
    lines.push(tag('hometown', player.hometown, '    '));
    lines.push(tag('homeState', player.homeState, '    '));
    lines.push(tag('captain', player.isCaptain, '    '));
    // Absent on rosters synced before NIL shipped — omitted rather than zeroed,
    // since 0 is a real NIL figure and "unknown" is not.
    if (typeof player.nilCompensation === 'number') {
      lines.push(tag('nilCompensationK', player.nilCompensation, '    '));
    }

    if (ratings) {
      lines.push('    <ratings>');
      for (const field of ALL_RATING_FIELDS) {
        // `ovr` is already reported as <overall> above; repeating it invites the
        // two disagreeing after an edit.
        if (field.key === 'ovr') continue;
        const value = ratings.ratings[field.key];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        lines.push(`      <${field.abbr.toLowerCase()}>${value}</${field.abbr.toLowerCase()}>`);
      }
      lines.push('    </ratings>');
    }
    lines.push('  </player>');
  }

  lines.push('</roster>');
  return lines.join('\n');
}
