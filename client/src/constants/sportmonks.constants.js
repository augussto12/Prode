/**
 * SPORTMONKS SHARED CONSTANTS (Client-side mirror)
 * 
 * Copia de las constantes necesarias del server para el frontend.
 * Si se modifica server/src/constants/sportmonks.constants.js,
 * actualizar este archivo también.
 */

// LEAGUE IDs — Entorno Sportmonks (Ligas cubiertas)
export const SPORTMONKS_LEAGUE_IDS = [636, 642, 645, 8, 564, 384, 241, 243, 2];

// Ligas de API-Football que NO deben renderizarse porque las
// cubre Sportmonks (sirve para merge en Explorer, evita duplicados)
export const AF_LEAGUES_COVERED_BY_SM = new Set([39, 140, 135, 128, 13, 11]);
