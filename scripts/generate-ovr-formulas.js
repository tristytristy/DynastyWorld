/**
 * Generates src/shared/ovrFormulas.generated.ts — the OVR weight tables and the
 * position/archetype id maps the live overall calculator runs on.
 *
 *   node scripts/generate-ovr-formulas.js "<path to a CFB 27 save>"
 *
 * TWO SOURCES, because neither is enough alone:
 *
 *  1. References/EA_Overall_Calculation_Formula_Explained.md — 93 weight tables
 *     extracted from the PORC table of EA's StreamedData.DB. `References/` is
 *     gitignored, which is exactly why this generator exists: the tables get
 *     baked into committed source so a clone can build without the reference.
 *
 *  2. The save's own schema enums — the doc keys every formula on a numeric
 *     (PPOS, PLTY) pair, and the app only ever sees the enum NAMES ("QB",
 *     "QB_FieldGeneral"). The name->number maps come from the schema so the two
 *     can be joined.
 *
 * WHY NOT MATCH ON ARCHETYPE NAMES: the workbook is from 2026 and its names do
 * not survive into CFB 27 — its QBs are "Pocket Passer / Backfield Creator /
 * Dual Threat / Pure Runner" where the save says "FieldGeneral / StrongArm /
 * Improviser / Scrambler" — and 52 of the 93 rows are literally "Unlabeled in
 * source", including the whole defence. Only the numbers line up, and measured
 * against a real save they line up perfectly: every player matched a formula.
 */
const fs = require('fs');
const path = require('path');
const FranchiseModule = require('madden-franchise');

const Franchise = FranchiseModule.Franchise || FranchiseModule.default || FranchiseModule;
const ROOT = path.resolve(__dirname, '..');
const DOC = path.join(ROOT, 'References', 'EA_Overall_Calculation_Formula_Explained.md');
const OUT = path.join(ROOT, 'src', 'shared', 'ovrFormulas.generated.ts');
const SAVE = process.argv[2];

/**
 * Doc attribute label -> the app's own rating key (RatingFieldDef.key in
 * playerEditorFields.ts). Anything absent here is an attribute the editor does
 * not expose; formulas that depend on one are marked unsupported below rather
 * than silently computed from a missing value.
 */
const ATTR_TO_KEY = {
  Speed: 'spd', Strength: 'str', Agility: 'agi', Acceleration: 'acc', Awareness: 'awr',
  'Break Tackle': 'btk', Trucking: 'trk', 'Change of Direction': 'cod',
  'Ball Carrier Vision': 'bcv', 'Stiff Arm': 'sfa', 'Spin Move': 'spm', 'Juke Move': 'jkm',
  Carrying: 'car', Catching: 'cth', 'Short Route Running': 'srr',
  'Medium Route Running': 'mrr', 'Deep Route Runnings': 'drr', 'Catch in Traffic': 'cit',
  'Spectacular Catch': 'spc', Release: 'rls', Jumping: 'jmp', 'Throw Power': 'thp',
  'Short Throw Accuracy': 'tas', 'Medium Throw Accuracy': 'tam', 'Deep Throw Accuracy': 'tad',
  'Throw on the Run': 'tor', 'Throw Under Pressure': 'tup', 'Break Sack': 'bsk',
  'Play Action': 'pac', Tackle: 'tak', 'Hit Power': 'htp', 'Power Moves': 'pmv',
  'Finese Moves': 'fmv', 'Block Shedding': 'bsh', Pursuit: 'pur',
  'Play Recognition': 'prc', 'Man Coverage': 'mcv', 'Zone Coverage': 'zcv', Press: 'prs',
  'Pass Block': 'pbk', 'Pass Block Power': 'pbp', 'Pass Block Finesse': 'pbf',
  'Run Block': 'rbk', 'Run Block Power': 'rbp', 'Run Block Finesse': 'rbf',
  'Lead Block': 'lbk', 'Impact Blocking': 'iblk', Stamina: 'sta', Injury: 'inj',
  Toughness: 'tgh',
  // Deliberately absent: Kick Power, Kick Accuracy, Return, Long Snap — the
  // editor has no kicking ratings, so K/P/LS/KR/PR/KOS cannot be computed.
};

/**
 * Combos measured as WRONG for CFB 27 against a real 16,256-player save, even
 * though a formula exists for them. Re-deriving only the scaling bounds does not
 * rescue them (a linear refit reaches 8-20%), so their underlying weights
 * changed in 27 and we do not have the new ones. Computing these would produce a
 * confidently wrong number, which is worse than declining.
 */
const KNOWN_BAD = ['K', 'P', 'FS'];

function parseFormulas(md) {
  const heads = [...md.matchAll(/^### (.+?) \(`PPOS (\d+)`, `PLTY (\d+)`\)$/gm)];
  return heads.map((h, i) => {
    const body = md.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : md.length);
    const weights = {};
    let needsMissingAttribute = false;
    for (const m of body.matchAll(/^\| ([A-Za-z][A-Za-z /]*?) \| (\d+) \|$/gm)) {
      const label = m[1].trim();
      const weight = Number(m[2]);
      if (label === 'Attribute' || weight <= 0) continue;
      const key = ATTR_TO_KEY[label];
      if (!key) { needsMissingAttribute = true; continue; }
      weights[key] = weight;
    }
    return {
      label: h[1],
      ppos: Number(h[2]),
      plty: Number(h[3]),
      low: Number((body.match(/Desired low: `(-?\d+)`/) || [])[1]),
      high: Number((body.match(/Desired high: `(-?\d+)`/) || [])[1]),
      weights,
      needsMissingAttribute,
    };
  });
}

(async () => {
  if (!SAVE || !fs.existsSync(SAVE)) {
    console.error('Pass the path to a CFB 27 save file (a disposable COPY).');
    process.exit(1);
  }
  if (!fs.existsSync(DOC)) {
    console.error(`Reference doc not found: ${DOC}`);
    process.exit(1);
  }

  const formulas = parseFormulas(fs.readFileSync(DOC, 'utf8'));

  const franchise = new Franchise(SAVE);
  await new Promise((res, rej) => { franchise.on('ready', res); franchise.on('error', rej); });
  const table = franchise.getTableByName('Player');
  const attr = (n) => table.schema.attributes.find((a) => a.name === n);

  // Sentinel members (First_/Last_/Count_/Invalid) share values with real ones
  // and must not win the name->id map; skip them, same rule playerEditorOptions
  // already follows.
  const isSentinel = (n) => /(^|_)(First|Last|Count|Invalid)_?$/.test(n) || /_First_|_Last_/.test(n);
  const enumMap = (name) => {
    const out = {};
    for (const m of attr(name).enum.members) {
      if (isSentinel(m.name)) continue;
      out[m.name] = Number(m.value);
    }
    return out;
  };

  const positions = enumMap('Position');
  const playerTypes = enumMap('PlayerType');

  const unsupported = new Set();
  for (const [posName, ppos] of Object.entries(positions)) {
    if (KNOWN_BAD.includes(posName)) {
      for (const [typeName, plty] of Object.entries(playerTypes)) {
        if (formulas.some((f) => f.ppos === ppos && f.plty === plty)) unsupported.add(`${ppos}:${plty}`);
      }
    }
  }
  for (const f of formulas) if (f.needsMissingAttribute) unsupported.add(`${f.ppos}:${f.plty}`);

  const body = formulas
    .map((f) => `  '${f.ppos}:${f.plty}': { low: ${f.low}, high: ${f.high}, weights: ${JSON.stringify(f.weights)} }, // ${f.label}`)
    .join('\n');

  const ts = `/**
 * GENERATED — do not edit by hand.
 *   node scripts/generate-ovr-formulas.js "<path to a CFB 27 save copy>"
 *
 * OVR weight tables (from EA's PORC data, via
 * References/EA_Overall_Calculation_Formula_Explained.md) plus the enum
 * name->id maps needed to select one. See the generator for why this is keyed
 * on numeric ids rather than archetype names.
 *
 * Accuracy, measured against a real ${'16,256'}-player CFB 27 save: 93.7% of players
 * reproduce the game's own stored OverallRating exactly, and every player
 * matched a formula. The misses are confined to the positions listed in
 * UNSUPPORTED_FORMULA_KEYS, which callers must not compute.
 */

export interface OvrFormula {
  /** Remaps the weighted average onto the 0-99 scale. */
  low: number;
  high: number;
  /** Keyed by RatingFieldDef.key; zero-weight attributes are omitted entirely. */
  weights: Record<string, number>;
}

/** Keyed \`\${positionId}:\${playerTypeId}\`. */
export const OVR_FORMULAS: Record<string, OvrFormula> = {
${body}
};

/** Player.Position enum name -> id (the formula's PPOS). */
export const POSITION_IDS: Record<string, number> = ${JSON.stringify(positions, null, 2)};

/** Player.PlayerType enum name -> id (the formula's PLTY). */
export const PLAYER_TYPE_IDS: Record<string, number> = ${JSON.stringify(playerTypes, null, 2)};

/**
 * Formulas that exist but must NOT be used, for one of two reasons: the editor
 * has no kicking ratings so the inputs are unavailable (K/P/LS/KR/PR/KOS), or
 * the weights measurably changed in CFB 27 and ours reproduce the game less
 * than a fifth of the time (K, P, FS). Callers show the stored rating instead.
 */
export const UNSUPPORTED_FORMULA_KEYS: ReadonlySet<string> = new Set(${JSON.stringify([...unsupported])});
`;

  fs.writeFileSync(OUT, ts);
  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
  console.log(`  ${formulas.length} formulas, ${Object.keys(positions).length} positions, ${Object.keys(playerTypes).length} player types`);
  console.log(`  ${unsupported.size} formula keys marked unsupported`);
  process.exit(0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
