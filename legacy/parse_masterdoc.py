#!/usr/bin/env python3
"""Parse the hand-typed CFB 26 dynasty master document (2025-2054) into JSON.

The document is one season template repeated 30 times, typed by hand over a
year — so the parser is tolerant: dash variants (-- vs –), header emoji
variants, 'St.'/'State' drift, occasional nickname suffixes ('USC Trojans'),
and a partial 2026 CFP. Output is a semantic JSON the app importer consumes.
"""
import json
import re
import sys

SRC = 'masterdoc.txt'
OUT = 'cfb26-dynasty.json'

text = open(SRC).read()

# ---------- team name normalization ----------
NICK_SUFFIXES = [
    ' Trojans', ' Panthers', ' Tigers', ' Bulldogs', ' Wolfpack', ' Cornhuskers',
    ' Sooners', ' Longhorns', ' Aggies', ' Wolverines', ' Buckeyes', ' Ducks',
    ' Cardinal', ' Tar Heels', ' Blue Devils', ' Hurricanes', ' Seminoles',
]
ALIASES = {
    'UNC': 'North Carolina',
    'North Carolina*': 'North Carolina',
    'Ole Miss Rebels': 'Ole Miss',
    'Hawaii': "Hawai'i",
    'San Jose St.': 'San Jose State',
    'NC St.': 'NC State',
    'FAU': 'Florida Atlantic',
    'FIU': 'Florida International',
    'FSU': 'Florida State',
    'Pitt': 'Pittsburgh',
    'NIU': 'Northern Illinois',
    'Miami University': 'Miami (OH)',
}

def norm_team(name):
    s = re.sub(r'\s+', ' ', name.strip())
    s = s.strip('.').strip() if s.endswith(' .') else s
    s = re.sub(r'^#\d+\s+', '', s)                      # strip rank prefix
    for suf in NICK_SUFFIXES:
        if s.endswith(suf) and len(s) > len(suf) + 2:
            s = s[: -len(suf)]
    # 'X St.' -> 'X State' so the same school spelled both ways collapses
    s = re.sub(r'\bSt\.$', 'State', s)
    s = re.sub(r'\bSt\.\s', 'State ', s)
    s = ALIASES.get(s, s)
    return s

def norm_conf(name):
    s = re.sub(r'\s+', ' ', name.strip()).upper()
    aliases = {
        'BIG TEN': 'Big Ten', 'BIG 10': 'Big Ten', 'BIG10': 'Big Ten',
        'BIG 12': 'Big 12', 'BIG12': 'Big 12',
        'SEC': 'SEC', 'ACC': 'ACC', 'AMERICAN': 'American', 'SUN BELT': 'Sun Belt',
        'MAC': 'MAC', 'MWC': 'MWC', 'CUSA': 'CUSA', 'PAC-12': 'Pac-12', 'PAC 12': 'Pac-12',
        'INDEPENDENT': 'Independent', 'INDEPENDENTS': 'Independent',
    }
    return aliases.get(s, name.strip())

def parse_score(s):
    m = re.search(r'(\d+)\s*[-–]\s*(\d+)', s or '')
    return (int(m.group(1)), int(m.group(2))) if m else None

def parse_record(s):
    m = re.search(r'\((\d+)-(\d+)\)', s or '')
    return (int(m.group(1)), int(m.group(2))) if m else None

warnings = []

# ---------- split into years ----------
parts = re.split(r'\[OFFICIAL COLLEGE FOOTBALL 26 DYNASTY SEASON RECORD — YEAR: (\d{4})\]', text)
years = {}
for i in range(1, len(parts), 2):
    years[int(parts[i])] = parts[i + 1]

def section(block, header_re, next_res):
    """Text between a header line and the next of any listed headers (or end)."""
    m = re.search(header_re, block)
    if not m:
        return None
    start = m.end()
    end = len(block)
    for nr in next_res:
        m2 = re.search(nr, block[start:])
        if m2:
            end = min(end, start + m2.start())
    return block[start:end]

ALL_HEADERS = [
    r'🏆\s*NATIONAL CHAMPION', r'🏟️?\s*COLLEGE FOOTBALL PLAYOFF RESULTS',
    r'🏆\s*CONFERENCE CHAMPIONSHIPS', r'Conference Standings',
    r'📊\s*TOP OFFENSIVE TEAM STATS', r'📊\s*TOP DEFENSIVE TEAM STATS',
    r'👨‍🏫\s*COACHING STATS', r'📊\s*END OF DYNASTY',
]

def kv(block, key):
    # leading \s* — several hand-typed lines carry a stray leading space
    m = re.search(rf'^\s*{key}\s*:\s*(.+)$', block, re.M)
    return m.group(1).strip() if m else None

seasons = []
for year in sorted(years):
    block = years[year]
    season = {'year': year}

    # ---- national champion ----
    nc = section(block, r'🏆\s*NATIONAL CHAMPION', ALL_HEADERS)
    if nc:
        champ_part, _, ru_part = nc.partition('Runner-Up')
        season['champion'] = {
            'team': norm_team(kv(champ_part, 'Champion') or ''),
            'record': kv(champ_part, 'Record'),
            'finalRank': kv(champ_part, 'Final Poll Rank'),
            'coach': kv(champ_part, 'Head Coach'),
            'seed': kv(champ_part, 'CFP Seed'),
        }
        if ru_part:
            season['runnerUp'] = {
                'team': norm_team((ru_part.splitlines()[0] or '').lstrip(': ').strip()),
                'record': kv(ru_part, 'Record'),
                'finalRank': kv(ru_part, 'Final Poll Rank'),
                'seed': kv(ru_part, 'CFP Seed'),
                'score': kv(ru_part, 'Score'),
            }
    else:
        warnings.append(f'{year}: no national champion section')

    # ---- CFP results ----
    cfp = section(block, r'COLLEGE FOOTBALL PLAYOFF RESULTS', ALL_HEADERS)
    games = []
    if cfp:
        round_map = [
            (r'ROUND 1', 'first-round'), (r'QUARTERFINALS?', 'quarterfinal'),
            (r'SEMIFINALS?', 'semifinal'), (r'NATIONAL CHAMPIONSHIP', 'championship'),
        ]
        # split on round markers
        marks = []
        for pat, rnd in round_map:
            # dash runs vary: '--', '-', and en-dash '–' all appear
            for m in re.finditer(rf'[-–]+\s*{pat}\s*[-–]+', cfp):
                marks.append((m.start(), m.end(), rnd))
        marks.sort()
        for idx, (s0, e0, rnd) in enumerate(marks):
            seg = cfp[e0: marks[idx + 1][0] if idx + 1 < len(marks) else len(cfp)]
            # Header drifts across 30 hand-typed years: 'Game 1 (Teams and CFP
            # Seeds):', bare 'Game (Teams...):', 'Game 1:', and 'Game 3 (Peach
            # Bowl):'. Parenthetical optional; when it names a bowl, keep it.
            # Case-sensitive 'Game' cannot collide with the lowercase
            # '...entering the game):' inside record lines.
            for gm in re.finditer(
                r'^\s*Game\s*\d*\s*(?:\(([^)]*)\))?\s*:\s*(.+?)\n(.*?)(?=^\s*Game\s*\d*\s*[(:]|\Z)', seg, re.S | re.M,
            ):
                paren, head, body = gm.group(1), gm.group(2), gm.group(3)
                bowl = paren.strip() if paren and 'bowl' in paren.lower() else None
                vs = re.split(r'\s+vs\.?\s+', head.strip())
                if len(vs) != 2:
                    warnings.append(f'{year} CFP {rnd}: bad matchup "{head.strip()}"')
                    continue
                def team_seed(s):
                    ms = re.match(r'#(\d+)\s+(.*)', s.strip())
                    return (norm_team(ms.group(2)), int(ms.group(1))) if ms else (norm_team(s), None)
                (t1, s1), (t2, s2) = team_seed(vs[0]), team_seed(vs[1])
                r1 = parse_record(kv(body, r'Team 1 \(Record entering the game\)') or '')
                r2 = parse_record(kv(body, r'Team 2 \(Record entering the game\)') or '')
                result = kv(body, 'Result') or ''
                winner = norm_team(result.split('def.')[0]) if 'def.' in result else None
                score = parse_score(kv(body, 'Score') or '')
                games.append({
                    'round': rnd, 'bowl': bowl, 'team1': t1, 'seed1': s1, 'record1': r1,
                    'team2': t2, 'seed2': s2, 'record2': r2,
                    'winner': winner, 'score': list(score) if score else None,
                })
    season['playoff'] = games
    if not games:
        warnings.append(f'{year}: no CFP games parsed')

    # ---- conference championships ----
    cc = section(block, r'🏆\s*CONFERENCE CHAMPIONSHIPS', ALL_HEADERS)
    confChamps = []
    if cc:
        for m in re.finditer(r'-+\s*([A-Z][A-Z0-9 ]+?) CHAMPIONSHIP\s*[-–]+\s*\n(.*?)(?=-+\s*[A-Z][A-Z0-9 ]+? CHAMPIONSHIP|\Z)', cc, re.S):
            conf, body = norm_conf(m.group(1)), m.group(2)
            head = kv(body, r'Teams and Poll Rankings Entering the Game') or ''
            vs = re.split(r'\s+vs\.?\s+', head)
            def team_rank(s):
                ms = re.match(r'#(\d+)\s+(.*)', s.strip())
                return (norm_team(ms.group(2)), int(ms.group(1))) if ms else (norm_team(s), None)
            t1, rk1 = team_rank(vs[0]) if len(vs) == 2 else (None, None)
            t2, rk2 = team_rank(vs[1]) if len(vs) == 2 else (None, None)
            result = kv(body, 'Result') or ''
            winner = norm_team(result.split('def.')[0]) if 'def.' in result else None
            score = parse_score(kv(body, 'Score') or '')
            confChamps.append({
                'conference': conf, 'team1': t1, 'rank1': rk1,
                'record1': parse_record(kv(body, r'Team 1 \(Record entering the game\)') or ''),
                'team2': t2, 'rank2': rk2,
                'record2': parse_record(kv(body, r'Team 2 \(Record entering the game\)') or ''),
                'winner': winner, 'score': list(score) if score else None,
                'winningCoach': kv(body, 'Winning Coach'),
            })
    season['conferenceChampionships'] = confChamps

    # ---- conference standings ----
    standings = {}
    for m in re.finditer(rf'{year}\s+(.+?)\s+Conference Standings\s*\n-+\s*\n(.*?)(?=\n\s*\n|\Z)', block, re.S):
        conf = norm_conf(m.group(1))
        rows = []
        for row in re.finditer(r'^\|\s*([^|]+?)\s*\|\s*(\d+)-(\d+)\s*\|', m.group(2), re.M):
            name = row.group(1)
            if name.strip().lower() == 'team':
                continue
            rows.append({'team': norm_team(name), 'wins': int(row.group(2)), 'losses': int(row.group(3))})
        if rows:
            standings[conf] = rows
        else:
            warnings.append(f'{year}: empty standings table for {conf}')
    season['standings'] = standings

    # ---- national team stats ----
    def stats_table(header_re):
        seg = section(block, header_re, ALL_HEADERS)
        if not seg:
            return None
        lines = [ln for ln in seg.splitlines() if ln.strip().startswith('|')]
        if not lines:
            return None
        cols = [c.strip() for c in lines[0].strip('| ').split('|')]
        rows = []
        for ln in lines[1:]:
            cells = [c.strip() for c in ln.strip().strip('|').split('|')]
            if len(cells) < 2:
                continue
            ms = re.match(r'(#\d+\s+)?(.*)', cells[0])
            rows.append({'team': norm_team(ms.group(2)), 'rank': int(ms.group(1).strip('# ')) if ms.group(1) else None,
                         'values': cells[1:]})
        return {'columns': cols[1:], 'rows': rows}

    season['teamStatsOffense'] = stats_table(r'📊\s*TOP OFFENSIVE TEAM STATS')
    season['teamStatsDefense'] = stats_table(r'📊\s*TOP DEFENSIVE TEAM STATS')

    # ---- coaching snapshot + notes ----
    coach_seg = section(block, r'👨‍🏫\s*COACHING STATS', ALL_HEADERS)
    if coach_seg:
        notes_m = re.search(r'Notes:\s*(.*)', coach_seg, re.S)
        season['coach'] = {
            'name': kv(coach_seg, 'Coach Name'),
            'job': kv(coach_seg, 'Coach Job'),
            'team': norm_team(kv(coach_seg, 'Team') or '') or None,
            'seasonRecord': kv(coach_seg, 'Season Record'),
            'careerRecord': kv(coach_seg, 'Career Record'),
            'bowlRecord': kv(coach_seg, 'Bowl Record'),
            'bowlWin': kv(coach_seg, r'Bowl Game Win\?'),
            'confChampionshipsCareer': kv(coach_seg, r'Conference Championships \(Career\)'),
            'nationalChampionshipsCareer': kv(coach_seg, r'National Championships \(Career\)'),
            'cfpRecordCareer': kv(coach_seg, r'CFP Record \(Career\)'),
            'notes': re.sub(r'\n{3,}', '\n\n', notes_m.group(1)).strip() if notes_m else None,
        }
    seasons.append(season)

# ---------- end-of-dynasty coaching table ----------
eod = section(text, r'📊\s*END OF DYNASTY ALL-TIME COACHING STATS', [r'\Z'])
allTimeCoaches = []
if eod:
    lines = [ln for ln in eod.splitlines() if ln.strip().startswith('|')]
    if lines:
        cols = [c.strip() for c in lines[0].strip('| ').split('|')]
        for ln in lines[1:]:
            cells = [c.strip() for c in ln.strip().strip('|').split('|')]
            if len(cells) == len(cols):
                allTimeCoaches.append(dict(zip(cols, cells)))

out = {
    'format': 'dynastyos-legacy-dynasty-v1',
    'label': 'CFB 26 Dynasty (2025-2054)',
    'game': 'College Football 26',
    'coachName': 'Tristan Murdock',
    'seasons': seasons,
    'allTimeCoaches': allTimeCoaches,
}

json.dump(out, open(OUT, 'w'), indent=1)

# ---------- validation report ----------
teams = set()
for s in seasons:
    for conf, rows in s['standings'].items():
        teams.update(r['team'] for r in rows)
    for g in s['playoff']:
        teams.update(t for t in (g['team1'], g['team2'], g['winner']) if t)
print(f'seasons: {len(seasons)}')
print(f'distinct teams: {len(teams)}')
print(f'playoff games/yr: min {min(len(s["playoff"]) for s in seasons)}, max {max(len(s["playoff"]) for s in seasons)}')
print(f'conf championships/yr: min {min(len(s["conferenceChampionships"]) for s in seasons)}, max {max(len(s["conferenceChampionships"]) for s in seasons)}')
print(f'standings confs/yr: min {min(len(s["standings"]) for s in seasons)}, max {max(len(s["standings"]) for s in seasons)}')
print(f'coach snapshots: {sum(1 for s in seasons if s.get("coach"))}')
print(f'notes: {sum(1 for s in seasons if s.get("coach") and s["coach"].get("notes"))}')
print(f'all-time coach rows: {len(allTimeCoaches)}')
print(f'offense tables: {sum(1 for s in seasons if s.get("teamStatsOffense"))}, defense: {sum(1 for s in seasons if s.get("teamStatsDefense"))}')
print('\nWARNINGS:')
for w in warnings:
    print(' -', w)
# suspicious near-duplicate team names
from difflib import SequenceMatcher
tl = sorted(teams)
print('\nteams:', ', '.join(tl))
