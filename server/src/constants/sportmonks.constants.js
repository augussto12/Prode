/**
 * SPORTMONKS CONSTANTS
 * Centralización de todos los Type IDs, State IDs y Ligas
 * relacionadas al ecosistema Sportmonks V3 de la aplicación.
 */

// TYPE IDS — Stats de jugadores (lineups.details)
export const STAT_TYPE = {
  GOALS: 52,
  ASSISTS: 79,
  MINUTES_PLAYED: 119,
  RATING: 118,
  YELLOW_CARDS: 84,
  RED_CARDS: 83,
  SHOTS_ON_TARGET: 86,
  PASSES_COMPLETED: 116,
  SAVES: 57,
  OWN_GOALS: 324,
  PENALTY_SAVES: 113,
  CLEAN_SHEET: 194,
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
