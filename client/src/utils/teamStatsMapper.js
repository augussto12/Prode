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
// ═══════════════════════════════════════
export const SM_STAT_TYPES = {
  // ── Performance ──
  MVP: 211, // { rating, player_name, player_id }
  RATING: 118, // { value: "6.99" } (string!)
  PPG: 9676, // { average_points_per_game }
  DANGEROUS_ATTACKS: 84, // { count, average, player_id, player_name }

  // ── Partidos ──
  MATCHES_PLAYED: 214, // { all: { count }, home: { count }, away: { count } }
  WINS: 194, // { all: { count, percentage }, home, away }
  DRAWS: 216, // { all: { count, percentage }, home, away }
  LOSSES: 192, // { all: { count, percentage }, home, away }

  // ── Ataque ──
  GOALS: 52, // { all: { count, average }, home, away }
  SHOTS: 1677, // { total, on_target, off_target, inside_box, outside_box, blocked, average }
  ASSISTS: 27254, // { minutes_per_assist, assists_per_game, total_assists }
  SCORING_FREQ: 27248, // { avg minutes per goal, etc. }
  PENALTIES: 47, // { scored, missed }
  GOALS_SCORED_FIRST: 88, // { all: { count, average, first } }
  SCORING_HALF: 27250, // { most_scored_half, most_scored_half_goals, details }
  SHOT_SIDE: 9675, // { left, right, unknown }

  // ── Defensa ──
  CLEAN_SHEETS: 215, // { all: { count, percentage }, home, away }
  INTERCEPTIONS: 27252, // { total_interceptions, interceptions_per_game }
  GOALS_AGAINST: 27260, // { avg_per_game, total, etc. }
  TACKLES: 78, // { count, average, tackles_per_foul, tackles_per_card }
  FOULS: 124, // { total }

  // ── Disciplina ──
  YELLOW_CARDS: 43, // { count, average }
  RED_CARDS: 51, // { count, average }
  CARDS: 575, // { all: { count, percentage }, home, away }

  // ── Posesión / Pases ──
  POSSESSION: 45, // { count, average } (percentage)
  PASSES: 27253, // { passes_per_game, passes_per_goal, total_passes, passes_per_shot }
  CORNERS: 34, // { count, average }

  // ── Timing / Distribución temporal ──
  GOALS_TIMING: 213, // { "0-15": { count, percentage }, "15-30": {...}, ... }
  GA_TIMING: 196, // { "0-15": { count, percentage }, ... }

  // ── Over/Under ──
  OVER_UNDER: 191, // { over_0_5: { matches, team }, over_1_5, ... }

  // ── Plantilla / Físico ──
  MINUTES_PLAYED: 27249, // { total_minutes_played }
  MOST_APPEARING: 9677, // { most_appearing_players[], longest_appearing_players[] }
  MOST_SUBSTITUTED: 9678, // { most_substituted_players[] }
  NATIONAL_PLAYERS: 27258, // { national_team_players[] }
  AVG_HEIGHT: 9672, // { avg_defender_height, avg_midfielder_height, ... }
  MOST_FREQ_MINUTE: 27251, // { most_frequent_scoring_minute, amount_of_goals }
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
