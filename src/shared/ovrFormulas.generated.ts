/**
 * GENERATED — do not edit by hand.
 *   node scripts/generate-ovr-formulas.js "<path to a CFB 27 save copy>"
 *
 * OVR weight tables (from EA's PORC data, via
 * References/EA_Overall_Calculation_Formula_Explained.md) plus the enum
 * name->id maps needed to select one. See the generator for why this is keyed
 * on numeric ids rather than archetype names.
 *
 * Accuracy, measured against a real 16,256-player CFB 27 save: 93.7% of players
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

/** Keyed `${positionId}:${playerTypeId}`. */
export const OVR_FORMULAS: Record<string, OvrFormula> = {
  '0:0': { low: 35, high: 95, weights: {"spd":1,"agi":3,"acc":7,"awr":28,"btk":1,"trk":1,"cod":1,"bcv":1,"sfa":1,"spm":1,"jkm":1,"car":3,"thp":28,"tas":28,"tam":28,"tad":28,"tor":1,"tup":14,"bsk":3,"pac":14,"tgh":7} }, // QB / Pocket Passer
  '0:2': { low: 35, high: 95, weights: {"spd":2,"agi":2,"acc":14,"awr":23,"btk":1,"trk":1,"cod":2,"bcv":14,"sfa":1,"spm":1,"jkm":1,"car":1,"thp":23,"tas":2,"tam":23,"tad":23,"tor":23,"tup":14,"bsk":14,"pac":14,"tgh":1} }, // QB / Backfield Creator
  '0:3': { low: 35, high: 95, weights: {"spd":14,"agi":2,"acc":14,"awr":23,"btk":1,"trk":1,"cod":2,"bcv":23,"sfa":1,"spm":1,"jkm":1,"car":14,"thp":23,"tas":1,"tam":14,"tad":23,"tor":23,"tup":2,"bsk":14,"pac":1,"tgh":2} }, // QB / Dual Threat
  '0:4': { low: 42, high: 93, weights: {"spd":22,"agi":9,"acc":22,"awr":22,"btk":9,"trk":1,"cod":9,"bcv":22,"sfa":1,"spm":22,"jkm":22,"car":22,"thp":1,"tas":1,"tam":1,"tad":1,"tor":1,"tup":1,"bsk":1,"pac":1,"tgh":9} }, // QB / Pure Runner
  '1:5': { low: 35, high: 94, weights: {"spd":12,"str":20,"agi":1,"acc":20,"awr":15,"btk":20,"trk":20,"cod":1,"bcv":20,"sfa":20,"spm":1,"jkm":4,"car":20,"cth":4,"srr":1,"pbk":1,"tgh":20} }, // HB / Contact Seeker
  '1:6': { low: 35, high: 94, weights: {"spd":20,"str":1,"agi":20,"acc":20,"awr":12,"btk":15,"trk":1,"cod":20,"bcv":20,"sfa":1,"spm":20,"jkm":20,"car":20,"cth":4,"srr":1,"pbk":1,"tgh":4} }, // HB / East/West Playmaker
  '1:7': { low: 35, high: 94, weights: {"spd":20,"str":1,"agi":20,"acc":20,"awr":4,"btk":4,"trk":1,"cod":20,"bcv":12,"sfa":1,"spm":20,"jkm":20,"car":15,"cth":20,"srr":20,"pbk":1,"tgh":1} }, // HB / Backfield Threat
  '1:8': { low: 35, high: 94, weights: {"spd":4,"str":20,"agi":1,"acc":20,"awr":20,"btk":20,"trk":20,"cod":1,"bcv":15,"sfa":20,"spm":1,"jkm":1,"car":20,"cth":4,"srr":1,"pbk":12,"tgh":20} }, // HB / North/South Blocker
  '1:9': { low: 35, high: 94, weights: {"spd":4,"str":20,"agi":1,"acc":20,"awr":20,"btk":20,"trk":20,"cod":1,"bcv":15,"sfa":20,"spm":1,"jkm":1,"car":12,"cth":20,"srr":20,"pbk":1,"tgh":4} }, // HB / North/South Receiver
  '1:10': { low: 35, high: 94, weights: {"spd":10,"str":10,"agi":10,"acc":10,"awr":10,"btk":17,"trk":17,"cod":17,"bcv":17,"sfa":17,"spm":17,"jkm":17,"car":10,"cth":2,"srr":1,"pbk":1,"tgh":17} }, // HB / Elusive Bruiser
  '2:12': { low: 33, high: 84, weights: {"spd":2,"str":18,"agi":4,"acc":4,"awr":20,"btk":12,"trk":14,"car":10,"cth":4,"srr":10,"cit":4,"pbk":8,"pbp":2,"pbf":2,"rbk":20,"rbp":10,"rbf":6,"lbk":36,"iblk":14} }, // FB / Blocking
  '2:13': { low: 33, high: 85, weights: {"spd":10,"str":12,"agi":12,"acc":10,"awr":20,"btk":8,"trk":10,"cod":4,"bcv":12,"sfa":8,"car":14,"cth":16,"srr":18,"cit":4,"pbk":4,"rbk":6,"lbk":10,"iblk":22} }, // FB / Utility
  '3:14': { low: 32, high: 95, weights: {"spd":24,"str":1,"agi":15,"acc":24,"awr":15,"btk":1,"cod":5,"bcv":1,"spm":1,"jkm":1,"car":5,"cth":24,"srr":1,"mrr":15,"drr":24,"cit":11,"spc":11,"rls":15,"jmp":1,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":1} }, // WR / Speedster
  '3:15': { low: 32, high: 95, weights: {"spd":21,"str":1,"agi":12,"acc":21,"awr":12,"btk":12,"cod":12,"bcv":4,"spm":4,"jkm":4,"car":4,"cth":21,"srr":21,"mrr":21,"drr":1,"cit":1,"spc":1,"rls":21,"jmp":1,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":1} }, // WR / Route Artist
  '3:16': { low: 32, high: 95, weights: {"spd":11,"str":7,"agi":1,"acc":11,"awr":11,"btk":7,"cod":1,"bcv":1,"spm":1,"jkm":1,"car":1,"cth":11,"srr":19,"mrr":19,"drr":19,"cit":19,"spc":7,"rls":19,"jmp":19,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":11} }, // WR / Physical Route Runner
  '3:17': { low: 32, high: 95, weights: {"spd":9,"str":1,"agi":20,"acc":20,"awr":9,"btk":3,"cod":20,"bcv":1,"spm":20,"jkm":20,"car":1,"cth":20,"srr":20,"mrr":20,"drr":3,"cit":3,"spc":3,"rls":1,"jmp":1,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":1} }, // WR / Elusive Route Runner
  '3:18': { low: 32, high: 95, weights: {"spd":15,"str":15,"agi":1,"acc":15,"awr":15,"btk":9,"cod":1,"bcv":1,"spm":1,"jkm":1,"car":1,"cth":23,"srr":23,"mrr":9,"drr":1,"cit":23,"spc":9,"rls":1,"jmp":1,"thp":1,"tad":1,"rbk":9,"iblk":1,"tgh":23} }, // WR / Gritty Possesion
  '3:19': { low: 32, high: 95, weights: {"spd":21,"str":1,"agi":12,"acc":21,"awr":12,"btk":21,"cod":21,"bcv":21,"spm":12,"jkm":12,"car":21,"cth":4,"srr":4,"mrr":4,"drr":1,"cit":1,"spc":1,"rls":1,"jmp":1,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":4} }, // WR / Gadget
  '3:20': { low: 32, high: 95, weights: {"spd":12,"str":5,"agi":5,"acc":12,"awr":12,"btk":1,"cod":5,"bcv":1,"spm":1,"jkm":1,"car":5,"cth":12,"srr":1,"mrr":11,"drr":11,"cit":25,"spc":25,"rls":25,"jmp":25,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":1} }, // WR / Contested Specialist
  '4:22': { low: 32, high: 89, weights: {"spd":1,"str":15,"agi":1,"acc":1,"awr":6,"btk":1,"trk":6,"cod":1,"bcv":1,"sfa":6,"spm":1,"jkm":1,"car":1,"cth":6,"srr":6,"mrr":1,"drr":1,"cit":6,"spc":1,"rls":1,"jmp":1,"pbk":15,"pbp":15,"pbf":15,"rbk":15,"rbp":15,"rbf":15,"lbk":15,"iblk":15,"tgh":15} }, // TE / Pure Blocker
  '4:23': { low: 32, high: 89, weights: {"spd":11,"str":5,"agi":5,"acc":19,"awr":19,"btk":1,"trk":1,"cod":5,"bcv":1,"sfa":1,"spm":1,"jkm":1,"car":1,"cth":19,"srr":11,"mrr":11,"drr":19,"cit":11,"spc":19,"rls":19,"jmp":5,"pbk":2,"pbp":1,"pbf":1,"rbk":2,"rbp":1,"rbf":1,"lbk":1,"iblk":1,"tgh":5} }, // TE / Vertical Threat
  '4:24': { low: 32, high: 89, weights: {"spd":6,"str":1,"agi":6,"acc":19,"awr":19,"btk":5,"trk":5,"cod":5,"bcv":1,"sfa":5,"spm":1,"jkm":1,"car":1,"cth":19,"srr":19,"mrr":19,"drr":6,"cit":19,"spc":6,"rls":19,"jmp":5,"pbk":1,"pbp":1,"pbf":1,"rbk":1,"rbp":1,"rbf":1,"lbk":1,"iblk":1,"tgh":5} }, // TE / Physical Route Runner
  '4:25': { low: 32, high: 89, weights: {"spd":6,"str":15,"agi":1,"acc":6,"awr":15,"btk":1,"trk":1,"cod":1,"bcv":1,"sfa":1,"spm":1,"jkm":1,"car":1,"cth":15,"srr":15,"mrr":1,"drr":1,"cit":15,"spc":1,"rls":1,"jmp":1,"pbk":15,"pbp":6,"pbf":15,"rbk":15,"rbp":6,"rbf":15,"lbk":6,"iblk":6,"tgh":15} }, // TE / Gritty Possesion
  '4:26': { low: 32, high: 89, weights: {"spd":1,"str":5,"agi":1,"acc":11,"awr":19,"btk":1,"trk":5,"cod":1,"bcv":1,"sfa":5,"spm":1,"jkm":1,"car":1,"cth":19,"srr":19,"mrr":19,"drr":1,"cit":19,"spc":11,"rls":1,"jmp":1,"pbk":11,"pbp":5,"pbf":5,"rbk":11,"rbp":5,"rbf":5,"lbk":5,"iblk":5,"tgh":5} }, // TE / Pure Possession
  '5:31': { low: 38, high: 95, weights: {"spd":2,"str":18,"agi":2,"acc":18,"awr":33,"pbk":33,"pbp":33,"pbf":33,"rbk":2,"rbp":2,"rbf":2,"lbk":2,"iblk":2,"tgh":18} }, // LT / Pass Protector
  '5:32': { low: 38, high: 96, weights: {"spd":1,"str":27,"agi":1,"acc":1,"awr":27,"pbk":11,"pbp":27,"pbf":1,"rbk":11,"rbp":27,"rbf":1,"lbk":11,"iblk":27,"tgh":27} }, // LT / Raw Strength
  '5:33': { low: 37, high: 95, weights: {"spd":2,"str":11,"agi":2,"acc":11,"awr":19,"pbk":19,"pbp":19,"pbf":19,"rbk":19,"rbp":19,"rbf":19,"lbk":11,"iblk":11,"tgh":19} }, // LT / Unlabeled in source
  '5:34': { low: 37, high: 94, weights: {"spd":1,"str":24,"agi":1,"acc":13,"awr":24,"pbk":24,"pbp":1,"pbf":13,"rbk":13,"rbp":1,"rbf":24,"lbk":13,"iblk":24,"tgh":24} }, // LT / Agile
  '6:35': { low: 38, high: 95, weights: {"spd":2,"str":18,"agi":2,"acc":18,"awr":33,"pbk":33,"pbp":33,"pbf":33,"rbk":2,"rbp":2,"rbf":2,"lbk":2,"iblk":2,"tgh":18} }, // LG / Pass Protector
  '6:36': { low: 38, high: 95, weights: {"spd":2,"str":11,"agi":2,"acc":11,"awr":19,"pbk":19,"pbp":19,"pbf":19,"rbk":19,"rbp":19,"rbf":19,"lbk":11,"iblk":11,"tgh":19} }, // LG / Well Rounded
  '6:37': { low: 38, high: 96, weights: {"spd":1,"str":27,"agi":1,"acc":1,"awr":27,"pbk":11,"pbp":27,"pbf":1,"rbk":11,"rbp":27,"rbf":1,"lbk":11,"iblk":27,"tgh":27} }, // LG / Raw Strength
  '6:38': { low: 38, high: 94, weights: {"spd":1,"str":24,"agi":1,"acc":13,"awr":24,"pbk":24,"pbp":1,"pbf":13,"rbk":13,"rbp":1,"rbf":24,"lbk":13,"iblk":24,"tgh":24} }, // LG / Agile
  '7:27': { low: 33, high: 96, weights: {"spd":2,"str":18,"agi":2,"acc":18,"awr":33,"pbk":33,"pbp":33,"pbf":33,"rbk":2,"rbp":2,"rbf":2,"lbk":2,"iblk":2,"tgh":18} }, // C / Pass Protector
  '7:28': { low: 38, high: 97, weights: {"spd":1,"str":27,"agi":1,"acc":1,"awr":27,"pbk":11,"pbp":27,"pbf":1,"rbk":11,"rbp":27,"rbf":1,"lbk":11,"iblk":27,"tgh":27} }, // C / Raw Strength
  '7:29': { low: 38, high: 96, weights: {"spd":2,"str":11,"agi":2,"acc":11,"awr":19,"pbk":19,"pbp":19,"pbf":19,"rbk":19,"rbp":19,"rbf":19,"lbk":11,"iblk":11,"tgh":19} }, // C / Unlabeled in source
  '7:30': { low: 38, high: 96, weights: {"spd":1,"str":24,"agi":1,"acc":13,"awr":24,"pbk":24,"pbp":1,"pbf":13,"rbk":13,"rbp":1,"rbf":24,"lbk":13,"iblk":24,"tgh":24} }, // C / Agile
  '8:35': { low: 38, high: 95, weights: {"spd":2,"str":18,"agi":2,"acc":18,"awr":33,"pbk":33,"pbp":33,"pbf":33,"rbk":2,"rbp":2,"rbf":2,"lbk":2,"iblk":2,"tgh":18} }, // RG / Pass Protector
  '8:36': { low: 38, high: 95, weights: {"spd":2,"str":11,"agi":2,"acc":11,"awr":19,"pbk":19,"pbp":19,"pbf":19,"rbk":19,"rbp":19,"rbf":19,"lbk":11,"iblk":11,"tgh":19} }, // RG / Well Rounded
  '8:37': { low: 38, high: 96, weights: {"spd":1,"str":27,"agi":1,"acc":1,"awr":27,"pbk":11,"pbp":27,"pbf":1,"rbk":11,"rbp":27,"rbf":1,"lbk":11,"iblk":27,"tgh":27} }, // RG / Raw Strength
  '8:38': { low: 38, high: 94, weights: {"spd":1,"str":24,"agi":1,"acc":13,"awr":24,"pbk":24,"pbp":1,"pbf":13,"rbk":13,"rbp":1,"rbf":24,"lbk":13,"iblk":24,"tgh":24} }, // RG / Agile
  '9:31': { low: 38, high: 95, weights: {"spd":2,"str":18,"agi":2,"acc":18,"awr":33,"pbk":33,"pbp":33,"pbf":33,"rbk":2,"rbp":2,"rbf":2,"lbk":2,"iblk":2,"tgh":18} }, // RT / Pass Protector
  '9:32': { low: 38, high: 96, weights: {"spd":1,"str":27,"agi":1,"acc":1,"awr":27,"pbk":11,"pbp":27,"pbf":1,"rbk":11,"rbp":27,"rbf":1,"lbk":11,"iblk":27,"tgh":27} }, // RT / Raw Strength
  '9:33': { low: 37, high: 95, weights: {"spd":2,"str":11,"agi":2,"acc":11,"awr":19,"pbk":19,"pbp":19,"pbf":19,"rbk":19,"rbp":19,"rbf":19,"lbk":11,"iblk":11,"tgh":19} }, // RT / Unlabeled in source
  '9:34': { low: 37, high: 94, weights: {"spd":1,"str":24,"agi":1,"acc":13,"awr":24,"pbk":24,"pbp":1,"pbf":13,"rbk":13,"rbp":1,"rbf":24,"lbk":13,"iblk":24,"tgh":24} }, // RT / Agile
  '10:39': { low: 33, high: 95, weights: {"spd":30,"str":10,"agi":22,"acc":30,"awr":22,"tak":30,"htp":1,"pmv":1,"fmv":30,"bsh":1,"pur":12,"prc":1,"tgh":10} }, // LEDG / Unlabeled in source
  '10:40': { low: 33, high: 95, weights: {"spd":30,"str":30,"agi":10,"acc":30,"awr":22,"tak":22,"htp":1,"pmv":30,"fmv":1,"bsh":1,"pur":12,"prc":1,"tgh":10} }, // LEDG / Unlabeled in source
  '10:41': { low: 33, high: 95, weights: {"spd":1,"str":31,"agi":1,"acc":20,"awr":10,"tak":31,"htp":31,"pmv":10,"fmv":1,"bsh":31,"pur":10,"prc":10,"tgh":13} }, // LEDG / Unlabeled in source
  '10:42': { low: 33, high: 95, weights: {"spd":12,"str":22,"agi":1,"acc":30,"awr":10,"tak":30,"htp":1,"pmv":1,"fmv":1,"bsh":30,"pur":22,"prc":30,"tgh":10} }, // LEDG / Unlabeled in source
  '11:39': { low: 33, high: 95, weights: {"spd":30,"str":10,"agi":22,"acc":30,"awr":22,"tak":30,"htp":1,"pmv":1,"fmv":30,"bsh":1,"pur":12,"prc":1,"tgh":10} }, // REDG / Unlabeled in source
  '11:40': { low: 33, high: 95, weights: {"spd":30,"str":30,"agi":10,"acc":30,"awr":22,"tak":22,"htp":1,"pmv":30,"fmv":1,"bsh":1,"pur":12,"prc":1,"tgh":10} }, // REDG / Unlabeled in source
  '11:41': { low: 33, high: 95, weights: {"spd":1,"str":31,"agi":1,"acc":20,"awr":10,"tak":31,"htp":31,"pmv":10,"fmv":1,"bsh":31,"pur":10,"prc":10,"tgh":13} }, // REDG / Unlabeled in source
  '11:42': { low: 33, high: 95, weights: {"spd":12,"str":22,"agi":1,"acc":30,"awr":10,"tak":30,"htp":1,"pmv":1,"fmv":1,"bsh":30,"pur":22,"prc":30,"tgh":10} }, // REDG / Unlabeled in source
  '12:43': { low: 33, high: 95, weights: {"spd":8,"str":31,"agi":2,"acc":8,"awr":31,"tak":31,"htp":8,"pmv":2,"fmv":2,"bsh":31,"pur":8,"prc":24,"tgh":14} }, // DT / Unlabeled in source
  '12:44': { low: 32, high: 95, weights: {"spd":2,"str":35,"agi":2,"acc":5,"awr":15,"tak":25,"htp":15,"pmv":35,"fmv":2,"bsh":35,"pur":2,"prc":2,"tgh":25} }, // DT / Unlabeled in source
  '12:45': { low: 33, high: 95, weights: {"spd":12,"str":20,"agi":2,"acc":30,"awr":30,"tak":30,"htp":2,"pmv":2,"fmv":30,"bsh":12,"pur":12,"prc":2,"tgh":16} }, // DT / Unlabeled in source
  '12:46': { low: 33, high: 95, weights: {"spd":7,"str":32,"agi":2,"acc":24,"awr":32,"tak":32,"htp":2,"pmv":32,"fmv":2,"bsh":7,"pur":7,"prc":2,"tgh":19} }, // DT / Unlabeled in source
  '13:48': { low: 36, high: 95, weights: {"spd":9,"str":19,"agi":9,"acc":19,"awr":19,"cod":1,"tak":31,"htp":1,"bsh":13,"pur":31,"prc":19,"mcv":9,"zcv":19,"tgh":1} }, // SAM / Unlabeled in source
  '13:49': { low: 36, high: 95, weights: {"spd":15,"str":1,"agi":15,"acc":23,"awr":23,"cod":15,"tak":35,"htp":1,"bsh":1,"pur":5,"prc":15,"mcv":15,"zcv":35,"tgh":1} }, // SAM / Unlabeled in source
  '13:50': { low: 36, high: 95, weights: {"spd":11,"str":25,"agi":11,"acc":16,"awr":25,"cod":2,"tak":35,"htp":2,"bsh":16,"pur":35,"prc":16,"mcv":2,"zcv":2,"tgh":2} }, // SAM / Unlabeled in source
  '14:51': { low: 36, high: 95, weights: {"spd":9,"str":19,"agi":9,"acc":19,"awr":19,"cod":1,"tak":31,"htp":1,"bsh":13,"pur":31,"prc":19,"mcv":9,"zcv":19,"tgh":1} }, // MIKE / Unlabeled in source
  '14:52': { low: 36, high: 95, weights: {"spd":15,"str":1,"agi":15,"acc":23,"awr":23,"cod":15,"tak":35,"htp":1,"bsh":1,"pur":5,"prc":15,"mcv":15,"zcv":35,"tgh":1} }, // MIKE / Unlabeled in source
  '14:53': { low: 36, high: 95, weights: {"spd":11,"str":25,"agi":11,"acc":16,"awr":25,"cod":2,"tak":35,"htp":2,"bsh":16,"pur":35,"prc":16,"mcv":2,"zcv":2,"tgh":2} }, // MIKE / Unlabeled in source
  '15:48': { low: 36, high: 95, weights: {"spd":9,"str":19,"agi":9,"acc":19,"awr":19,"cod":1,"tak":31,"htp":1,"bsh":13,"pur":31,"prc":19,"mcv":9,"zcv":19,"tgh":1} }, // WILL / Unlabeled in source
  '15:49': { low: 36, high: 95, weights: {"spd":15,"str":1,"agi":15,"acc":23,"awr":23,"cod":15,"tak":35,"htp":1,"bsh":1,"pur":5,"prc":15,"mcv":15,"zcv":35,"tgh":1} }, // WILL / Unlabeled in source
  '15:50': { low: 36, high: 95, weights: {"spd":11,"str":25,"agi":11,"acc":16,"awr":25,"cod":2,"tak":35,"htp":2,"bsh":16,"pur":35,"prc":16,"mcv":2,"zcv":2,"tgh":2} }, // WILL / Unlabeled in source
  '16:54': { low: 37, high: 95, weights: {"spd":35,"agi":6,"acc":35,"awr":26,"cod":17,"cth":2,"jmp":2,"tak":2,"bsh":2,"pur":2,"prc":17,"mcv":35,"zcv":2,"prs":17} }, // CB / Unlabeled in source
  '16:55': { low: 37, high: 95, weights: {"spd":25,"agi":9,"acc":34,"awr":19,"cod":25,"cth":2,"jmp":2,"tak":25,"bsh":2,"pur":19,"prc":25,"mcv":9,"zcv":2,"prs":2} }, // CB / Unlabeled in source
  '16:56': { low: 37, high: 95, weights: {"spd":26,"agi":9,"acc":35,"awr":19,"cod":19,"cth":2,"jmp":2,"tak":19,"bsh":2,"pur":2,"prc":19,"mcv":2,"zcv":35,"prs":9} }, // CB / Unlabeled in source
  '16:57': { low: 37, high: 95, weights: {"spd":35,"agi":9,"acc":35,"awr":15,"cod":15,"cth":2,"jmp":2,"tak":9,"bsh":2,"pur":2,"prc":15,"mcv":25,"zcv":25,"prs":9} }, // CB / Unlabeled in source
  '17:58': { low: 34, high: 95, weights: {"spd":23,"str":5,"agi":15,"acc":23,"awr":23,"cod":1,"jmp":5,"tak":32,"htp":15,"bsh":5,"pur":5,"prc":32,"mcv":9,"zcv":5,"prs":1,"tgh":5} }, // FS / Unlabeled in source
  '17:59': { low: 34, high: 95, weights: {"spd":25,"str":1,"agi":15,"acc":20,"awr":25,"cod":9,"jmp":9,"tak":20,"htp":1,"bsh":1,"pur":25,"prc":15,"mcv":9,"zcv":15,"prs":9,"tgh":1} }, // FS / Unlabeled in source
  '17:60': { low: 34, high: 95, weights: {"spd":31,"str":1,"agi":14,"acc":20,"awr":31,"cod":9,"jmp":9,"tak":20,"htp":1,"bsh":1,"pur":9,"prc":20,"mcv":1,"zcv":31,"prs":1,"tgh":1} }, // FS / Unlabeled in source
  '18:58': { low: 34, high: 95, weights: {"spd":31,"str":1,"agi":14,"acc":20,"awr":31,"cod":9,"jmp":9,"tak":20,"htp":1,"bsh":1,"pur":1,"prc":20,"mcv":9,"zcv":31,"prs":1,"tgh":1} }, // SS / Unlabeled in source
  '18:59': { low: 34, high: 95, weights: {"spd":25,"str":1,"agi":15,"acc":20,"awr":25,"cod":9,"jmp":9,"tak":20,"htp":1,"bsh":1,"pur":25,"prc":15,"mcv":9,"zcv":15,"prs":9,"tgh":1} }, // SS / Unlabeled in source
  '18:60': { low: 34, high: 95, weights: {"spd":23,"str":5,"agi":15,"acc":23,"awr":23,"cod":1,"jmp":5,"tak":32,"htp":15,"bsh":5,"pur":5,"prc":32,"mcv":5,"zcv":5,"prs":1,"tgh":5} }, // SS / Unlabeled in source
  '19:61': { low: 12, high: 99, weights: {"acc":70} }, // K / Unlabeled in source
  '19:62': { low: 12, high: 99, weights: {"acc":70} }, // K / Unlabeled in source
  '20:61': { low: 12, high: 99, weights: {"acc":70} }, // P / Unlabeled in source
  '20:62': { low: 12, high: 99, weights: {"acc":70} }, // P / Unlabeled in source
  '21:30': { low: 16, high: 99, weights: {"spd":8,"str":6,"acc":16,"awr":40,"tak":30} }, // LS / Unlabeled in source
  '22:15': { low: 0, high: 99, weights: {"spd":24,"acc":16} }, // KR / Unlabeled in source
  '23:15': { low: 0, high: 99, weights: {"spd":16,"acc":24,"cth":10} }, // PR / Unlabeled in source
  '24:62': { low: 12, high: 99, weights: {"acc":70} }, // KOS / Unlabeled in source
  '25:7': { low: 35, high: 94, weights: {"spd":20,"str":1,"agi":20,"acc":20,"awr":4,"btk":4,"trk":1,"cod":20,"bcv":12,"sfa":1,"spm":20,"jkm":20,"car":15,"cth":20,"srr":20,"pbk":1,"tgh":1} }, // 3SRB / Unlabeled in source
  '26:67': { low: 32, high: 95, weights: {"spd":21,"str":1,"agi":12,"acc":21,"awr":12,"btk":21,"cod":21,"bcv":21,"spm":12,"jkm":12,"car":21,"cth":4,"srr":4,"mrr":4,"drr":1,"cit":1,"spc":1,"rls":1,"jmp":1,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":4} }, // GAD / Unlabeled in source
  '27:5': { low: 35, high: 94, weights: {"spd":12,"str":20,"agi":1,"acc":20,"awr":15,"btk":20,"trk":20,"cod":1,"bcv":20,"sfa":20,"spm":1,"jkm":4,"car":20,"cth":4,"srr":1,"pbk":1,"tgh":20} }, // PWHB / Unlabeled in source
  '28:15': { low: 32, high: 95, weights: {"spd":21,"str":1,"agi":12,"acc":21,"awr":12,"btk":12,"cod":12,"bcv":4,"spm":4,"jkm":4,"car":4,"cth":21,"srr":21,"mrr":21,"drr":1,"cit":1,"spc":1,"rls":21,"jmp":1,"thp":1,"tad":1,"rbk":1,"iblk":1,"tgh":1} }, // SLWR / Unlabeled in source
  '29:39': { low: 33, high: 95, weights: {"spd":30,"str":10,"agi":22,"acc":30,"awr":22,"tak":30,"htp":1,"pmv":1,"fmv":30,"bsh":1,"pur":12,"prc":1,"tgh":10} }, // RLE / Unlabeled in source
  '30:39': { low: 33, high: 95, weights: {"spd":30,"str":10,"agi":22,"acc":30,"awr":22,"tak":30,"htp":1,"pmv":1,"fmv":30,"bsh":1,"pur":12,"prc":1,"tgh":10} }, // RRE / Unlabeled in source
  '31:40': { low: 33, high: 95, weights: {"spd":7,"str":32,"agi":2,"acc":24,"awr":32,"tak":32,"htp":2,"pmv":32,"fmv":2,"bsh":7,"pur":7,"prc":2,"tgh":19} }, // RDT / Unlabeled in source
  '32:43': { low: 33, high: 95, weights: {"spd":8,"str":31,"agi":2,"acc":8,"awr":31,"tak":31,"htp":8,"pmv":2,"fmv":2,"bsh":31,"pur":8,"prc":24,"tgh":14} }, // NT / Unlabeled in source
  '33:49': { low: 36, high: 95, weights: {"spd":15,"str":1,"agi":15,"acc":23,"awr":23,"cod":15,"tak":35,"htp":1,"bsh":1,"pur":5,"prc":15,"mcv":15,"zcv":35,"tgh":1} }, // Sub LB / Unlabeled in source
  '34:55': { low: 37, high: 95, weights: {"spd":25,"agi":9,"acc":34,"awr":19,"cod":25,"cth":2,"jmp":2,"tak":25,"bsh":2,"pur":19,"prc":25,"mcv":9,"zcv":2,"prs":2} }, // Sub CB / Unlabeled in source
};

/** Player.Position enum name -> id (the formula's PPOS). */
export const POSITION_IDS: Record<string, number> = {
  "FirstKeyOffense_": 0,
  "FirstNormal_": 0,
  "FirstOffense_": 0,
  "QB": 0,
  "HB": 1,
  "FB": 2,
  "WR": 3,
  "LastKeyOffense_": 4,
  "TE": 4,
  "FirstOffenseLine_": 5,
  "LT": 5,
  "LG": 6,
  "C": 7,
  "RG": 8,
  "LastOffenseLine_": 9,
  "LastOffense_": 9,
  "RT": 9,
  "FirstDefenseLine_": 10,
  "FirstDefense_": 10,
  "LE": 10,
  "RE": 11,
  "DT": 12,
  "LastDefenseLine_": 12,
  "FirstDefenseLB_": 13,
  "FirstDefenseSec_": 13,
  "LOLB": 13,
  "MLB": 14,
  "LastDefenseLB_": 15,
  "ROLB": 15,
  "CB": 16,
  "FirstDefenseDB_": 16,
  "FS": 17,
  "LastDefenseDB_": 18,
  "LastDefenseSec_": 18,
  "LastDefense_": 18,
  "SS": 18,
  "FirstKP_": 19,
  "K": 19,
  "LastKP_": 20,
  "LastNormalNoLS_": 20,
  "P": 20,
  "LastNormal_": 21,
  "LS": 21,
  "Count_Normal_": 22,
  "FirstKPReturn_": 22,
  "FirstSpecial_": 22,
  "KR": 22,
  "MaxNormal_": 22,
  "LastKPReturn_": 23,
  "PR": 23,
  "KOS": 24,
  "3DRB": 25,
  "GAD": 26,
  "PWHB": 27,
  "SLWR": 28,
  "RLE": 29,
  "RRE": 30,
  "RDT": 31,
  "NT": 32,
  "SUBLB": 33,
  "LastSpecial_": 34,
  "SLCB": 34,
  "HC_CFM": 35,
  "Max_": 35,
  "OC_CFM": 36,
  "DC_CFM": 37,
  "Owner_CFM": 38
};

/** Player.PlayerType enum name -> id (the formula's PLTY). */
export const PLAYER_TYPE_IDS: Record<string, number> = {
  "QB_FieldGeneral": 0,
  "QB_StrongArm": 1,
  "QB_Improviser": 2,
  "QB_Scrambler": 3,
  "QB_PureScrambler": 4,
  "HB_PowerBack": 5,
  "HB_ElusiveBack": 6,
  "HB_ReceivingBack": 7,
  "HB_PowerBlocking": 8,
  "HB_PowerReceiving": 9,
  "HB_ElusivePower": 10,
  "HB_ElusiveReceiving": 11,
  "FB_Blocking": 12,
  "FB_Utility": 13,
  "WR_DeepThreat": 14,
  "WR_Playmaker": 15,
  "WR_PhysicalRouteRunner": 16,
  "WR_ShiftyRouteRunner": 17,
  "WR_PhysicalBlocker": 18,
  "WR_GadgetReceiver": 19,
  "WR_Physical": 20,
  "WR_Slot": 21,
  "TE_Blocking": 22,
  "TE_VerticalThreat": 23,
  "TE_PhysicalRouteRunner": 24,
  "TE_PossessionBlocking": 25,
  "TE_Possession": 26,
  "C_PassProtector": 27,
  "C_Power": 28,
  "C_WellRounded": 29,
  "C_Agile": 30,
  "OT_PassProtector": 31,
  "OT_Power": 32,
  "OT_WellRounded": 33,
  "OT_Agile": 34,
  "G_PassProtector": 35,
  "G_WellRounded": 36,
  "G_Power": 37,
  "G_Agile": 38,
  "DE_SmallerSpeedRusher": 39,
  "DE_PowerRusher": 40,
  "DE_PurePower": 41,
  "DE_RunStopper": 42,
  "DT_NoseTackle": 43,
  "DT_PurePower": 44,
  "DT_SpeedRusher": 45,
  "DT_PowerRusher": 46,
  "OLB_SpeedRusher": 47,
  "OLB_PowerRusher": 48,
  "OLB_PassCoverage": 49,
  "OLB_RunStopper": 50,
  "MLB_FieldGeneral": 51,
  "MLB_PassCoverage": 52,
  "MLB_RunStopper": 53,
  "CB_MantoMan": 54,
  "CB_Slot": 55,
  "CB_Zone": 56,
  "CB_HybridCorner": 57,
  "S_Zone": 58,
  "S_Hybrid": 59,
  "S_RunSupport": 60,
  "KP_Accurate": 61,
  "KP_Power": 62,
  "Count_No_Returners": 63,
  "KR_Balanced": 63,
  "PR_Balanced": 64,
  "LS_Power": 65,
  "LS_Accurate": 66,
  "GAD_Gadget": 67,
  "Locked": 68
};

/**
 * Formulas that exist but must NOT be used, for one of two reasons: the editor
 * has no kicking ratings so the inputs are unavailable (K/P/LS/KR/PR/KOS), or
 * the weights measurably changed in CFB 27 and ours reproduce the game less
 * than a fifth of the time (K, P, FS). Callers show the stored rating instead.
 */
export const UNSUPPORTED_FORMULA_KEYS: ReadonlySet<string> = new Set(["17:58","17:59","17:60","19:61","19:62","20:61","20:62","21:30","22:15","23:15","24:62"]);
