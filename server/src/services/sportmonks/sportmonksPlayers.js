/**
 * Sportmonks — Servicio de Jugadores y Ratings
 * Endpoints para stats individuales, plantillas y goleadores.
 */
import { sportmonksGet } from './sportmonksClient.js';

/**
 * Stats de TODOS los jugadores en un partido (para calcular puntos de fantasy/prode).
 * Esta es la llamada más importante para el sistema de prode/fantasy.
 * @param {number|string} fixtureId
 */
export async function getAllPlayerStatsInMatch(fixtureId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'lineups.player.statistics;lineups.player.details;lineups.details',
  });
}

/**
 * Stats de un jugador en un partido específico.
 * @param {number|string} fixtureId
 * @param {number|string} playerId
 */
export async function getPlayerMatchStats(fixtureId, playerId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'lineups.player.statistics;lineups.player.details',
    filters: `fixtureParticipants:${playerId}`,
  });
}

/**
 * Plantilla de un equipo con datos de jugadores.
 * @param {number|string} teamId
 */
export async function getSquadByTeam(teamId) {
  return sportmonksGet(`/squads/teams/${teamId}`, {
    include: 'player.statistics;player.position',
  });
}

/**
 * Datos de un jugador específico con stats completas.
 * @param {number|string} playerId
 */
export async function getPlayerById(playerId) {
  // Heavy initial payload focused only on core details and season/team relational statistics
  return sportmonksGet(`/players/${playerId}`, {
    include: 'country;city;nationality;teams;statistics.details;statistics.season.league;statistics.team;position;detailedPosition;lineups;latest;metadata',
  });
}

/**
 * Datos de trofeos de un jugador específico.
 * @param {number|string} playerId
 */
export async function getPlayerTrophies(playerId) {
  return sportmonksGet(`/players/${playerId}`, {
    include: 'trophies.trophy;trophies.league;trophies.season'
  });
}

/**
 * Datos de transferencias de un jugador específico.
 * @param {number|string} playerId
 */
export async function getPlayerTransfers(playerId) {
  return sportmonksGet(`/players/${playerId}`, {
    include: 'transfers.fromTeam;transfers.toTeam'
  });
}

/**
 * Topscorers de una temporada.
 * @param {number|string} seasonId
 */
export async function getTopScorers(seasonId) {
  return sportmonksGet(`/topscorers/seasons/${seasonId}`, {
    include: 'player;participant',
  });
}
