// Global position translations for Spanish UI
const POSITION_MAP = {
  'GK': 'POR',
  'DEF': 'DEF',
  'MID': 'MED',
  'FWD': 'DEL',
  'ATT': 'DEL',
  'Goalkeeper': 'Portero',
  'Defender': 'Defensor',
  'Midfielder': 'Mediocampista',
  'Attacker': 'Delantero',
};

const POSITION_FILTER_MAP = {
  '': 'Todos',
  'GK': 'POR',
  'DEF': 'DEF',
  'MID': 'MED',
  'FWD': 'DEL',
};

/**
 * Translate a position code to Spanish
 * @param {string} pos - English position code (GK, DEF, MID, FWD, ATT, etc)
 * @returns {string} Spanish translation
 */
export function translatePosition(pos) {
  if (!pos) return '';
  return POSITION_MAP[pos] || pos;
}

/**
 * Translate filter label to Spanish
 * @param {string} pos - Position filter value ('' for all)
 * @returns {string} Spanish label
 */
export function translateFilterLabel(pos) {
  return POSITION_FILTER_MAP[pos] ?? pos;
}

export default translatePosition;
