import type {
  AwardsOverview,
  ProgramHistoryOverview,
  ScheduleOverview,
  SeasonOverview,
} from '../shared/types';

/**
 * A self-contained, shareable "Season in Review" yearbook for ONE season:
 * a header line, a resume-tile strip, the honors won (national awards,
 * All-Americans, the Heisman, and a weekly-honor count) and the full
 * game-by-game schedule. Same dependency-free, image-free artifact philosophy
 * as the program-history export (htmlExport.ts) — one HTML file that opens in
 * any browser with no app or login.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRank(rank: number | null): string {
  return rank ? `#${rank}` : 'NR';
}

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

/** Title-case an award enum code, e.g. "MAXWELL_AWARD" -> "Maxwell Award". */
function humanizeAward(code: string): string {
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short human tier for an ALL_AM_* / All-Conference honor code. */
function allAmericanLabel(code: string): string {
  const c = code.toUpperCase();
  if (c.includes('FR')) return 'Freshman All-American';
  if (c.includes('2ND') || c.includes('SECOND')) return '2nd Team All-American';
  if (c.includes('1ST') || c.includes('FIRST')) return '1st Team All-American';
  if (c.includes('CONF')) return 'All-Conference';
  return 'All-American';
}

export function buildYearbookHtml(
  overview: SeasonOverview,
  historySeason: ProgramHistoryOverview['seasons'][number] | null,
  awards: AwardsOverview | null,
  schedule: ScheduleOverview | null,
  options: { primaryColor: string | null; secondaryColor: string | null },
): string {
  const primary = options.primaryColor ?? '#2563eb';
  const secondary = options.secondaryColor ?? '#1d4ed8';
  const generatedAt = new Date().toLocaleString();

  const coachName = overview.headCoach
    ? `${overview.headCoach.firstName} ${overview.headCoach.lastName}`.trim()
    : null;

  const badges: string[] = [];
  if (historySeason?.nationalChampion) badges.push('<span class="badge">National Champions</span>');
  if (historySeason?.conferenceChampion) badges.push('<span class="badge">Conference Champions</span>');
  if (historySeason?.playoffAppearance) badges.push('<span class="badge">Playoff</span>');
  const badgesHtml = badges.join(' ');

  const tiles = [
    { label: 'Record', value: formatRecord(overview.record.wins, overview.record.losses) },
    { label: 'Conference', value: formatRecord(overview.conferenceRecord.wins, overview.conferenceRecord.losses) },
    { label: 'Final AP', value: formatRank(overview.rankings.media) },
    { label: 'Final Coaches', value: formatRank(overview.rankings.coaches) },
    { label: 'Final CFP', value: formatRank(overview.rankings.cfp) },
    { label: 'Recruiting Class', value: formatRank(overview.recruitingClassRank) },
    { label: 'Prestige', value: overview.teamPrestige !== null ? `${overview.teamPrestige}/10` : 'NR' },
  ]
    .map(
      (t) =>
        `<div class="tile"><p class="tile-label">${escapeHtml(t.label)}</p><p class="tile-value">${escapeHtml(t.value)}</p></div>`,
    )
    .join('');

  const postseason = historySeason?.postseasonSummary ?? historySeason?.bowlAppearance ?? null;

  // HEISMAN excluded: it now travels with the marquee awards (see
  // resolveLeagueAwards) but this page gives it its own headline row below, and
  // printing both listed the same trophy twice.
  const userAwards = (awards?.leagueAwards ?? []).filter((a) => a.isUserTeam && a.awardType !== 'HEISMAN');
  const allAmericans = (awards?.honorsRoster ?? []).filter((h) => h.isUserTeam);
  const heisman = awards?.heismanWinner ?? null;
  const weeklyHonorCount = awards?.weeklyHonors.length ?? 0;

  const awardRows = userAwards
    .map(
      (a) =>
        `<div class="honor"><div><p class="honor-name">${escapeHtml(a.winnerName)}</p><p class="dim">${escapeHtml(a.position)}</p></div><p class="honor-award">${escapeHtml(humanizeAward(a.awardType))}</p></div>`,
    )
    .join('');

  const allAmRows = allAmericans
    .map(
      (h) =>
        `<div class="honor"><div><p class="honor-name">${escapeHtml(h.playerName)}</p><p class="dim">${escapeHtml(h.position)}</p></div><p class="honor-award">${escapeHtml(allAmericanLabel(h.awardType))}</p></div>`,
    )
    .join('');

  const heismanHtml = heisman
    ? `<div class="honor honor-heisman"><div><p class="honor-name">${escapeHtml(heisman.playerName)} — Heisman Trophy</p><p class="dim">${escapeHtml(heisman.position)} &middot; ${escapeHtml(heisman.teamDisplayName)}${heisman.isUserTeam ? ' &middot; YOUR PLAYER' : ''}</p></div><p class="honor-award">Heisman</p></div>`
    : '';

  const honorsBody =
    userAwards.length + allAmericans.length === 0 && !heisman
      ? '<p class="dim">No national honors recorded for this team this season.</p>'
      : `${heismanHtml}${awardRows}${allAmRows}${
          weeklyHonorCount > 0
            ? `<p class="dim" style="margin-top:0.75rem">Plus ${weeklyHonorCount} weekly honor${weeklyHonorCount === 1 ? '' : 's'} across the season.</p>`
            : ''
        }`;

  const games = (schedule?.games ?? []).filter((g) => g.week >= 0);
  const gameRows = games
    .map((g) => {
      const scored = g.teamScore !== null && g.opponentScore !== null;
      const resultCls = g.result === 'W' ? 'res-w' : g.result === 'L' ? 'res-l' : '';
      return `<tr><td class="strong">Wk ${g.week}</td><td>${g.isHome ? 'vs' : '@'} ${escapeHtml(g.opponent)}</td><td class="${resultCls}">${g.result ?? '&mdash;'}</td><td>${scored ? `${g.teamScore}-${g.opponentScore}` : '&mdash;'}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(overview.teamName)} — ${overview.seasonYear} Season in Review</title>
<style>
  :root { color-scheme: light dark; --primary: ${primary}; --secondary: ${secondary}; --bg:#f8fafc; --surface:#fff; --border:rgba(15,23,42,0.12); --text:#0f172a; --text-dim:#64748b; }
  @media (prefers-color-scheme: dark){ :root{ --bg:#0b1120; --surface:rgba(255,255,255,0.04); --border:rgba(255,255,255,0.1); --text:#f8fafc; --text-dim:#94a3b8; } }
  *{ box-sizing:border-box; } body{ margin:0; padding:2.5rem 1.5rem 4rem; background:var(--bg); color:var(--text); font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .wrap{ max-width:960px; margin:0 auto; }
  header{ border-radius:2px; padding:2rem; margin-bottom:1.5rem; background:linear-gradient(120deg,var(--primary),var(--secondary)); color:#fff; }
  header .eyebrow{ color:rgba(255,255,255,0.78); }
  header h1{ margin:0.4rem 0 0; font-size:2.1rem; letter-spacing:-0.02em; }
  header .sub{ margin:0.5rem 0 0; color:rgba(255,255,255,0.92); font-size:1rem; }
  header .generated{ margin-top:0.75rem; color:rgba(255,255,255,0.8); font-size:0.8rem; }
  header .badges{ margin-top:0.9rem; }
  .eyebrow{ margin:0; font-size:0.68rem; font-weight:600; text-transform:uppercase; letter-spacing:0.22em; color:var(--text-dim); }
  .tiles{ display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:0.75rem; margin-bottom:1.5rem; }
  .tile,section.panel{ background:var(--surface); border:1px solid var(--border); }
  .tile{ border-radius:2px; padding:1rem; } .tile-label{ margin:0; font-size:0.62rem; font-weight:600; text-transform:uppercase; letter-spacing:0.16em; color:var(--text-dim); } .tile-value{ margin:0.45rem 0 0; font-size:1.5rem; font-weight:600; }
  section.panel{ border-radius:2px; padding:1.5rem; margin-bottom:1.5rem; } section.panel h2{ margin:0.35rem 0 1rem; font-size:1.15rem; }
  .honor{ display:flex; align-items:flex-end; justify-content:space-between; gap:0.75rem; border:1px solid var(--border); border-radius:2px; background:var(--bg); padding:0.7rem 0.9rem; margin-bottom:0.5rem; }
  .honor-heisman{ border-color:rgba(217,119,6,0.45); }
  .honor-name{ margin:0; font-weight:600; } .honor-award{ margin:0; font-size:0.8rem; font-weight:600; color:var(--text-dim); text-align:right; }
  .postseason{ font-size:1rem; margin:0; }
  table{ width:100%; border-collapse:collapse; font-size:0.9rem; } th{ text-align:left; padding:0.6rem; font-size:0.62rem; font-weight:600; text-transform:uppercase; letter-spacing:0.14em; color:var(--text-dim); border-bottom:1px solid var(--border); } td{ padding:0.6rem; border-bottom:1px solid var(--border); } td.strong{ font-weight:600; } .res-w{ color:#16a34a; font-weight:700; } .res-l{ color:#dc2626; font-weight:700; }
  .badge{ display:inline-block; border-radius:2px; padding:0.25rem 0.7rem; font-size:0.64rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; margin-right:0.35rem; background:rgba(255,255,255,0.2); color:#fff; }
  .dim{ color:var(--text-dim); font-size:0.85rem; } .table-scroll{ overflow-x:auto; }
  footer{ text-align:center; color:var(--text-dim); font-size:0.75rem; margin-top:2rem; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">Season in Review</p>
      <h1>${overview.seasonYear} ${escapeHtml(overview.teamName)}</h1>
      <p class="sub">${coachName ? `${escapeHtml(coachName)} &middot; ` : ''}${formatRecord(overview.record.wins, overview.record.losses)} (${formatRecord(overview.conferenceRecord.wins, overview.conferenceRecord.losses)} conf)</p>
      ${badgesHtml ? `<div class="badges">${badgesHtml}</div>` : ''}
      <p class="generated">Exported from DynastyOS on ${escapeHtml(generatedAt)}</p>
    </header>

    <div class="tiles">${tiles}</div>

    ${postseason ? `<section class="panel"><p class="eyebrow">Postseason</p><p class="postseason">${escapeHtml(postseason)}</p></section>` : ''}

    <section class="panel">
      <p class="eyebrow">Honors</p>
      <h2>The stars of the season.</h2>
      ${honorsBody}
    </section>

    <section class="panel">
      <p class="eyebrow">The Season</p>
      <h2>Game by game.</h2>
      ${gameRows ? `<div class="table-scroll"><table><thead><tr><th>Week</th><th>Matchup</th><th>Result</th><th>Score</th></tr></thead><tbody>${gameRows}</tbody></table></div>` : '<p class="dim">No schedule captured for this season.</p>'}
    </section>

    <footer>Generated by DynastyOS — a local-first EA Sports College Football 27 dynasty tracker.</footer>
  </div>
</body>
</html>`;
}
