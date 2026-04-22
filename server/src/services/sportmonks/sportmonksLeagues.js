/**
 * Sportmonks — Servicio de Ligas y Temporadas
 * Endpoints para ligas cubiertas, temporadas, rondas y etapas.
 */
import { sportmonksGet } from './sportmonksClient.js';
import { SPORTMONKS_LEAGUE_IDS } from '../../constants/sportmonks.constants.js';

/**
 * Info de todas las ligas cubiertas por Sportmonks.
 */
export async function getCoveredLeagues() {
  return sportmonksGet('/leagues', {
    filters: `leagueIds:${SPORTMONKS_LEAGUE_IDS.join(',')}`,
    include: 'country;currentSeason',
  });
}

/**
 * Temporada actual de una liga específica.
 * @param {number|string} leagueId
 */
export async function getCurrentSeason(leagueId) {
  return sportmonksGet(`/leagues/${leagueId}`, {
    include: 'currentSeason;seasons',
  });
}

/**
 * Rondas de una temporada (para brackets/jornadas).
 * @param {number|string} seasonId
 */
export async function getRoundsBySeason(seasonId) {
  return sportmonksGet(`/rounds/seasons/${seasonId}`);
}

/**
 * Etapas de una temporada (group stage, knockout, etc.)
 * @param {number|string} seasonId
 */
export async function getStagesBySeason(seasonId) {
  return sportmonksGet(`/stages/seasons/${seasonId}`);
}
