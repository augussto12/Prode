/**
 * Helper de coexistencia API-Football / Sportmonks
 * Determina qué fuente de datos usar según la liga.
 */
import { SPORTMONKS_LEAGUE_IDS } from '../constants/sportmonks.constants.js';

// Set para lookup O(1)
const SPORTMONKS_SET = new Set(SPORTMONKS_LEAGUE_IDS);

/**
 * Determina si una liga está cubierta por Sportmonks.
 * @param {number|string} leagueId
 * @returns {boolean}
 */
export function isSportmonksLeague(leagueId) {
  return SPORTMONKS_SET.has(Number(leagueId));
}

/**
 * Determina la fuente de datos a usar para una liga.
 * @param {number|string} leagueId
 * @returns {'sportmonks' | 'api-football'}
 */
export function getSourceForLeague(leagueId) {
  return isSportmonksLeague(leagueId) ? 'sportmonks' : 'api-football';
}

export { SPORTMONKS_LEAGUE_IDS };
