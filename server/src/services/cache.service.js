/**
 * Cache en memoria con TTL configurable y límite de tamaño (LRU básico).
 * Almacena respuestas de API con expiración automática.
 */

const cache = new Map();
const MAX_CACHE_SIZE = 500; // Máximo 500 entries en cache

// Limpieza periódica cada 5 minutos (evita entries expirados acumulados)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer = null;

function startPeriodicCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now >= entry.expiresAt) cache.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // No bloquear el shutdown del proceso
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Ejecuta fetchFn solo si no hay cache válido para la key.
 * Incluye protección contra cache stampede (in-flight dedup).
 * @param {string} key - Clave única del cache
 * @param {number} ttlSeconds - Tiempo de vida en segundos (0 = sin cache)
 * @param {Function} fetchFn - Función async que obtiene los datos
 */
const inFlight = new Map(); // Requests en vuelo para stampede protection

export async function cachedApiCall(key, ttlSeconds, fetchFn) {
  if (ttlSeconds <= 0) {
    return fetchFn();
  }

  // Arrancar limpieza periódica si no está corriendo
  startPeriodicCleanup();

  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Cache stampede protection: si ya hay un request en vuelo para esta key, esperar
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = fetchFn().then(data => {
    // Evictar si estamos al límite (LRU simple: borrar la entrada más vieja)
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    });

    inFlight.delete(key);
    return data;
  }).catch(err => {
    inFlight.delete(key);
    throw err;
  });

  inFlight.set(key, promise);
  return promise;
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

  return { active, expired, total: cache.size, maxSize: MAX_CACHE_SIZE, inFlight: inFlight.size };
}
