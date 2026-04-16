/**
 * Lista curada de ligas con datos reales en API-Football.
 * Solo ligas conocidas con buena cobertura de datos.
 */

// ─── TOP (aparecen primero en el grid) ───
export const TOP_LEAGUE_IDS = [1, 2, 3, 13, 11, 128, 39, 140, 135, 78, 61];

// ─── TODAS LAS LIGAS PERMITIDAS (por categoría) ───
export const CURATED_LEAGUES = {
  // ═══ INTERNACIONALES ═══
  'Torneos Internacionales': [
    1,    // World Cup
    15,   // Club World Cup
    2,    // Champions League
    3,    // Europa League
    848,  // Conference League
    13,   // Copa Libertadores
    11,   // Copa Sudamericana
    9,    // Copa América
    4,    // Euro
    5,    // UEFA Nations League
    531,  // UEFA Super Cup
    16,   // Recopa Sudamericana
    32,   // World Cup Qualification Europe
    34,   // World Cup Qualification South America
    29,   // World Cup Qualification Asia
    35,   // World Cup Qualification Africa
    31,   // World Cup Qualification CONCACAF
  ],

  // ═══ ARGENTINA ═══
  'Argentina': [
    128,  // Liga Profesional Argentina
    130,  // Copa Argentina
    131,  // Primera Nacional (2da)
    129,  // Superliga (legacy, pre-2020)
  ],

  // ═══ BRASIL ═══
  'Brasil': [
    71,   // Brasileirão Série A
    72,   // Brasileirão Série B
    73,   // Copa do Brasil
    75,   // Brasileirão Série C
  ],

  // ═══ INGLATERRA ═══
  'Inglaterra': [
    39,   // Premier League
    45,   // FA Cup
    48,   // EFL Cup (Carabao Cup)
    40,   // Championship (2da)
    528,  // Community Shield
  ],

  // ═══ ESPAÑA ═══
  'España': [
    140,  // La Liga
    143,  // Copa del Rey
    141,  // La Liga 2 (2da)
    556,  // Supercopa de España
  ],

  // ═══ ITALIA ═══
  'Italia': [
    135,  // Serie A
    137,  // Coppa Italia
    136,  // Serie B (2da)
    547,  // Supercoppa Italiana
  ],

  // ═══ ALEMANIA ═══
  'Alemania': [
    78,   // Bundesliga
    81,   // DFB-Pokal
    79,   // 2. Bundesliga (2da)
    529,  // DFL Super Cup
  ],

  // ═══ FRANCIA ═══
  'Francia': [
    61,   // Ligue 1
    66,   // Coupe de France
    62,   // Ligue 2 (2da)
    526,  // Trophée des Champions
  ],

  // ═══ OTRAS LIGAS INTERESANTES ═══
  'Turquía': [
    203,  // Süper Lig
    206,  // Turkish Cup
  ],

  'Portugal': [
    94,   // Primeira Liga
    96,   // Taça de Portugal
  ],

  'Países Bajos': [
    88,   // Eredivisie
    90,   // KNVB Beker
  ],

  'Japón': [
    98,   // J1 League
    101,  // Emperor's Cup
  ],

  'México': [
    262,  // Liga MX
    264,  // Copa MX
  ],

  'Estados Unidos': [
    253,  // MLS
  ],

  'Arabia Saudita': [
    307,  // Saudi Pro League
  ],
};

// Set completo de IDs permitidos (para filtrar rápido)
export const ALLOWED_LEAGUE_IDS = new Set(
  Object.values(CURATED_LEAGUES).flat()
);

// Para el filtro de live: IDs separados por guión
export const LIVE_LEAGUE_IDS_STRING = [...ALLOWED_LEAGUE_IDS].join('-');
