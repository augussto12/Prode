/**
 * Sportmonks — Servicio de Standings (Tablas de Posiciones)
 * Endpoints para standings por temporada y en vivo.
 */
import { sportmonksGet } from './sportmonksClient.js';

/**
 * Tabla de posiciones de una temporada.
 * @param {number|string} seasonId
 */
export async function getStandingsBySeason(seasonId) {
  return sportmonksGet(`/standings/seasons/${seasonId}`, {
    include: 'participant;rule;form',
  });
}

/**
 * Standings en vivo (se actualiza durante los partidos).
 * @param {number|string} leagueId
 */
export async function getLiveStandings(leagueId) {
  return sportmonksGet(`/standings/live/leagues/${leagueId}`, {
    include: 'participant',
  });
}
