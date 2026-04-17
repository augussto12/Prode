/**
 * Utilidades de sanitización para prevenir XSS.
 * Se usa en mensajes de chat, displayNames, etc.
 */

/**
 * Escapa caracteres HTML peligrosos para prevenir XSS.
 * @param {string} str - Texto a sanitizar
 * @returns {string} Texto con entidades HTML escapadas
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
