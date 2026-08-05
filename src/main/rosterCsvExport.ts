import { ALL_RATING_FIELDS } from '../shared/playerEditorFields';
import type { RosterExportOptions } from './rosterXmlExport';
import type { RosterPlayer } from '../shared/types';

/**
 * The same roster as CSV — one row per player, one column per field.
 *
 * XML is the better archive format and the worse spreadsheet: Google Sheets
 * imports csv/tsv/xls/xlsx/ods and nothing else, and OpenOffice Calc only
 * recognises XML that is already SpreadsheetML or ODF, so the nested <player>
 * document opens in neither. CSV is the one shape both read without a filter
 * dialog, an add-on, or a conversion step — hence this alongside the XML rather
 * than instead of it.
 *
 * Flattening costs the nesting: <ratings> becomes fifty-odd columns on the
 * player's own row, and a player the save can no longer supply leaves them
 * empty. Empty is deliberate — 0 is a real rating and "unknown" is not, and a
 * blank cell is what a spreadsheet's own AVERAGE and charts already skip.
 *
 * Team and season ride on every row instead of sitting in a header, so several
 * exports can be stacked into one sheet and still be told apart.
 */

/**
 * RFC 4180 quoting: wrap anything holding a comma, quote, or newline, and double
 * the quotes inside. Fields go out verbatim otherwise.
 */
function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text === '') return '';
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(csvCell).join(',');
}

/** Written as an escape, not a literal: an invisible first character in a source file is a trap for the next editor. */
const BOM = '\uFEFF';

/** Ratings, minus OVR — it is already a profile column, and two of it invites the pair disagreeing. */
const RATING_COLUMNS = ALL_RATING_FIELDS.filter((field) => field.key !== 'ovr');

const PROFILE_HEADERS = [
  'Team',
  'Season',
  'Player ID',
  'First Name',
  'Last Name',
  'Position',
  'Jersey',
  'Class',
  'Redshirt Status',
  'OVR',
  'Archetype',
  'Development Trait',
  'Height (in)',
  'Weight (lb)',
  'Hometown',
  'State',
  'Captain',
  'NIL ($K)',
];

export function buildRosterCsv(players: RosterPlayer[], options: RosterExportOptions): string {
  const { teamName, seasonYear, ratingsByPlayer } = options;
  const lines: string[] = [];

  lines.push(csvRow([...PROFILE_HEADERS, ...RATING_COLUMNS.map((field) => field.abbr)]));

  for (const player of players) {
    const ratings = ratingsByPlayer.get(player.id);
    const cells: Array<string | number | boolean | null | undefined> = [
      teamName,
      seasonYear || null,
      player.id,
      player.firstName,
      player.lastName,
      player.position,
      player.jerseyNumber,
      player.schoolYear,
      player.redshirtStatus,
      player.overallRating,
      player.archetype,
      player.developmentTrait,
      player.heightInches,
      player.weightPounds,
      player.hometown,
      player.homeState,
      // TRUE/FALSE rather than true/false: both spreadsheets parse it as a real
      // boolean, so the column filters and counts instead of sorting as text.
      player.isCaptain ? 'TRUE' : 'FALSE',
      typeof player.nilCompensation === 'number' ? player.nilCompensation : null,
    ];

    for (const field of RATING_COLUMNS) {
      const value = ratings?.ratings[field.key];
      cells.push(typeof value === 'number' && Number.isFinite(value) ? value : null);
    }

    lines.push(csvRow(cells));
  }

  // CRLF and a leading BOM, which are what the desktop spreadsheets want: Calc
  // and Excel read the BOM as "this is UTF-8" and stop guessing the system
  // codepage, which is the difference between Peña and PeÃ±a. Google Sheets
  // strips it.
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
