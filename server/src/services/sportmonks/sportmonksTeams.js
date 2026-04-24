/**
 * Sportmonks — Servicio de Equipos
 * Endpoints para equipos por temporada, detalle y estadísticas.
 */
import { sportmonksGet } from './sportmonksClient.js';

/**
 * Equipos de una temporada/liga.
 * @param {number|string} seasonId
 */
export async function getTeamsBySeason(seasonId) {
  return sportmonksGet(`/teams/seasons/${seasonId}`, {
    include: 'venue;coaches;players',
  });
}

/**
 * Datos de un equipo específico.
 * @param {number|string} teamId
 */
export async function getTeamById(teamId) {
  return sportmonksGet(`/teams/${teamId}`, {
    include: 'statistics.details;statistics.season.league;trophies.league;trophies.season;country;venue;coaches.coach;players.player;latest.participants;latest.scores;upcoming.participants;seasons.league;activeSeasons;sidelined.player',
  });
}

/**
 * Estadísticas del equipo en una temporada.
 * @param {number|string} teamId
 * @param {number|string} seasonId
 */
export async function getTeamSeasonStats(teamId, seasonId) {
  return sportmonksGet(`/statistics/seasons/teams/${teamId}`, {
    filters: `statisticSeasons:${seasonId}`,
  });
}
