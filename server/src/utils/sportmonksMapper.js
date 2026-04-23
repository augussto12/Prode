/**
 * Mapper: Transforma respuestas de Sportmonks v3 al formato de los modelos de Prisma.
 * Los Type IDs oficiales están centralizados en sportmonks.constants.js (STAT_TYPE).
 */

import {
  STAT_TYPE,
  LIVE_DEVELOPER_NAMES,
  FINISHED_DEVELOPER_NAMES
} from '../constants/sportmonks.constants.js';

// ═══════════════════════════════════════
// STATUS MAPPING
// ═══════════════════════════════════════

/**
 * Mapea el estado de Sportmonks al formato interno.
 * Sportmonks state codes: NS, LIVE, HT, FT, ET, PEN_LIVE, AET, FT_PEN,
 *   BREAK, SUSP, INT, ABAN, POSTP, CANC, AU, Deleted, TBA, WO
 *
 * @param {string} stateCode - ej: 'FT', 'NS', 'LIVE', 'HT'
 * @returns {string} - 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed' | 'suspended'
 */
export function mapStatus(stateCode) {
  if (!stateCode) return 'scheduled';

  const code = stateCode.toUpperCase();

  // Finished states (short codes + developer_names)
  if (FINISHED_DEVELOPER_NAMES.includes(code) || ['FT', 'AET', 'FT_PEN', 'AWARDED', 'CANCELLATION'].includes(code)) return 'finished';

  // Live/in-progress states (short codes + developer_names)
  if (LIVE_DEVELOPER_NAMES.includes(code) || ['LIVE', 'HT', 'ET', 'PEN_LIVE', 'BREAK', '1ST_HALF', '2ND_HALF'].includes(code)) return 'live';
  if (code.startsWith('INPLAY')) return 'live';

  // Cancelled/abandoned
  if (['CANC', 'ABAN', 'AU', 'DELETED', 'WO', 'CANCELLED'].includes(code)) return 'cancelled';

  // Postponed/suspended
  if (['POSTP', 'SUSP', 'INT', 'DELAYED', 'POSTPONED'].includes(code)) return 'postponed';

  // Scheduled (NS, TBA, etc.)
  return 'scheduled';
}

// ═══════════════════════════════════════
// SCORE EXTRACTION
// ═══════════════════════════════════════
/**
 * Extrae el score de un lado (home/away) del array de scores de Sportmonks.
 * Sportmonks v3 scores structure:
 *   [
 *     { description: 'CURRENT', score: { goals: 2, participant: 'home' } },
 *     { description: 'CURRENT', score: { goals: 1, participant: 'away' } },
 *     { description: '1ST_HALF', score: { goals: 1, participant: 'home' } },
 *     ...
 *   ]
 *
 * @param {Array} scores - Array de scores de Sportmonks
 * @param {string} side - 'home' o 'away'
 * @returns {number|null}
 */
export function extractScore(scores, side) {
  if (!Array.isArray(scores) || scores.length === 0) return null;

  // Strategy 1: Find CURRENT score for this side
  const currentScore = scores.find(
    s => (s.description === 'CURRENT' || s.type_id === 1525) && s.score?.participant === side
  );
  if (currentScore) return currentScore.score.goals ?? null;

  // Strategy 2: Find any entry with matching participant (prefer later periods)
  // Sort by description to get 2ND_HALF > 1ST_HALF priority
  const sideScores = scores
    .filter(s => s.score?.participant === side)
    .sort((a, b) => {
      const order = { 'CURRENT': 10, '2ND_HALF': 5, '1ST_HALF': 3 };
      return (order[b.description] || 0) - (order[a.description] || 0);
    });

  if (sideScores.length > 0) {
    return sideScores[0].score.goals ?? null;
  }

  return null;
}

// ═══════════════════════════════════════
// FIXTURE MAPPER
// ═══════════════════════════════════════

/**
 * Transforma un fixture de Sportmonks al formato de Prisma Fixture.
 * @param {object} smFixture - Fixture tal como viene de Sportmonks
 * @returns {object} - Objeto listo para Prisma upsert
 */
export function mapFixture(smFixture) {
  // Extraer equipos de participants
  const participants = smFixture.participants || [];
  const homeTeam = participants.find(p => p.meta?.location === 'home');
  const awayTeam = participants.find(p => p.meta?.location === 'away');

  // Usar developer_name (más confiable que state/short_name) con fallback
  const developerName = smFixture.state?.developer_name;
  const status = mapStatus(developerName || smFixture.state?.state || smFixture.state?.short_name);

  // Sportmonks devuelve scores con 0 goles incluso para partidos no comenzados (NS).
  // Solo extraer scores si el partido está en vivo o terminado.
  const hasStarted = status === 'live' || status === 'finished';

  return {
    externalId: String(smFixture.id),
    source: 'sportmonks',
    leagueId: smFixture.league_id,
    seasonId: smFixture.season_id || null,
    homeTeamId: homeTeam?.id || smFixture.home_team_id || 0,
    awayTeamId: awayTeam?.id || smFixture.away_team_id || 0,
    startTime: smFixture.starting_at_timestamp
      ? new Date(smFixture.starting_at_timestamp * 1000)
      : new Date(smFixture.starting_at + 'Z'),
    status,
    homeScore: hasStarted ? extractScore(smFixture.scores, 'home') : null,
    awayScore: hasStarted ? extractScore(smFixture.scores, 'away') : null,
    round: smFixture.round?.name || null,
    venueName: smFixture.venue?.name || null,
  };
}

// ═══════════════════════════════════════
// PLAYER MATCH STATS MAPPER
// ═══════════════════════════════════════

/**
 * Extrae un valor numérico de las stats de un jugador por type_id.
 * Sportmonks v3 con `lineups.details` devuelve:
 *   { type_id: 118, data: { value: 7.33 } }
 * Con `lineups.player.statistics` devuelve:
 *   { type_id: 118, value: { total: 7.33 } } o { type_id: 118, value: 7.33 }
 *
 * @param {Array} details - Array de details/statistics de Sportmonks
 * @param {number} typeId - Type ID de la stat (ej: 79 para goles)
 * @returns {number|null}
 */
function getStatValue(details, typeId) {
  if (!Array.isArray(details)) return null;

  const stat = details.find(d => d.type_id === typeId);
  if (!stat) return null;

  // Format 1: lineups.details → { data: { value: N } }
  if (stat.data !== undefined && stat.data !== null) {
    const val = stat.data.value ?? stat.data;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val.total !== undefined) return val.total;
    return null;
  }

  // Format 2: lineups.player.statistics → { value: N } or { value: { total: N } }
  const val = stat.value;
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.total !== undefined) return val.total;
  if (typeof val === 'number') return val;

  return null;
}

/**
 * Transforma la data de un jugador en un lineup a PlayerMatchStat de Prisma.
 * Soporta tanto `lineups.details` como `lineups.player.statistics`.
 * Cards are extracted from fixture events since lineups.details doesn't consistently have them.
 * @param {object} lineupPlayer - Lineup entry de Sportmonks
 * @param {array} fixtureEvents - Events array from the fixture (for cards)
 * @returns {object} - Objeto listo para Prisma upsert
 */
export function mapPlayerMatchStats(lineupPlayer, fixtureEvents = []) {
  const details =
    lineupPlayer.details ||
    lineupPlayer.statistics ||
    lineupPlayer.player?.statistics ||
    [];


  const playerId = lineupPlayer.player_id || lineupPlayer.player?.id;

  // Extract cards from stats or fallback to events (event type_id 19 = yellow, 20 = red, 21 = second yellow)
  const playerEvents = fixtureEvents.filter(e => e.player_id === playerId);
  const yellowCards = getStatValue(details, STAT_TYPE.YELLOW_CARDS) ?? (playerEvents.filter(e => e.type_id === 19 || e.type_id === 21).length || null);
  const redCards = getStatValue(details, STAT_TYPE.RED_CARDS) ?? (playerEvents.filter(e => e.type_id === 20 || e.type_id === 21).length || null);

  return {
    playerId,
    teamId: lineupPlayer.team_id,
    rating: getStatValue(details, STAT_TYPE.RATING),
    goals: getStatValue(details, STAT_TYPE.GOALS),
    assists: getStatValue(details, STAT_TYPE.ASSISTS),
    minutesPlayed: getStatValue(details, STAT_TYPE.MINUTES_PLAYED),
    yellowCards,
    redCards,
    shotsOnTarget: getStatValue(details, STAT_TYPE.SHOTS_ON_TARGET),
    passesCompleted: getStatValue(details, STAT_TYPE.ACCURATE_PASSES),
    saves: getStatValue(details, STAT_TYPE.SAVES),
    ownGoals: getStatValue(details, STAT_TYPE.OWN_GOALS),
    jerseyNumber: lineupPlayer.jersey_number || null,
    position: lineupPlayer.position?.name || (lineupPlayer.position_id ? String(lineupPlayer.position_id) : null),
    playerName: lineupPlayer.player_name || lineupPlayer.player?.display_name || null,
  };
}

// ═══════════════════════════════════════
// TEAM MAPPER
// ═══════════════════════════════════════

/**
 * Transforma un equipo de Sportmonks al formato de Prisma Team.
 * @param {object} smTeam - Equipo de Sportmonks
 * @returns {object} - Objeto listo para Prisma upsert
 */
export function mapTeam(smTeam) {
  return {
    externalId: smTeam.id,
    source: 'sportmonks',
    name: smTeam.name,
    code: smTeam.short_code || null,
    logo: smTeam.image_path || null,
    country: smTeam.country?.name || null,
    flag: smTeam.country?.image_path || null,
  };
}

// ═══════════════════════════════════════
// PLAYER MAPPER
// ═══════════════════════════════════════

/**
 * Mapea posición de Sportmonks a las abreviaciones usadas en el proyecto.
 * @param {string} positionName
 * @returns {string} - 'GK' | 'DEF' | 'MID' | 'FWD'
 */
function mapPosition(positionName) {
  if (!positionName) return 'MID';
  const p = positionName.toLowerCase();
  if (p.includes('goalkeeper') || p.includes('portero')) return 'GK';
  if (p.includes('defender') || p.includes('defens')) return 'DEF';
  if (p.includes('midfielder') || p.includes('medio')) return 'MID';
  if (p.includes('attacker') || p.includes('forward') || p.includes('delant')) return 'FWD';
  return 'MID';
}

/**
 * Transforma un jugador de Sportmonks al formato de Prisma Player.
 * @param {object} smPlayer - Jugador de Sportmonks
 * @param {number|null} localTeamId - ID interno del equipo en nuestra BD
 * @returns {object} - Objeto listo para Prisma upsert
 */
export function mapPlayer(smPlayer, localTeamId = null) {
  return {
    externalId: smPlayer.id,
    source: 'sportmonks',
    name: smPlayer.display_name || smPlayer.common_name || smPlayer.name || 'Unknown',
    teamId: localTeamId,
    country: smPlayer.nationality?.name || smPlayer.country?.name || 'Unknown',
    position: mapPosition(smPlayer.position?.name || smPlayer.detailed_position?.name),
    photo: smPlayer.image_path || null,
    number: smPlayer.jersey_number || null,
    age: smPlayer.date_of_birth
      ? Math.floor((Date.now() - new Date(smPlayer.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null,
    nationality: smPlayer.nationality?.name,
    weight: smPlayer.weight,
    height: smPlayer.height,
  };
}

/**
 * Traduce un perfil completo de Sportmonks (+stats, transfers, trophies) 
 * al formato exacto que produce la API-Football para PlayerProfile.jsx.
 */
export function mapPlayerProfileSportmonksToApiFootball(smPlayer) {
  if (!smPlayer) return null;

  const player = {
    id: smPlayer.id,
    name: smPlayer.name || smPlayer.common_name,
    firstname: smPlayer.firstname,
    lastname: smPlayer.lastname,
    age: smPlayer.date_of_birth ? new Date().getFullYear() - new Date(smPlayer.date_of_birth).getFullYear() : null,
    birth: {
      date: smPlayer.date_of_birth,
      place: null,
      country: smPlayer.nationality?.name || smPlayer.country?.name,
    },
    nationality: smPlayer.nationality?.name,
    height: smPlayer.height ? `${smPlayer.height} cm` : null,
    weight: smPlayer.weight ? `${smPlayer.weight} kg` : null,
    photo: smPlayer.image_path,
  };

  // Convertir statistics
  const smStats = smPlayer.statistics || [];
  const statistics = smStats.map(s => {
    // Map data fields from details
    const getStat = (typeId) => s.details?.find(d => d.type_id === typeId)?.value?.total || 0;

    return {
      team: {
        id: s.team_id,
        name: "Equipo",
        logo: null
      },
      league: {
        name: s.season?.league?.name || "Liga",
        season: s.season?.name || "Temporada",
      },
      games: {
        appearences: s.appearences,
        lineups: s.lineups,
        minutes: s.minutes,
        position: smPlayer.position?.name,
        rating: null,
      },
      goals: {
        total: getStat(52),   // GOALS
        conceded: getStat(88), // GOALS_CONCEDED
        assists: getStat(79),  // ASSISTS (era 110=DRIBBLED_PAST)
        saves: getStat(57),    // SAVES (era 87=INJURIES)
      },
      shots: {
        total: getStat(42),    // SHOTS_TOTAL (era 50 inexistente)
        on: getStat(86),       // SHOTS_ON_TARGET
      },
      passes: {
        total: getStat(80),    // PASSES
        key: getStat(117),     // KEY_PASSES (era 85=YELLOWRED_CARDS)
        accuracy: null,
      },
      tackles: {
        total: getStat(78),    // TACKLES (era 84=YELLOWCARDS)
        blocks: getStat(97),   // BLOCKED_SHOTS (era 107=AERIALS_WON)
        interceptions: getStat(100), // INTERCEPTIONS (era 84=YELLOWCARDS)
      },
      duels: {
        total: getStat(105),   // TOTAL_DUELS (era 60 inexistente)
        won: getStat(106),     // DUELS_WON (era 61 inexistente)
      },
      dribbles: {
        attempts: getStat(108), // DRIBBLE_ATTEMPTS (era 53 inexistente)
        success: getStat(109),  // SUCCESSFUL_DRIBBLES (era 54 inexistente)
      },
      fouls: {
        drawn: getStat(96),     // FOULS_DRAWN (era 55 inexistente)
        committed: getStat(56), // FOULS (era 54 inexistente)
      },
      cards: {
        yellow: getStat(84),    // YELLOWCARDS (era 57=SAVES)
        yellowred: getStat(85), // YELLOWRED_CARDS (era 58=SHOTS_BLOCKED)
        red: getStat(83),       // REDCARDS (era 58=SHOTS_BLOCKED)
      },
      penalty: {
        won: null,
        commited: null,
        scored: getStat(47),    // PENALTIES (era 16 inexistente)
        missed: null,
        saved: null,
      }
    };
  });

  // Convert transfers
  const transfers = (smPlayer.transfers || []).map(t => ({
    date: t.date,
    type: t.type === 'buy' ? "Traspaso" : "Préstamo",
    teams: {
      in: { name: t.to_team?.name || "Desconocido", logo: t.to_team?.image_path },
      out: { name: t.from_team?.name || "Desconocido", logo: t.from_team?.image_path },
    }
  }));

  // Convert trophies (if available, otherwise empty)
  const trophies = (smPlayer.trophies || []).map(t => ({
    league: t.league?.name,
    country: t.country?.name,
    season: t.season?.name,
    place: t.status === "Winner" ? "Ganador" : t.status,
  }));

  return {
    stats: { player, statistics },
    transfers,
    trophies,
  };
}

// ═══════════════════════════════════════
// EVENT MAPPER
// ═══════════════════════════════════════

/**
 * Mapea tipo de evento de Sportmonks al formato interno.
 * @param {number} typeId - Type ID del evento en Sportmonks
 * @returns {string}
 */
function mapEventType(typeId) {
  // Common Sportmonks event type IDs
  const eventTypes = {
    14: 'goal',       // Goal
    15: 'goal',       // Own Goal
    16: 'goal',       // Penalty (scored)
    17: 'missed_pen', // Penalty (missed)
    18: 'subst',      // Substitution
    19: 'card',       // Yellow Card
    20: 'card',       // Yellow/Red Card
    21: 'card',       // Red Card
    22: 'var',        // VAR
    24: 'penalty_shootout', // Penalty shootout
  };
  return eventTypes[typeId] || 'other';
}

/**
 * Transforma un evento de partido de Sportmonks al formato de Prisma FixtureEvent.
 * @param {object} smEvent - Evento de Sportmonks
 * @returns {object} - Objeto listo para Prisma create
 */
export function mapEvent(smEvent) {
  return {
    minute: smEvent.minute || 0,
    extraMinute: smEvent.extra_minute || null,
    type: mapEventType(smEvent.type_id),
    detail: smEvent.info || smEvent.addition || null,
    playerName: smEvent.player_name || smEvent.player?.display_name || null,
    assistName: smEvent.related_player_name || smEvent.related_player?.display_name || null,
    teamId: smEvent.participant_id || null,
  };
}
