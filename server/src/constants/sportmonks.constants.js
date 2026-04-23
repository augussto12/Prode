/**
 * SPORTMONKS CONSTANTS
 * Centralización de todos los Type IDs, State IDs y Ligas
 * relacionadas al ecosistema Sportmonks V3 de la aplicación.
 */

// TYPE IDS — Stats de jugadores (lineups.details)
// Fuente: catálogo oficial Sportmonks v3
export const STAT_TYPE = {
  // ── Core stats ──
  GOALS: 52,
  ASSISTS: 79,
  MINUTES_PLAYED: 119,
  RATING: 118,
  SAVES: 57,
  CLEAN_SHEET: 194,       // Stat de temporada, no per-match

  // ── Tarjetas ──
  YELLOW_CARDS: 84,
  YELLOWRED_CARDS: 85,    // Segunda amarilla → roja
  RED_CARDS: 83,

  // ── Tiros ──
  SHOTS_TOTAL: 42,
  SHOTS_ON_TARGET: 86,
  SHOTS_OFF_TARGET: 41,
  SHOTS_BLOCKED: 58,

  // ── Pases ──
  PASSES: 80,             // Total de pases intentados
  ACCURATE_PASSES: 116,   // Pases completados
  KEY_PASSES: 117,
  LONG_BALLS: 122,
  LONG_BALLS_WON: 123,
  THROUGH_BALLS: 124,
  THROUGH_BALLS_WON: 125,

  // ── Defensivas ──
  TACKLES: 78,
  INTERCEPTIONS: 100,
  CLEARANCES: 101,
  BLOCKED_SHOTS: 97,

  // ── Duelos ──
  TOTAL_DUELS: 105,
  DUELS_WON: 106,
  AERIALS_WON: 107,

  // ── Dribbles ──
  DRIBBLE_ATTEMPTS: 108,
  SUCCESSFUL_DRIBBLES: 109,
  DRIBBLED_PAST: 110,
  DISPOSSESSED: 94,

  // ── Faltas y cruces ──
  FOULS: 56,
  FOULS_DRAWN: 96,
  TOTAL_CROSSES: 98,
  ACCURATE_CROSSES: 99,

  // ── Arquero ──
  SAVES_INSIDE_BOX: 104,
  GOALS_CONCEDED: 88,

  // ── Otros ──
  CAPTAIN: 40,
  OFFSIDES: 51,
  OWN_GOALS: 324,         // ⚠️ Season-level only — NO aparece en lineups.details per-match
  HIT_WOODWORK: 64,
  PENALTIES: 47,
  TOUCHES: 120,
  DUELS_LOST: 1491,
  ERROR_LEAD_TO_GOAL: 571,
  BIG_CHANCES_CREATED: 580,
  BIG_CHANCES_MISSED: 581,
};

// STATE IDs — Estados numéricos de partidos
export const STATE_IDS = {
  LIVE: [2, 3, 4, 6, 7, 8, 9, 11, 22],
  FINISHED: [5, 10, 13, 14, 15, 16],
  NOT_STARTED: [1, 17, 18, 21],
};

// DEVELOPER NAMES — Estados de partidos (más confiable que state_id o short_code)
export const LIVE_DEVELOPER_NAMES = [
  'INPLAY_1ST_HALF',
  'INPLAY_2ND_HALF',
  'INPLAY_ET',
  'INPLAY_ET_2ND_HALF',
  'INPLAY_PENALTIES',
  'HT',
  'BREAK',
];

export const FINISHED_DEVELOPER_NAMES = [
  'FT', 'AET', 'FT_PEN', 'AWARDED', 'CANCELLATION'
];

// LEAGUE IDs — Entorno Sportmonks (Ligas cubiertas)
export const SPORTMONKS_LEAGUE_IDS = [636, 642, 645, 8, 564, 384, 241, 243, 2];

// FANTASY LEAGUE IDs — Ligas habilitadas para el Fantasy
export const FANTASY_LEAGUE_IDS = [636, 8, 564, 384];

// FANTASY SEASON IDs — Mapeo leagueId → seasonId actual (actualizar cada temporada)
export const FANTASY_SEASON_IDS = {
  636: 26808,  // Liga Profesional Argentina
  8: 25583,    // Premier League
  564: 25659,  // La Liga
  384: 25533,  // Serie A
};

// Ligas de API-Football que NO deben renderizarse porque las
// cubre Sportmonks (sirve para merge en Explorer, evita duplicados)
export const AF_LEAGUES_COVERED_BY_SM = new Set([39, 140, 135, 128, 13, 11]);
