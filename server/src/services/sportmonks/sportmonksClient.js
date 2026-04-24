/**
 * Cliente base para Sportmonks API v3
 * Usa fetch nativo de Node.js (consistente con el resto del proyecto).
 * Maneja autenticación via api_token, rate limit logging y retry en 429.
 */

const BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';
const API_KEY = process.env.SPORTMONKS_API_KEY;

// Retry config
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

export let sportmonksRateLimit = { remaining: null, resetsIn: null, updatedAt: null };

/**
 * Construir URL con parámetros, incluyendo api_token
 */
function buildUrl(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_token', API_KEY || '');
  url.searchParams.set('locale', 'es'); // Inyectar español por defecto para traducir entidades estáticas

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Sleep helper para retry/rate limit
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Función base para hacer requests a Sportmonks con includes y filtros.
 * Incluye retry automático en 429 (rate limit) y logging de cuota restante.
 *
 * @param {string} endpoint - ej: '/fixtures/live', '/leagues'
 * @param {object} params - params adicionales (include, filters, per_page, etc.)
 * @returns {Promise<object>} - Respuesta de Sportmonks (data, pagination, rate_limit, etc.)
 */
export async function sportmonksGet(endpoint, params = {}) {
  const url = buildUrl(endpoint, params);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(45000), // 45s timeout for heavy relational payloads
      });

      // Handle rate limit
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? Number(retryAfter) * 1000 : RETRY_DELAY_MS * (attempt + 1);
        console.warn(`[Sportmonks] Rate limit excedido (429). Reintentando en ${waitMs}ms... (intento ${attempt + 1}/${MAX_RETRIES})`);

        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        throw new Error(`[Sportmonks] Rate limit excedido después de ${MAX_RETRIES} reintentos`);
      }

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`[Sportmonks] HTTP ${res.status} en ${endpoint}: ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json();

      // Log rate limit restante
      const remaining = data?.rate_limit?.remaining;

      if (data?.rate_limit) {
        sportmonksRateLimit = {
          remaining: data.rate_limit.remaining,
          resetsIn: data.rate_limit.resets_in_seconds,
          updatedAt: new Date()
        };
      }

      if (remaining !== undefined) {
        if (remaining < 100) {
          console.error(`[Sportmonks] ⚠️ Rate limit MUY bajo: ${remaining} llamadas restantes`);
        } else if (remaining < 200) {
          console.warn(`[Sportmonks] Rate limit bajo: ${remaining} llamadas restantes`);
        }
      }

      return data;
    } catch (error) {
      // Don't retry on non-429 errors
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.error(`[Sportmonks] Timeout en ${endpoint} (intento ${attempt + 1})`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
      }

      if (attempt === MAX_RETRIES || (error.message && !error.message.includes('429'))) {
        console.error(`[Sportmonks] Error en ${endpoint}:`, error.message);
        throw error;
      }
    }
  }
}

/**
 * Variante de sportmonksGet que pagina automáticamente y devuelve todos los resultados.
 * Útil para endpoints que pueden tener más de una página (fixtures de temporada, etc.)
 *
 * @param {string} endpoint
 * @param {object} params
 * @returns {Promise<Array>} - Array con todos los items de todas las páginas
 */
export async function sportmonksGetAll(endpoint, params = {}) {
  const allData = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await sportmonksGet(endpoint, { ...params, page });
    const items = response?.data || [];
    allData.push(...items);

    // Check if there are more pages
    const pagination = response?.pagination;
    if (pagination && pagination.has_more) {
      page++;
      // Small delay between pages to be kind to rate limit
      await sleep(300);
    } else {
      hasMore = false;
    }
  }

  return allData;
}
