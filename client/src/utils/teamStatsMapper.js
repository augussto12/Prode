/**
 * Sportmonks Team Season Statistics Mapper
 * Transforms the raw `statistics[].details[]` array from the Sportmonks API
 * into a structured, UI-ready object grouped by category.
 *
 * Usage:
 *   import { mapTeamSeasonStats } from './teamStatsMapper.js';
 *   const stats = mapTeamSeasonStats(details);
 */

// ═══════════════════════════════════════
// TYPE ID REGISTRY
// Source: Official Sportmonks v3 type catalog
// ═══════════════════════════════════════
export const SM_STAT_TYPES = {
  // ── Performance ──
  MVP: 211,               // HIGHEST_RATED_PLAYER ✅
  RATING: 118,            // RATING ✅
  PPG: 9676,              // AVERAGE_POINTS_PER_GAME ✅
  DANGEROUS_ATTACKS: 44,  // DANGEROUS_ATTACKS (era 84=YELLOWCARDS!)

  // ── Partidos ──
  MATCHES_PLAYED: 27263,  // GAMES_PLAYED
  WINS: 214,              // TEAM_WINS
  DRAWS: 215,             // TEAM_DRAWS ✅
  LOSSES: 216,            // TEAM_LOST (era 192=BTTS!)

  // ── Ataque ──
  GOALS: 52,              // GOALS ✅
  SHOTS: 1677,            // SHOTS ✅
  ASSISTS: 27254,         // ASSIST_STATS ✅
  SCORING_FREQ: 27248,    // SCORING_FREQUENCY ✅
  PENALTIES: 47,          // PENALTIES ✅
  GOALS_SCORED_FIRST: 196, // SCORING_MINUTES (era 88=GOALS_CONCEDED!)
  SCORING_HALF: 27250,    // MOST_SCORED_HALF ✅
  SHOT_SIDE: 9675,        // PLAYERS_FOOTING ✅

  // ── Defensa ──
  CLEAN_SHEETS: 194,      // CLEANSHEET (era 215=TEAM_DRAWS!)
  INTERCEPTIONS: 27252,   // INTERCEPTION_STATS ✅
  GOALS_AGAINST: 88,      // GOALS_CONCEDED (era 27260=INJURY_TIME_GOALS)
  TACKLES: 78,            // TACKLES ✅
  FOULS: 56,              // FOULS (era 124=THROUGH_BALLS!)

  // ── Disciplina ──
  YELLOW_CARDS: 84,       // YELLOWCARDS (era 43=ATTACKS!)
  RED_CARDS: 83,          // REDCARDS (era 51=OFFSIDES!)
  CARDS: 575,             // FAILED_TO_SCORE — keeping as-is, may need review

  // ── Posesión / Pases ──
  POSSESSION: 45,         // BALL_POSSESSION ✅
  PASSES: 27253,          // PASS_STATS ✅
  CORNERS: 34,            // CORNERS ✅

  // ── Timing / Distribución temporal ──
  GOALS_TIMING: 196,      // SCORING_MINUTES
  GA_TIMING: 213,         // CONCEDED_SCORING_MINUTES ✅
  MOST_FREQ_MINUTE: 27251, // MOST_FREQUENT_SCORING_MINUTE ✅

  // ── Over/Under ──
  OVER_UNDER: 191,        // NUMBER_OF_GOALS ✅

  // ── Plantilla / Físico ──
  MINUTES_PLAYED: 27249,  // TOTAL_MINUTES_PLAYED ✅
  MOST_APPEARING: 9677,   // APPEARING_PLAYERS ✅
  MOST_SUBSTITUTED: 9678, // MOST_SUBSTITUTED_PLAYERS ✅
  NATIONAL_PLAYERS: 27258, // NATIONAL_TEAM_PLAYERS ✅
  AVG_HEIGHT: 9672,       // AVERAGE_PLAYER_HEIGHT ✅
};

// ═══════════════════════════════════════
// VALUE EXTRACTOR
// ═══════════════════════════════════════

/**
 * Finds a stat by type_id and returns its raw value.
 * Handles the quirk where some values are strings ("6.99") that should be numbers.
 */
export function getStat(details, typeId) {
  if (!Array.isArray(details)) return null;
  const stat = details.find((d) => d.type_id === typeId);
  if (!stat) return null;

  const val = stat.value;
  if (val === null || val === undefined) return null;

  // String number like "6.99" → parse to float
  if (typeof val === "string" && !isNaN(val)) return parseFloat(val);

  // If it's an object with a single "value" key that's a string number (e.g. RATING: { value: "6.99" })
  if (
    typeof val === "object" &&
    val.value !== undefined &&
    typeof val.value === "string" &&
    !isNaN(val.value)
  ) {
    return { ...val, value: parseFloat(val.value) };
  }

  return val;
}

/**
 * Helper: extracts a simple count from stats that follow the { all: { count } } pattern.
 */
function getCount(details, typeId, split = "all") {
  const val = getStat(details, typeId);
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (split && val[split] !== undefined) return val[split]?.count ?? 0;
  return val.count ?? 0;
}

// ═══════════════════════════════════════
// MAIN MAPPER
// ═══════════════════════════════════════

/**
 * Transforms a raw Sportmonks details array into a structured stats object.
 * @param {Array} details - The `details` array from a team season statistic entry
 * @returns {object} Grouped, UI-ready statistics
 */
export function mapTeamSeasonStats(details) {
  if (!Array.isArray(details) || details.length === 0) return null;

  const T = SM_STAT_TYPES;

  return {
    performance: {
      mvp: getStat(details, T.MVP), // { rating, player_name, player_id }
      rating: getStat(details, T.RATING), // { value: 6.99 } (parsed)
      ppg: getStat(details, T.PPG), // { average_points_per_game }
      dangerousAttacks: getStat(details, T.DANGEROUS_ATTACKS),
    },

    matches: {
      played: getStat(details, T.MATCHES_PLAYED), // { all, home, away }
      wins: getStat(details, T.WINS),
      draws: getStat(details, T.DRAWS),
      losses: getStat(details, T.LOSSES),
    },

    attack: {
      goals: getStat(details, T.GOALS), // { all, home, away }
      shots: getStat(details, T.SHOTS), // { total, on_target, ... }
      assists: getStat(details, T.ASSISTS), // { total_assists, assists_per_game }
      scoringFreq: getStat(details, T.SCORING_FREQ),
      penalties: getStat(details, T.PENALTIES), // { scored, missed }
      scoredFirst: getStat(details, T.GOALS_SCORED_FIRST),
      scoringHalf: getStat(details, T.SCORING_HALF),
      shotSide: getStat(details, T.SHOT_SIDE), // { left, right, unknown }
    },

    defense: {
      cleanSheets: getStat(details, T.CLEAN_SHEETS),
      interceptions: getStat(details, T.INTERCEPTIONS),
      goalsAgainst: getStat(details, T.GOALS_AGAINST),
      tackles: getStat(details, T.TACKLES),
      fouls: getStat(details, T.FOULS),
    },

    discipline: {
      yellowCards: getStat(details, T.YELLOW_CARDS), // { count, average }
      redCards: getStat(details, T.RED_CARDS),
      cards: getStat(details, T.CARDS),
    },

    possession: {
      average: getStat(details, T.POSSESSION), // { count: 50, average: 50 }
      passes: getStat(details, T.PASSES),
      corners: getStat(details, T.CORNERS),
    },

    timing: {
      goalsByPeriod: getStat(details, T.GOALS_TIMING), // { "0-15": { count }, ... }
      goalsConcededByPeriod: getStat(details, T.GA_TIMING),
      mostFreqMinute: getStat(details, T.MOST_FREQ_MINUTE),
    },

    overUnder: getStat(details, T.OVER_UNDER),

    squad: {
      minutesPlayed: getStat(details, T.MINUTES_PLAYED),
      mostAppearing: getStat(details, T.MOST_APPEARING),
      mostSubstituted: getStat(details, T.MOST_SUBSTITUTED),
      nationalPlayers: getStat(details, T.NATIONAL_PLAYERS),
      avgHeight: getStat(details, T.AVG_HEIGHT),
    },

    // Quick-access KPIs for cards/summaries
    kpi: {
      played: getCount(details, T.MATCHES_PLAYED),
      wins: getCount(details, T.WINS),
      draws: getCount(details, T.DRAWS),
      losses: getCount(details, T.LOSSES),
      goalsFor: getCount(details, T.GOALS),
      cleanSheets: getCount(details, T.CLEAN_SHEETS),
      possession:
        getStat(details, T.POSSESSION)?.average ??
        getStat(details, T.POSSESSION)?.count ??
        0,
      rating: getStat(details, T.RATING)?.value ?? 0,
      yellowCards: getStat(details, T.YELLOW_CARDS)?.count ?? 0,
      redCards: getStat(details, T.RED_CARDS)?.count ?? 0,
    },
  };
}
