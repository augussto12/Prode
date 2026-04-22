# Arquitectura de Sincronización — Plataforma Prode & Fantasy

Este documento detalla la infraestructura completa de sincronización de la plataforma, cómo se obtienen los datos desde proveedores externos (Sportmonks y API-Football), cómo se persisten en la base de datos local y cómo se actualizan mediante tareas programadas (Cron Jobs).

---

## 🏗️ 1. Visión General de la Estrategia

El sistema utiliza una arquitectura "Híbrida Caching-Local" diseñada para reducir costos de llamadas a APIs externas y asegurar tiempos de respuesta inmediatos (<50ms) en el Frontend.

**El pipeline de los datos es:**
1. **Cron Jobs** pre-fetchean datos esenciales (partidos, equipos, resultados en vivo) en background de manera periódica.
2. Estos datos se guardan en la **Base de Datos Local (PostgreSQL via Prisma)**.
3. El frontend de la aplicación y el motor de puntajes Fantasy **leen el 90% del tiempo de la base de datos local**.
4. Únicamente datos específicos a demanda (estadísticas en profundidad, historial personal de un jugador) que no justifican persistencia se obtienen de la API en runtime tras pasar por una agresiva caché en memoria (Cache Map).

---

## ⚙️ 2. Motor de Cron Jobs Automáticos

El núcleo del sistema reside en los *jobs* alojados en `server/src/jobs`. 

### A. Datos Estáticos y Rounds (`syncStatic.job.js`)
Se encarga de sincronizar datos que cambian con muy poca frecuencia (planteles, nuevos escudos) y los calendarios completos.
- **Frecuencia:** 
  - *Equipos y Jugadores:* Diario a las **03:00 AM**.
  - *Rounds (Jornadas)*: Semanal, todos los **Lunes a las 04:00 AM**.
- **Acción:**
  - Baja y hace *upsert* de todos los equipos de las ligas habilitadas.
  - Sincroniza planteles completos gradualmente (loteando en partes para no chocar con Rate Limits).
  - Población total de la tabla `SportmonksRound` para toda la temporada activa de las ligas maestras.

### B. Calendario de Partidos - Fixtures (`syncFixtures.job.js`)
Mantiene los partidos a jugar "frescos" con cualquier posible reprogramación o cambio de horario.
- **Frecuencia:** Cada **3 horas**.
- **Acción:**
  - Sincroniza **2 días atrás** (para capturar correcciones post-partido de Sportmonks) **+ hoy + 13 días adelante** = 16 fechas totales iterando por día.
  - En la primera ejecución de cada día, efectúa un sync condicional de `Rounds` para atajar jornadas creadas ese mismo día sin esperar al ciclo semanal.
  - Como tarea secundaria no bloqueante, pre-calienta la cache de `Standings` (Tablas de posiciones) de todas las ligas configuradas.

### C. Live Scores Inteligente (`syncLive.job.js`)
Responsable principal de que la aplicación y los resultados en vivo fluyan en tiempo real sin comer toda la cuota de la API.
- **Frecuencia:** Cada **20 segundos** (Condicional).
- **Circuit Breaker integrado:** Si Sportmonks falla **3 veces consecutivas** (timeout, error de red, etc.), el sistema **pausa automáticamente todas las llamadas por 5 minutos** en lugar de seguir martillando cada 20 segundos un servicio caído. Tras el cooldown, reintenta automáticamente y resetea el contador al primer éxito.
- **Acción:**
  - Verifica en base de datos si existe algún fixture marcado como `isLive: true`, o si hay partidos programados para empezar en los próximos 10 minutos.
  - **SÍ hay partidos**: Consume el endpoint de *Live Inplay* de Sportmonks cada 20 segundos. Actualiza resultados y despacha `Socket.io` al cliente frontend.
  - **NO hay partidos**: Silencio total. No ejecuta peticiones y corta tempranamente.
  - **Disparador Post-Partido**: Cuando el cron detecta que el estado de un partido pasa a "Finalizado" (`FT`, `AET`), pide inmediatamente a la API todas las estadísticas individuales de cada jugador (pases, goles, minutos, atajadas) y engrosa la tabla `PlayerMatchStat`. Adicionalmente, llama al sistema Fantasy para puntear el partido de forma autónoma.

### D. Motor de Puntuación Fantasy (`fantasyScoring.job.js`)
Consume APIs externas únicamente para recuperar stats perdidas.
- **Frecuencia:** 
  - Cada hora entre las **18:00 y las 02:00** (Horario prime time de fútbol sudamericano y cierre europeo).
  - Un barrido maestro diario a las **04:00 AM**.
- **Recovery de Stats Perdidas:** Antes de cada barrido de puntuación, el motor busca fixtures terminados en los últimos 7 días que NO tengan `PlayerMatchStat` (indicando que el `syncLive` falló al recolectar stats post-partido). Para estos partidos huérfanos, re-sincroniza las estadísticas directamente desde Sportmonks (máximo 5 por ciclo para respetar rate limits). Esto cubre crasheos del servidor, timeouts de red, o cualquier interrupción durante la ventana post-partido.
- **Acción de scoring:**
  - Escanea `Fixtures` terminados cuyas `PlayerMatchStats` existan pero los puntajes de los mánagers (`FantasyPlayerScore`) estén ausentes.
  - Procesa sumatorias (Clean Sheets automáticos, goles en contra restan, atajadas), aplica capitán x2 y vicecapitán, impacta historial y recalcula las tablas generales de cada `FantasyTeam`.

### E. Regulador de Fechas Fantasy (`fantasyGameweek.job.js`)
- **Frecuencia:** Cada **5 minutos**.
- **Acción:** 
  - Vigila el reloj y clausura automáticamente el mercado de transferencias en el Backend ni bien cruza la barrera de `startDate` (arranque del primer partido de esa fecha), notificando via websockets.

---

## 📅 3. Manejo de Jornadas ("Rounds") y Fechas
Dado que Sportmonks no maneja las "Fechas" (Gameweeks) atadas orgánicamente a partidos locales, implementamos una recolección forzada.

- **Modelo `SportmonksRound`:** Tabla de la base de datos local donde guardamos las jornadas. 
  - *Campos clave:* `roundId` (Sportmonks ID nativo), `name` (ej. "Fecha 16" o "Semifinal"), `startDate` y `endDate`.
- **Independencia Real:** Los Rounds existen siempre, **aunque no exista una Liga Fantasy** asociada. 
- **Seeding de Gameweeks:** 
  Al preparar la temporada, el endpoint de preparación Fantasy (`/api/admin/fantasy/seed-gameweeks/:leagueId`) consulta `SportmonksRound`, evalúa minuciosamente las fechas de los partidos locales englobados en esa ronda (donde el startDate es la hora exacta del primer partido del round, y el endDate es la hora del último partido + 2hs para dar tiempo al procesamiento de stats), y solo entonces crea el `FantasyGameweek` con cierres y aperturas de mercado 100% seguros y calibrados.
- **Validación de datos:** Si un round no tiene `startDate` en Sportmonks Y tampoco existen fixtures para ese round en la base de datos local, el sistema **salta ese round** en lugar de crear un Gameweek con fechas incorrectas. Esto previene gameweeks fantasma que cerrarían transferencias en momentos erróneos.

---

## 💾 4. Cache Tier y Performance
Para aquellos endpoints que los usuarios consumen pero que no persisten (Por ejemplo: Head-to-Head historico de dos equipos, predicciones crudas de partidos no jugados o tabla de goleadores histórica), la estrategia es:
`Frontend` --> `Express Routes (BD Local)` --> `Cache Intermedio` --> `Llamada Fuerte Sportmonks`

**El Cache Intermedio (`cache.service.js`) provee:**
1. **LRU Básico y Memoria:** Máximo histórico de 500 records en memoria nativa del VPS.
2. **Stampede Protection:** Si 100 usuarios intentan ver la misma tabla vacía de cache intermedio al mismo tiempo en el segundo 0, la petición vuela bloqueada a 1 única llamada en vuelo a la API (in-flight caching), se devuelve y se derrama sobre los otros 99 previniendo un rate-limit catastrófico.
3. **TTLs (Time-To-Live) Modulados:** 
   - Ligas / Equipos (Estático): **24 hs**.
   - Tablas de Standings: **2 hs**.
   - Resultados On-Demand pasados: **10 a 60 min**.

> **Nota importante sobre el Cache:** El cache en memoria se resetea al reiniciar el servidor. Después de cada deploy o reinicio del VPS, los primeros requests de cada endpoint irán directo a la API externa hasta repoblar el cache (máximo 1-2 minutos de calentamiento).

---

## 🕹️ 5. Funciones Panel Administrativo (Trigger Manual)

Todas las acciones auto-guiadas de los Cron Jobs pueden puentearse manualmente de necesitarlo en `Front > Admin > Sistema`.

| Acción Frontend | Controlador (Backend) | Endpoint Asignado |
| :--- | :--- | :--- |
| **Sync Inicial Completo** | `syncInitial` | `/api/admin/sportmonks/sync-initial` |
| **Sync Fixtures Ahora** | `syncFixturesNow` | `/api/admin/sportmonks/sync-fixtures` |
| **Sync Estático Ahora** | `syncStaticNow` | `/api/admin/sportmonks/sync-static` |
| **Sync Rounds (Jornadas)** | `runRoundsSync` | `/api/admin/sportmonks/sync-rounds` |
| *(Tab Fantasy)* **Importar Gwks** | `seedGameweeks` | `/api/admin/fantasy/seed-gameweeks/:id` |

> *Cualquier problema de sincronización visual derivado de cortes en la API externa se resuelve clickeando "Sync Fixtures Ahora" luego de que retorne la estabilidad de red del VPS, o si es algo estructural como una Fecha (Round) nueva sacada de la galera de una federación, presionando "Sync Rounds".*

---

## 🌐 6. API-Football — Estrategia de Datos

A diferencia de Sportmonks, API-Football **NO** persiste datos en la base de datos local. Toda la información de ligas, standings, fixtures y jugadores de API-Football se obtiene en tiempo real con cache en memoria (usando los TTLs definidos en el punto 4).
Los partidos en vivo de API-Football se actualizan cada 30 segundos via polling directamente desde el frontend, sin ningún tipo de persistencia temporal ni permanente en la BD.

---

## 🛡️ 7. Resiliencia y Protección Automática

El sistema cuenta con múltiples capas de protección contra fallos:

| Mecanismo | Dónde | Qué protege |
| :--- | :--- | :--- |
| **Circuit Breaker** | `syncLive.job.js` | 3 fallos consecutivos → pausa 5 min. Evita quemar rate limit contra un servicio caído. |
| **Retry con backoff** | `sportmonksClient.js` | Hasta 2 reintentos por request en 429 (rate limit) y timeouts de red. |
| **Stampede Protection** | `cache.service.js` | Dedup de requests concurrentes al mismo recurso. 1 sola llamada a la API aunque 100 usuarios pidan lo mismo. |
| **Recovery de Stats** | `fantasyScoring.job.js` | Re-descarga stats de partidos que se perdieron por crash/timeout. Máx 5/ciclo, últimos 7 días. |
| **Rate limit logging** | `sportmonksClient.js` | Alertas automáticas cuando quedan <200 y <100 llamadas del plan diario. |
| **Protección isLive** | `syncFixtures.job.js` | Si la API devuelve "scheduled" para un partido que en BD está "live", no sobrescribe (evita caché vieja de Sportmonks). |
| **Validación seed-gameweeks** | `fantasyAdmin.controller.js` | Rounds sin fecha y sin fixtures en BD → skip automático. Nunca crea gameweeks con datos basura. |

---

## 📋 8. Acciones Manuales — Inicio de Temporada

La operación diaria del sistema es 100% automática. Las únicas acciones que requieren intervención manual son las de **preparación de temporada** (1 vez cada 6-12 meses por liga):

| # | Acción | Cuándo | Botón en Panel |
| :--- | :--- | :--- | :--- |
| 1 | Sync Season (descargar fixtures completos) | Al inicio de temporada | Fantasy → PASO 1 |
| 2 | Sync Rounds (poblar jornadas) | Después del paso 1 | Sistema → Sync Rounds |
| 3 | Seed Gameweeks (crear calendario Fantasy) | Después del paso 2 | Fantasy → PASO 2 |
| 4 | Seed Players (importar jugadores Fantasy) | Después del paso 1 | Fantasy → Importar Jugadores |
| 5 | Crear FantasyLeague (configurar liga) | Decisión de negocio | Panel Fantasy |

> **Nota sobre `FANTASY_SEASON_IDS`:** El mapeo de `leagueId → seasonId` en `sportmonks.constants.js` se usa como fallback. El sistema resuelve dinámicamente la temporada actual de Sportmonks mediante `getCurrentSeason()`. Solo se necesita actualizar el hardcoded si la API de Sportmonks falla en el momento del sync.

> **El día a día es completamente autónomo, las cron-tasks lo hacen todo:** equipos, planteles, rounds, fixtures, live scores, scoring Fantasy y cierre de transferencias.
