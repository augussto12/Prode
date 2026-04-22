/**
 * ═══════════════════════════════════════════════════════════════
 * CRON JOB: MOTOR DE PUNTUACIÓN FANTASY
 * ═══════════════════════════════════════════════════════════════
 *
 * Flujo completo:
 *   1. Busca partidos terminados con PlayerMatchStat en BD que
 *      aún no tengan FantasyPlayerScore calculado.
 *   2. Por cada fixture, lee la tabla PlayerMatchStat (datos que
 *      ya bajó syncLive.job.js — SIN llamar a la API de pago).
 *   3. Calcula puntos por categoría para cada jugador.
 *   4. Determina Clean Sheet comparando score del fixture.
 *   5. Upsert en FantasyPlayerScore con desglose.
 *   6. Actualiza totalPoints acumulado en FantasyPlayer.
 *   7. Actualiza points en cada FantasyPick de usuarios.
 *   8. Aplica multiplicadores de Capitán / Vicecapitán.
 *   9. Recalcula totalPoints en FantasyTeam.
 *
 * Frecuencia:
 *   - Cada día a las 04:00 AM (barrido general)
 *   - Cada hora de 18:00 a 02:00 (ventana de partidos)
 *   - También se invoca desde syncLive.job.js al terminar un partido
 *   - Función manual recalculateFixture() para reprocesar correcciones
 */
import cron from 'node-cron';
import prisma from '../config/database.js';
import { calculatePlayerPoints } from '../services/fantasy/fantasyScoring.js';
import { SPORTMONKS_LEAGUE_IDS } from '../constants/sportmonks.constants.js';
import { getFixtureWithPlayerStats } from '../services/sportmonks/sportmonksFixtures.js';
import { mapPlayerMatchStats } from '../utils/sportmonksMapper.js';

// ═══════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════

/**
 * Normaliza posición de Sportmonks al formato canónico.
 * PlayerMatchStat.position puede venir como string de Sportmonks
 * ("Goalkeeper", "Defender", etc.) o como position_id.
 */
function normalizePosition(pos) {
  if (!pos) return 'MID';
  const p = pos.toLowerCase();
  if (p.includes('goalkeeper') || p.includes('gk') || p === '24' || p === '1') return 'GK';
  if (p.includes('defender')   || p.includes('def') || p === '25' || p === '2') return 'DEF';
  if (p.includes('midfielder') || p.includes('mid') || p === '26' || p === '3') return 'MID';
  if (p.includes('attacker')   || p.includes('forward') || p.includes('fwd') || p === '27' || p === '4') return 'FWD';
  return 'MID';
}

/**
 * Determina si un equipo terminó con valla invicta en un fixture.
 * @param {object} fixture - Prisma Fixture con homeScore/awayScore
 * @param {number} teamId - Sportmonks teamId del jugador
 * @returns {boolean}
 */
function isCleanSheet(fixture, teamId) {
  if (fixture.homeScore == null || fixture.awayScore == null) return false;

  // Si el jugador es del equipo local, valla invicta = awayScore === 0
  if (teamId === fixture.homeTeamId) return fixture.awayScore === 0;
  // Si es visitante, valla invicta = homeScore === 0
  if (teamId === fixture.awayTeamId) return fixture.homeScore === 0;

  return false;
}

/**
 * Encuentra el gameweekId de cada FantasyLeague que cubre un fixture,
 * basándose en el rango de fechas del gameweek.
 * Un fixture puede pertenecer a múltiples ligas fantasy privadas.
 *
 * @param {object} fixture - Prisma Fixture
 * @returns {Array<{ fantasyLeagueId: string, gameweekId: string }>}
 */
async function findGameweeksForFixture(fixture) {
  const gameweeks = await prisma.fantasyGameweek.findMany({
    where: {
      fantasyLeague: { leagueId: fixture.leagueId },
      startDate: { lte: fixture.startTime },
      endDate:   { gte: fixture.startTime },
    },
    select: {
      id: true,
      fantasyLeagueId: true,
    },
  });
  return gameweeks;
}

// ═══════════════════════════════════════
// FUNCIÓN PRINCIPAL: RECALCULAR UN FIXTURE
// ═══════════════════════════════════════
const skippedFixturesDueToNoGameweek = new Set();

/**
 * Recalcula TODOS los puntos fantasy para un fixture específico.
 * Es idempotente: puede correrse N veces sin duplicar puntos.
 *
 * @param {string} internalFixtureId - El ID cuid() del fixture en nuestra BD
 * @returns {{ processedPlayers: number, updatedTeams: number }}
 */
export async function recalculateFixture(internalFixtureId) {
  // ── 1. Traer el fixture con sus stats ──
  const fixture = await prisma.fixture.findUnique({
    where: { id: internalFixtureId },
    include: { playerStats: true },
  });

  if (!fixture) {
    console.warn(`[Fantasy Scoring] Fixture ${internalFixtureId} no encontrado en BD.`);
    return { processedPlayers: 0, updatedTeams: 0 };
  }

  if (fixture.playerStats.length === 0) {
    console.log(`[Fantasy Scoring] Fixture ${fixture.externalId} no tiene PlayerMatchStat. Nada que calcular.`);
    return { processedPlayers: 0, updatedTeams: 0 };
  }

  // ── 2. Encontrar gameweeks que cubren este fixture en todas las ligas ──
  const gwMatches = await findGameweeksForFixture(fixture);
  if (gwMatches.length === 0) {
    if (!skippedFixturesDueToNoGameweek.has(internalFixtureId)) {
      console.log(`[Fantasy Scoring] Fixture ${fixture.externalId} (liga ${fixture.leagueId}) no tiene gameweek asociado en ninguna liga fantasy.`);
      skippedFixturesDueToNoGameweek.add(internalFixtureId);
    }
    return { processedPlayers: 0, updatedTeams: 0 };
  }

  let processedPlayers = 0;
  const affectedTeamIds = new Set();

  // ── 3. Calcular puntos por cada jugador que participó ──
  for (const stat of fixture.playerStats) {
    // Resolver posición: preferir la del FantasyPlayer (más confiable)
    const fantasyPlayer = await prisma.fantasyPlayer.findUnique({
      where: { sportmonksId: stat.playerId },
    });
    const position = fantasyPlayer
      ? fantasyPlayer.position
      : normalizePosition(stat.position);

    // Determinar clean sheet
    const cleanSheet = isCleanSheet(fixture, stat.teamId);

    // Calcular puntos
    const pts = calculatePlayerPoints(stat, position, cleanSheet);

    // ── 4. Upsert FantasyPlayerScore para cada gameweek ──
    for (const gw of gwMatches) {
      await prisma.fantasyPlayerScore.upsert({
        where: {
          playerId_fixtureId: {
            playerId: stat.playerId,
            fixtureId: Number(fixture.externalId),
          },
        },
        update: {
          playerName:       stat.playerName || fantasyPlayer?.name || 'Desconocido',
          gameweekId:       gw.id,
          minutesPlayed:    stat.minutesPlayed ?? 0,
          goals:            stat.goals ?? 0,
          assists:          stat.assists ?? 0,
          yellowCards:      stat.yellowCards ?? 0,
          redCards:         stat.redCards ?? 0,
          saves:            stat.saves ?? 0,
          penaltySaves:     0,
          ownGoals:         stat.ownGoals ?? 0,
          shotsOnTarget:    stat.shotsOnTarget ?? 0,
          cleanSheet:       cleanSheet && (stat.minutesPlayed ?? 0) >= 60,
          rating:           stat.rating,
          position,
          pointsGoals:      pts.goals,
          pointsAssists:    pts.assists,
          pointsCards:      pts.cards,
          pointsCleanSheet: pts.cleanSheet,
          pointsSaves:      pts.saves,
          pointsMinutes:    pts.minutes,
          pointsRatingBonus: pts.ratingBonus,
          pointsTotal:      pts.total,
          calculatedAt:     new Date(),
        },
        create: {
          playerId:         stat.playerId,
          playerName:       stat.playerName || fantasyPlayer?.name || 'Desconocido',
          fixtureId:        Number(fixture.externalId),
          gameweekId:       gw.id,
          minutesPlayed:    stat.minutesPlayed ?? 0,
          goals:            stat.goals ?? 0,
          assists:          stat.assists ?? 0,
          yellowCards:      stat.yellowCards ?? 0,
          redCards:         stat.redCards ?? 0,
          saves:            stat.saves ?? 0,
          penaltySaves:     0,
          ownGoals:         stat.ownGoals ?? 0,
          shotsOnTarget:    stat.shotsOnTarget ?? 0,
          cleanSheet:       cleanSheet && (stat.minutesPlayed ?? 0) >= 60,
          rating:           stat.rating,
          position,
          pointsGoals:      pts.goals,
          pointsAssists:    pts.assists,
          pointsCards:      pts.cards,
          pointsCleanSheet: pts.cleanSheet,
          pointsSaves:      pts.saves,
          pointsMinutes:    pts.minutes,
          pointsRatingBonus: pts.ratingBonus,
          pointsTotal:      pts.total,
          calculatedAt:     new Date(),
        },
      });

      // ── 5. Actualizar points en cada FantasyPick que tenga este jugador ──
      // Primero: asegurar que los equipos tengan picks para este GW (arrastre)
      await ensurePicksForGameweek(gw);

      const updatedPicks = await prisma.fantasyPick.findMany({
        where: {
          playerId: stat.playerId,
          gameweekId: gw.id,
        },
        select: { id: true, fantasyTeamId: true },
      });

      for (const pick of updatedPicks) {
        await prisma.fantasyPick.update({
          where: { id: pick.id },
          data: { points: pts.total },
        });
        affectedTeamIds.add(pick.fantasyTeamId);
      }
    }

    processedPlayers++;
  }

  // ── 6. Actualizar totalPoints acumulado en FantasyPlayer ──
  const uniquePlayerIds = [...new Set(fixture.playerStats.map(s => s.playerId))];
  for (const pid of uniquePlayerIds) {
    const allScores = await prisma.fantasyPlayerScore.findMany({
      where: { playerId: pid },
      select: { pointsTotal: true },
    });
    const totalPoints = allScores.reduce((sum, s) => sum + s.pointsTotal, 0);
    const avgPoints   = allScores.length > 0 ? totalPoints / allScores.length : 0;

    await prisma.fantasyPlayer.updateMany({
      where: { sportmonksId: pid },
      data:  { totalPoints, avgPoints: Math.round(avgPoints * 10) / 10 },
    });
  }

  // ── 7. Recalcular totalPoints de cada FantasyTeam afectado ──
  const teamsUpdated = await recalculateTeamTotals([...affectedTeamIds]);

  console.log(
    `[Fantasy Scoring] ✅ Fixture ${fixture.externalId} procesado: ` +
    `${processedPlayers} jugadores, ${teamsUpdated} equipos actualizados.`
  );

  return { processedPlayers, updatedTeams: teamsUpdated };
}

// ═══════════════════════════════════════
// PROPAGACIÓN DE PICKS ENTRE GAMEWEEKS
// ═══════════════════════════════════════

/**
 * Asegura que todos los equipos de una liga fantasy tengan picks
 * para el gameweek dado. Si un equipo no tiene picks para este GW,
 * copia los picks de su gameweek más reciente.
 * Esto permite que el equipo "se arrastre" sin que el usuario
 * tenga que guardar manualmente antes de cada fecha.
 * 
 * @param {object} gameweek - FantasyGameweek de Prisma
 */
const _propagatedGameweeks = new Set();

async function ensurePicksForGameweek(gameweek) {
  // Solo propagar una vez por ejecución del proceso para evitar loops
  if (_propagatedGameweeks.has(gameweek.id)) return;
  _propagatedGameweeks.add(gameweek.id);

  // Todos los equipos de la liga
  const teams = await prisma.fantasyTeam.findMany({
    where: { fantasyLeagueId: gameweek.fantasyLeagueId, status: 'active' },
    select: { id: true },
  });

  for (const team of teams) {
    // ¿Ya tiene picks para este GW?
    const existingCount = await prisma.fantasyPick.count({
      where: { fantasyTeamId: team.id, gameweekId: gameweek.id },
    });

    if (existingCount > 0) continue;

    // Buscar el gameweek más reciente ANTERIOR que tenga picks
    const previousPicks = await prisma.fantasyPick.findMany({
      where: { fantasyTeamId: team.id },
      orderBy: { createdAt: 'desc' },
    });

    if (previousPicks.length === 0) continue;

    // Agrupar por gameweekId y tomar el más reciente
    const latestGwId = previousPicks[0].gameweekId;
    const picksToCopy = previousPicks.filter(p => p.gameweekId === latestGwId);

    // Copiar al nuevo gameweek
    const newPicks = picksToCopy.map(p => ({
      fantasyTeamId: team.id,
      gameweekId: gameweek.id,
      playerId: p.playerId,
      playerName: p.playerName,
      playerPosition: p.playerPosition,
      playerTeamId: p.playerTeamId,
      playerTeamName: p.playerTeamName,
      isCaptain: p.isCaptain,
      isViceCaptain: false,
      isBenched: p.isBenched,
      purchasePrice: p.purchasePrice,
      points: null, // Se calculan en el scoring
    }));

    await prisma.fantasyPick.createMany({ data: newPicks });
    console.log(`[Fantasy Scoring] ↳ Picks propagados: equipo ${team.id} → GW ${gameweek.gameweekNumber} (${newPicks.length} jugadores)`);
  }
}

// ═══════════════════════════════════════
// RECALCULACIÓN DE EQUIPOS
// ═══════════════════════════════════════

/**
 * Recalcula totalPoints de uno o más FantasyTeams.
 * Aplica multiplicador de Capitán (x2).
 *
 * @param {string[]} teamIds - IDs de equipos a recalcular. Si vacío, recalcula todos.
 * @returns {number} cantidad de equipos actualizados
 */
async function recalculateTeamTotals(teamIds = []) {
  const where = teamIds.length > 0 ? { id: { in: teamIds } } : {};

  const teams = await prisma.fantasyTeam.findMany({
    where,
    include: { picks: true },
  });

  let updatedCount = 0;

  for (const team of teams) {
    let totalPoints = 0;

    for (const pick of team.picks) {
      // Solo sumar titulares (no banka)
      if (pick.isBenched) continue;
      if (pick.points == null) continue;

      let pts = pick.points;

      // Capitán x2
      if (pick.isCaptain) {
        pts = Math.round(pts * 2);
      }

      totalPoints += pts;
    }

    await prisma.fantasyTeam.update({
      where: { id: team.id },
      data:  { totalPoints },
    });
    updatedCount++;
  }

  return updatedCount;
}

// ═══════════════════════════════════════
// RECOVERY DE STATS PERDIDAS
// ═══════════════════════════════════════

/**
 * Busca fixtures terminados con stats faltantes o vacías e intenta
 * re-sincronizar desde Sportmonks.
 *
 * Cubre dos casos:
 *   A) Fixtures terminados SIN ningún PlayerMatchStat (crash/timeout)
 *   B) Fixtures terminados CON PlayerMatchStat pero con todos los campos
 *      en null (Sportmonks no había publicado las stats al momento del sync)
 *
 * Máximo 5 por caso por ciclo para no abusar del rate limit.
 */
async function recoverMissingStats() {
  try {
    // ── CASO A: Fixtures sin ningún PlayerMatchStat ──
    const orphanFixtures = await prisma.fixture.findMany({
      where: {
        status: 'finished',
        source: 'sportmonks',
        leagueId: { in: SPORTMONKS_LEAGUE_IDS },
        playerStats: { none: {} },
        startTime: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      take: 5,
      orderBy: { startTime: 'desc' },
    });

    if (orphanFixtures.length > 0) {
      console.log(`[Fantasy Scoring] Stats recovery (huérfanos): ${orphanFixtures.length} partido(s) sin stats...`);
    }

    for (const fixture of orphanFixtures) {
      await _resyncFixtureStats(fixture);
    }

    // ── CASO B: Fixtures con stats vacías (todos null = Sportmonks no había publicado) ──
    const fixturesWithEmptyStats = await prisma.fixture.findMany({
      where: {
        status: 'finished',
        source: 'sportmonks',
        leagueId: { in: SPORTMONKS_LEAGUE_IDS },
        startTime: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        playerStats: {
          some: {
            AND: [
              { goals: null },
              { assists: null },
              { minutesPlayed: null },
              { rating: null },
            ],
          },
        },
      },
      take: 5,
      orderBy: { startTime: 'desc' },
    });

    if (fixturesWithEmptyStats.length > 0) {
      console.log(`[Fantasy Scoring] Stats recovery (vacías): ${fixturesWithEmptyStats.length} partido(s) con stats null...`);
    }

    for (const fixture of fixturesWithEmptyStats) {
      await _resyncFixtureStats(fixture);
    }
  } catch (err) {
    console.error('[Fantasy Scoring] Error en recovery de stats:', err.message);
  }
}

/**
 * Re-sincroniza stats de un fixture individual desde Sportmonks.
 * Reutilizado por ambos casos de recovery (huérfanos y vacíos).
 * @param {object} fixture - Prisma Fixture
 */
async function _resyncFixtureStats(fixture) {
  try {
    const data = await getFixtureWithPlayerStats(fixture.externalId);
    const lineups = data?.data?.lineups || [];
    const events  = data?.data?.events  || [];

    let synced = 0;
    for (const lineupPlayer of lineups) {
      const stats = mapPlayerMatchStats(lineupPlayer, events);
      if (!stats.playerId) continue;

      try {
        await prisma.playerMatchStat.upsert({
          where: {
            fixtureId_playerId: {
              fixtureId: fixture.id,
              playerId: stats.playerId,
            },
          },
          update: { ...stats, updatedAt: new Date() },
          create: { ...stats, fixtureId: fixture.id },
        });
        synced++;
      } catch (e) { /* skip individual stat errors */ }
    }

    if (synced > 0) {
      console.log(`[Fantasy Scoring]   Recovery fixture ${fixture.externalId}: ${synced} stats recuperadas`);
    }

    await new Promise(r => setTimeout(r, 500));
  } catch (err) {
    console.warn(`[Fantasy Scoring]   Recovery fixture ${fixture.externalId} fallo: ${err.message}`);
  }
}

// ═══════════════════════════════════════
// BARRIDO DE FIXTURES PENDIENTES
// ═══════════════════════════════════════

/**
 * Busca todos los fixtures terminados que tengan PlayerMatchStat
 * pero que aún no tengan FantasyPlayerScore, y los procesa.
 * Esto maneja el caso de partidos que se terminaron mientras
 * el servidor estaba apagado.
 */
async function calculatePendingScores() {
  try {
    // Paso 0: Intentar recuperar stats perdidas antes de calcular puntos
    await recoverMissingStats();

    // Obtener fixtures ya calculados
    const alreadyCalculated = await prisma.fantasyPlayerScore.findMany({
      select:   { fixtureId: true },
      distinct: ['fixtureId'],
    });
    const calculatedExternalIds = alreadyCalculated.map(s => String(s.fixtureId));

    // Buscar fixtures terminados con stats que NO estén calculados
    const pendingFixtures = await prisma.fixture.findMany({
      where: {
        status: 'finished',
        source: 'sportmonks',
        leagueId: { in: SPORTMONKS_LEAGUE_IDS },
        playerStats: { some: {} }, // tiene al menos 1 PlayerMatchStat
        externalId: calculatedExternalIds.length > 0
          ? { notIn: calculatedExternalIds }
          : undefined,
      },
      take: 25, // procesar de a 25 max por ciclo para no saturar
      orderBy: { startTime: 'desc' },
    });

    // Excluir los que ya fallaron por falta de gameweek en esta corrida
    const fixturesToProcess = pendingFixtures.filter(f => !skippedFixturesDueToNoGameweek.has(f.id));

    if (fixturesToProcess.length === 0) {
      return;
    }

    console.log(`[Fantasy Scoring] 🔄 ${fixturesToProcess.length} partido(s) pendiente(s) de calcular...`);

    for (const fixture of fixturesToProcess) {
      await recalculateFixture(fixture.id);
      // Respirar 500ms entre fixtures para no saturar la BD
      await new Promise(r => setTimeout(r, 500));
    }

    // Recalcular TODOS los equipos al final del barrido
    await recalculateTeamTotals();

    console.log('[Fantasy Scoring] ✅ Barrido de pendientes completado.');
  } catch (err) {
    console.error('[Fantasy Scoring] ❌ Error en barrido:', err.message);
  }
}

// ═══════════════════════════════════════
// CRON SCHEDULE
// ═══════════════════════════════════════

export function startFantasyScoringJob() {
  // Barrido general a las 04:00 AM todos los días
  cron.schedule('0 4 * * *', async () => {
    console.log('[Fantasy Scoring] ⏰ Barrido diario 04:00 AM...');
    await calculatePendingScores();
  });

  // Ventana de partidos: cada hora de 18:00 a 02:00
  cron.schedule('0 18-23,0-2 * * *', async () => {
    await calculatePendingScores();
  });

  console.log('  ⚽ Fantasy Scoring: programado (diario 04AM + ventana 18-02h)');
}

// Exportar para uso manual y desde syncLive.job.js
export { recalculateTeamTotals, calculatePendingScores };
