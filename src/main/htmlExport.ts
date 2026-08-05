import { formatKnownRecord } from '../shared/programHistory';
import type { ProgramHistoryOverview, ProgramHistoryRecordHolder } from '../shared/types';

/**
 * Phase 11 first slice: exports the same data already surfaced on the
 * Program History page (school record book, dynasty resume, coaching
 * ledger, season timeline, milestones) as one self-contained offline HTML
 * file. Deliberately no team logos/images (keeps the file a single
 * dependency-free artifact), no multi-page archive, and no interactive
 * charts — those are real Phase 11 features, just not this pass's scope.
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

function formatRecordValue(value: number, key: string): string {
  return key === 'defensiveSacks' ? value.toFixed(value % 1 === 0 ? 0 : 1) : String(value);
}

function recordHolderHtml(label: string, holder: ProgramHistoryRecordHolder | null, key: string): string {
  if (!holder) {
    return `
      <div class="record-line">
        <p class="record-line-label">${escapeHtml(label)}</p>
        <p class="record-line-empty">No record available.</p>
      </div>`;
  }
  return `
    <div class="record-line">
      <p class="record-line-label">${escapeHtml(label)}</p>
      <div class="record-line-body">
        <div>
          <p class="record-line-name">${escapeHtml(holder.playerName)}</p>
          <p class="record-line-meta">${escapeHtml(holder.position)} | ${holder.seasonYear}</p>
        </div>
        <p class="record-line-value">${escapeHtml(formatRecordValue(holder.value, key))}</p>
      </div>
    </div>`;
}

function honorsBadges(entry: ProgramHistoryOverview['seasons'][number]): string {
  const badges: string[] = [];
  if (entry.nationalChampion) badges.push('<span class="badge badge-gold">National Champs</span>');
  if (entry.conferenceChampion) badges.push('<span class="badge badge-blue">Conference Champs</span>');
  if (entry.playoffAppearance) badges.push('<span class="badge badge-green">Playoff</span>');
  return badges.length > 0 ? badges.join(' ') : '<span class="dim">-</span>';
}

export function buildHistoryExportHtml(
  history: ProgramHistoryOverview,
  options: { primaryColor: string | null; secondaryColor: string | null },
): string {
  const primary = options.primaryColor ?? '#2563eb';
  const secondary = options.secondaryColor ?? '#1d4ed8';
  const generatedAt = new Date().toLocaleString();

  const resumeTiles = [
    { label: 'Dynasty Record', value: formatRecord(history.dynastyWins, history.dynastyLosses) },
    { label: 'Dynasty Conf Titles', value: String(history.dynastyConferenceTitles) },
    { label: 'Dynasty Playoff Trips', value: String(history.dynastyPlayoffAppearances) },
    { label: 'Dynasty Nat Titles', value: String(history.dynastyNationalTitles) },
    { label: 'Dynasty Bowl Wins', value: String(history.dynastyBowlWins) },
    { label: 'Bowl Appearances', value: String(history.dynastyBowlAppearances) },
    { label: '10-Win Seasons', value: String(history.dynastyTenWinSeasons) },
    { label: 'Undefeated Seasons', value: String(history.dynastyUndefeatedSeasons) },
    { label: 'Best AP Finish', value: formatRank(history.bestMediaRank) },
  ]
    .map((tile) => `
      <div class="tile">
        <p class="tile-label">${escapeHtml(tile.label)}</p>
        <p class="tile-value">${escapeHtml(tile.value)}</p>
      </div>`)
    .join('');

  const recordCards = history.records
    .map(
      (category) => `
      <div class="card">
        <p class="eyebrow">School Record Book</p>
        <h3>${escapeHtml(category.label)}</h3>
        ${recordHolderHtml('Career', category.careerRecord, category.key)}
        ${recordHolderHtml('Season', category.seasonRecord, category.key)}
        ${recordHolderHtml('Game', category.gameRecord, category.key)}
      </div>`,
    )
    .join('');

  const coachRows = history.coaches.length
    ? history.coaches
        .map(
          (coach) => `
      <div class="coach-row">
        <div>
          <p class="coach-name">${escapeHtml(coach.coachName)}</p>
          <p class="dim">${coach.seasons} season${coach.seasons === 1 ? '' : 's'} coached</p>
        </div>
        <p class="coach-record">${formatRecord(coach.wins, coach.losses)}</p>
      </div>
      <div class="coach-meta">
        <span>Conference titles: ${coach.conferenceTitles}</span>
        <span>National titles: ${coach.nationalTitles}</span>
        <span>Playoff seasons: ${coach.playoffAppearances}</span>
        <span>10-win seasons: ${coach.tenWinSeasons}</span>
      </div>`,
        )
        .join('')
    : '<p class="dim">No coaching history available yet.</p>';

  const timelineRows = history.seasons
    .map(
      (season) => `
      <tr>
        <td class="strong">${season.seasonYear}</td>
        <td>${formatKnownRecord(season.wins, season.losses)}</td>
        <td>${formatKnownRecord(season.conferenceWins, season.conferenceLosses)}</td>
        <td>${escapeHtml(season.headCoachName ?? 'Unknown')}</td>
        <td>${formatRank(season.mediaRank)}</td>
        <td>${formatRank(season.coachesRank)}</td>
        <td>${formatRank(season.cfpRank)}</td>
        <td>${escapeHtml(season.postseasonSummary ?? season.bowlAppearance ?? 'No postseason game imported')}</td>
        <td>${honorsBadges(season)}</td>
      </tr>`,
    )
    .join('');

  const milestoneRows = history.milestones.length
    ? history.milestones
        .map(
          (milestone) => `
      <div class="milestone">
        <div class="milestone-head">
          <p class="strong">${escapeHtml(milestone.label)}</p>
          <span class="dim">${milestone.seasonYear}</span>
        </div>
        <p class="milestone-detail">${escapeHtml(milestone.detail)}</p>
      </div>`,
        )
        .join('')
    : '<p class="dim">No major milestones logged yet.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(history.teamName)} — Program History</title>
<style>
  :root {
    color-scheme: light dark;
    --primary: ${primary};
    --secondary: ${secondary};
    --bg: #f8fafc;
    --surface: #ffffff;
    --border: rgba(15, 23, 42, 0.12);
    --text: #0f172a;
    --text-dim: #64748b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b1120;
      --surface: rgba(255, 255, 255, 0.04);
      --border: rgba(255, 255, 255, 0.1);
      --text: #f8fafc;
      --text-dim: #94a3b8;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2.5rem 1.5rem 4rem;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  .wrap { max-width: 1100px; margin: 0 auto; }
  header {
    border-radius: 2px;
    padding: 2rem;
    margin-bottom: 1.5rem;
    background: linear-gradient(120deg, var(--primary), var(--secondary));
    color: #fff;
  }
  header p.eyebrow { color: rgba(255,255,255,0.75); }
  header h1 { margin: 0.4rem 0 0; font-size: 2rem; letter-spacing: -0.02em; }
  header p.generated { margin-top: 0.75rem; color: rgba(255,255,255,0.8); font-size: 0.85rem; }
  .eyebrow {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: var(--text-dim);
  }
  .notice {
    border: 1px solid rgba(217, 119, 6, 0.35);
    background: rgba(217, 119, 6, 0.1);
    color: #92400e;
    border-radius: 2px;
    padding: 0.9rem 1.1rem;
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }
  @media (prefers-color-scheme: dark) { .notice { color: #fcd34d; } }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .tile, .card, section.panel, .coach-row, .coach-meta, .milestone {
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .tile { border-radius: 2px; padding: 1rem; }
  .tile-label { margin: 0; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.18em; color: var(--text-dim); }
  .tile-value { margin: 0.5rem 0 0; font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; }
  section.panel { border-radius: 2px; padding: 1.5rem; margin-bottom: 1.5rem; }
  section.panel h2 { margin: 0.35rem 0 1rem; font-size: 1.15rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
  .card { border-radius: 2px; padding: 1.1rem; }
  .card h3 { margin: 0.35rem 0 0.9rem; font-size: 1rem; }
  .record-line { border-radius: 2px; background: var(--bg); border: 1px solid var(--border); padding: 0.75rem 0.9rem; margin-bottom: 0.6rem; }
  .record-line:last-child { margin-bottom: 0; }
  .record-line-label { margin: 0 0 0.4rem; font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.18em; color: var(--text-dim); }
  .record-line-empty { margin: 0; font-size: 0.85rem; color: var(--text-dim); }
  .record-line-body { display: flex; align-items: flex-end; justify-content: space-between; gap: 0.75rem; }
  .record-line-name { margin: 0; font-weight: 600; }
  .record-line-meta { margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--text-dim); }
  .record-line-value { margin: 0; font-size: 1.3rem; font-weight: 600; }
  .coach-row { border-radius: 2px 2px 0 0; border-bottom: none; padding: 0.9rem 1rem 0.6rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
  .coach-row + .coach-meta { border-radius: 0 0 2px 2px; border-top: none; }
  .coach-meta { padding: 0 1rem 0.9rem; margin-bottom: 0.75rem; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.3rem; font-size: 0.75rem; color: var(--text-dim); }
  .coach-name { margin: 0; font-weight: 600; }
  .coach-record { margin: 0; font-size: 1.1rem; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; padding: 0.7rem 0.6rem; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-dim); border-bottom: 1px solid var(--border); }
  td { padding: 0.7rem 0.6rem; border-bottom: 1px solid var(--border); }
  td.strong { font-weight: 600; }
  .badge { display: inline-block; border-radius: 2px; padding: 0.2rem 0.6rem; font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; margin-right: 0.3rem; }
  .badge-gold { background: rgba(217, 119, 6, 0.15); color: #92400e; }
  .badge-blue { background: rgba(14, 165, 233, 0.15); color: #075985; }
  .badge-green { background: rgba(16, 185, 129, 0.15); color: #065f46; }
  @media (prefers-color-scheme: dark) {
    .badge-gold { color: #fcd34d; }
    .badge-blue { color: #7dd3fc; }
    .badge-green { color: #6ee7b7; }
  }
  .milestone { border-radius: 2px; padding: 0.9rem 1rem; margin-bottom: 0.6rem; }
  .milestone:last-child { margin-bottom: 0; }
  .milestone-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .milestone-detail { margin: 0.4rem 0 0; font-size: 0.85rem; color: var(--text-dim); }
  .dim { color: var(--text-dim); font-size: 0.85rem; }
  .strong { font-weight: 600; }
  .table-scroll { overflow-x: auto; }
  footer { text-align: center; color: var(--text-dim); font-size: 0.75rem; margin-top: 2rem; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">Program History</p>
      <h1>${escapeHtml(history.teamName)}</h1>
      <p class="generated">Exported from DynastyOS on ${escapeHtml(generatedAt)}</p>
    </header>

    <div class="notice">
      All-time school title counts are not exposed by the readable dynasty save, so title totals below are shown as
      dynasty-era results only (seasons actually imported into this app), not the game's full school history.
    </div>

    <div class="tiles">${resumeTiles}</div>

    <section class="panel">
      <p class="eyebrow">School Record Book</p>
      <h2>Verified team records from the save itself.</h2>
      <div class="cards">${recordCards}</div>
    </section>

    <section class="panel">
      <p class="eyebrow">Coaching Ledger</p>
      <h2>Every coach on staff across the imported dynasty archive.</h2>
      ${coachRows}
    </section>

    <section class="panel">
      <p class="eyebrow">Dynasty Timeline</p>
      <h2>Every season in the archive, newest first.</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Season</th><th>Record</th><th>Conf</th><th>Coach</th><th>AP</th><th>Coaches</th><th>CFP</th><th>Postseason</th><th>Honors</th>
            </tr>
          </thead>
          <tbody>${timelineRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <p class="eyebrow">Dynasty Milestones</p>
      <h2>The biggest beats from your dynasty run.</h2>
      ${milestoneRows}
    </section>

    <footer>Generated by DynastyOS — a local-first EA Sports College Football 27 dynasty tracker.</footer>
  </div>
</body>
</html>`;
}
