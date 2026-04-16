/**
 * Cache en memoria con TTL configurable.
 * Almacena respuestas de API con expiración automática.
 */

const cache = new Map();

/**
 * Ejecuta fetchFn solo si no hay cache válido para la key.
 * @param {string} key - Clave única del cache
 * @param {number} ttlSeconds - Tiempo de vida en segundos (0 = sin cache)
 * @param {Function} fetchFn - Función async que obtiene los datos
 */
export async function cachedApiCall(key, ttlSeconds, fetchFn) {
  if (ttlSeconds <= 0) {
    return fetchFn();
  }

  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const data = await fetchFn();
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
    createdAt: Date.now(),
  });

  return data;
}

/** Invalidar una key específica */
export function invalidateCache(key) {
  cache.delete(key);
}

/** Invalidar todo el cache que empiece con un prefijo */
export function invalidateCacheByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Stats del cache para debug */
export function getCacheStats() {
  let active = 0;
  let expired = 0;
  const now = Date.now();

  for (const [, entry] of cache) {
    if (now < entry.expiresAt) active++;
    else expired++;
  }

  // Limpiar expirados
  for (const [key, entry] of cache) {
    if (now >= entry.expiresAt) cache.delete(key);
  }

  return { active, expired, total: cache.size };
}
