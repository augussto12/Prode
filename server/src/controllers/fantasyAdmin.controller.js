import prisma from '../config/database.js';
import { getCurrentSeason, getRoundsBySeason } from '../services/sportmonks/sportmonksLeagues.js';
import { sportmonksGetAll } from '../services/sportmonks/sportmonksClient.js';
import { getFixturesBySeason } from '../services/sportmonks/sportmonksFixtures.js';
import { mapFixture } from '../utils/sportmonksMapper.js';
import { FANTASY_SEASON_IDS } from '../constants/sportmonks.constants.js';

/**
 * Mapeador simple de ID de posición Sportmonks a String
 * 24: Portero (Goalkeeper)
 * 25: Defensa
 * 26: Mediocampista
 * 27: Delantero
 */
function mapPositionIdToString(positionId) {
  if (!positionId) return 'MID'; // Safe fallback
  if (positionId === 24) return 'GK';
  if (positionId === 25) return 'DEF';
  if (positionId === 26) return 'MID';
  if (positionId === 27) return 'FWD';
  // Attempt robust checking if position mapping changes
  const strId = String(positionId);
  if (strId.includes('24') || strId === '1') return 'GK';
  if (strId.includes('25') || strId === '2') return 'DEF';
  if (strId.includes('26') || strId === '3') return 'MID';
  if (strId.includes('27') || strId === '4') return 'FWD';
  return 'MID';
}

/**
 * POST /api/admin/fantasy/seed-players/:leagueId
 */
export async function seedPlayers(req, res) {
  const { leagueId } = req.params;
  const numLeagueId = Number(leagueId);
  try {
    const lg = await getCurrentSeason(numLeagueId);
    if (!lg?.data?.currentseason?.id) {
      return res.status(404).json({ error: 'Temporada actual no encontrada para esta liga' });
    }
    const seasonId = lg.data.currentseason.id;

    console.log(`[Fantasy Admin] Iniciando importación de jugadores para liga ${numLeagueId}, temporada ${seasonId}`);

    // Obtenemos los equipos de la temporada con sus plantillas (players)
    const teamsData = await sportmonksGetAll(`/teams/seasons/${seasonId}`, {
      include: 'players.player.position'
    });

    if (!teamsData || teamsData.length === 0) {
      return res.status(404).json({ error: 'No se encontraron equipos para la temporada' });
    }

    let importedCount = 0;

    for (const team of teamsData) {
      if (!team.players || !Array.isArray(team.players)) continue;

      for (const squadPlayer of team.players) {
        if (!squadPlayer.player) continue;

        const sp = squadPlayer.player;
        const positionStr = mapPositionIdToString(sp.position_id || sp.position?.id);

        // Calcular precio base automático rudimentario (luego puede equilibrarse dinámicamente)
        let basePrice = 5.0;
        if (positionStr === 'FWD') basePrice = 7.5;
        else if (positionStr === 'MID') basePrice = 6.0;
        else if (positionStr === 'DEF') basePrice = 5.0;
        else if (positionStr === 'GK') basePrice = 4.5;

        await prisma.fantasyPlayer.upsert({
          where: { sportmonksId: sp.id },
          create: {
            sportmonksId: sp.id,
            name: sp.name || sp.common_name || 'Desconocido',
            position: positionStr,
            teamId: team.id,
            teamName: team.name,
            leagueId: numLeagueId,
            nationality: sp.nationality?.name || null,
            photoUrl: sp.image_path || null,
            price: basePrice,
            totalPoints: 0,
            avgPoints: 0,
            selectedBy: 0
          },
          update: {
            teamId: team.id,
            teamName: team.name,
            position: positionStr,
            photoUrl: sp.image_path || null
          }
        });
        importedCount++;
      }
    }

    return res.json({ 
      success: true, 
      message: `¡Seeding de jugadores completo!`,
      playersImported: importedCount 
    });
  } catch (error) {
    console.error('[Fantasy Admin] Error seeding players:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/fantasy/sync-season/:leagueId
 * Descarga TODOS los fixtures de la temporada completa desde Sportmonks
 * y los guarda en BD con upsert por externalId+source.
 */
export async function syncSeason(req, res) {
  const { leagueId } = req.params;
  const numLeagueId = Number(leagueId);

  // Resolver seasonId dinámicamente (fallback a hardcoded)
  let seasonId = FANTASY_SEASON_IDS[numLeagueId];
  try {
    const lg = await getCurrentSeason(numLeagueId);
    const dynamicId = lg?.data?.currentseason?.id || lg?.data?.current_season?.id;
    if (dynamicId) seasonId = dynamicId;
  } catch (e) {
    console.warn(`[Fantasy Admin] No se pudo obtener temporada dinámica para liga ${numLeagueId}, usando fallback`);
  }

  if (!seasonId) {
    return res.status(400).json({ error: `No hay seasonId para la liga ${numLeagueId} (ni dinámico ni hardcoded)` });
  }

  const startTime = Date.now();
  let created = 0;
  let updated = 0;
  let pagesProcessed = 0;

  try {
    console.log(`[Fantasy Admin] Iniciando sync completo de temporada ${seasonId} para liga ${numLeagueId}`);

    const { fixtures, pagesProcessed: pages } = await getFixturesBySeason(seasonId);
    pagesProcessed = pages;

    console.log(`[Fantasy Admin] ${fixtures.length} fixtures descargados en ${pages} páginas. Guardando en BD...`);

    // Procesar en batches de 50 para no saturar la BD
    for (let i = 0; i < fixtures.length; i += 50) {
      const batch = fixtures.slice(i, i + 50);
      const results = await Promise.all(batch.map(async (fixture) => {
        try {
          const mapped = mapFixture(fixture);
          const existing = await prisma.fixture.findUnique({
            where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } }
          });

          if (existing) {
            await prisma.fixture.update({ where: { id: existing.id }, data: mapped });
            return 'updated';
          } else {
            await prisma.fixture.create({ data: mapped });
            return 'created';
          }
        } catch (err) {
          console.error(`[Fantasy Admin] Error upserting fixture ${fixture.id}:`, err.message);
          return 'error';
        }
      }));

      created += results.filter(r => r === 'created').length;
      updated += results.filter(r => r === 'updated').length;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[Fantasy Admin] Sync completo: ${fixtures.length} fixtures (${created} creados, ${updated} actualizados) en ${duration}s`);

    return res.json({
      success: true,
      total: fixtures.length,
      created,
      updated,
      pagesProcessed,
      duration: `${duration}s`
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error('[Fantasy Admin] Error en sync season:', error);
    return res.status(500).json({
      error: error.message,
      partialResult: { created, updated, pagesProcessed, duration: `${duration}s` }
    });
  }
}

/**
 * POST /api/admin/fantasy/seed-gameweeks/:leagueId
 * Lee rounds de la BD local (SportmonksRound). Si está vacía, sincroniza on-demand.
 * Si hay FantasyLeagues, crea/actualiza FantasyGameweeks vinculados.
 * Si no hay FantasyLeagues, las rounds quedan guardadas igualmente para uso futuro.
 */
export async function seedGameweeks(req, res) {
  const { leagueId } = req.params;
  const numLeagueId = Number(leagueId);

  try {
    const lg = await getCurrentSeason(numLeagueId);
    if (!lg?.data?.currentseason?.id) {
      return res.status(404).json({ error: 'Temporada actual no encontrada para esta liga' });
    }
    const seasonId = lg.data.currentseason.id;

    console.log(`[Fantasy Admin] Iniciando importación de rondas para liga ${numLeagueId}, temporada ${seasonId}`);

    // 1. Leer rounds de BD local (SportmonksRound)
    let rounds = await prisma.sportmonksRound.findMany({
      where: { leagueId: numLeagueId, seasonId },
      orderBy: { startDate: 'asc' },
    });

    // 2. Si la tabla está vacía, sync on-demand desde la API
    if (rounds.length === 0) {
      console.log(`[Fantasy Admin] SportmonksRound vacía para liga ${numLeagueId} — sincronizando on-demand...`);
      const { syncRoundsForLeague } = await import('../jobs/syncRounds.helper.js');
      const syncResult = await syncRoundsForLeague(numLeagueId);
      
      if (syncResult.total === 0) {
        return res.status(404).json({ error: 'No se encontraron rondas para la temporada' });
      }

      // Re-leer de BD tras sync
      rounds = await prisma.sportmonksRound.findMany({
        where: { leagueId: numLeagueId, seasonId },
        orderBy: { startDate: 'asc' },
      });
    }

    console.log(`[Fantasy Admin] ${rounds.length} rounds encontradas en BD local`);

    // 3. Buscar FantasyLeagues asociadas (pueden no existir)
    const fantasyLeagues = await prisma.fantasyLeague.findMany({
      where: { leagueId: numLeagueId, seasonId: seasonId }
    });

    const now = new Date();
    let stats = { created: 0, updatedNull: 0, updatedExisting: 0 };

    if (fantasyLeagues.length === 0) {
      // Sin ligas fantasy — las rounds ya están persistidas, retornamos éxito
      return res.json({ 
        success: true, 
        message: `${rounds.length} rounds sincronizadas en SportmonksRound. No hay ligas Fantasy creadas para vincular gameweeks aún.`,
        roundsFound: rounds.length,
        stats,
        affectedLeagues: []
      });
    }

    // 4. Crear/actualizar FantasyGameweeks para cada FantasyLeague
    for (const fl of fantasyLeagues) {
      const existingGWs = await prisma.fantasyGameweek.findMany({ where: { fantasyLeagueId: fl.id } });

      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        
        let start = round.startDate ? new Date(round.startDate) : null;
        let end = round.endDate ? new Date(round.endDate) : null;

        // Buscar fixtures en BD local para calcular fechas precisas
        const fixtureWhere = {
          source: 'sportmonks',
          leagueId: numLeagueId,
          seasonId: seasonId,
          round: round.name || String(round.roundId),
        };

        // Si tenemos fechas del round, acotar la búsqueda con buffer
        if (start && end) {
          const searchStart = new Date(start);
          searchStart.setDate(searchStart.getDate() - 2);
          const searchEnd = new Date(end);
          searchEnd.setDate(searchEnd.getDate() + 3);
          fixtureWhere.startTime = { gte: searchStart, lte: searchEnd };
        }

        const localFixtures = await prisma.fixture.findMany({
          where: fixtureWhere,
          orderBy: { startTime: 'asc' }
        });

        if (localFixtures.length > 0) {
          start = localFixtures[0].startTime;
          end = new Date(localFixtures[localFixtures.length - 1].startTime.getTime() + 2 * 60 * 60 * 1000);
        }

        // Si no tenemos fecha del round NI fixtures en BD → skip (no crear GW con fecha basura)
        if (!start || !end) {
          console.warn(`[Fantasy Admin] Round "${round.name}" (${round.roundId}): sin fecha y sin fixtures en BD — skip`);
          continue;
        }
        
        const isActive = now >= start && now <= end;
        const isFinished = now > end;

        const existingMatch = existingGWs.find(g => g.gameweekNumber === i + 1);

        if (!existingMatch) {
           stats.created++;
        } else if (!existingMatch.roundId) {
           stats.updatedNull++;
        } else {
           stats.updatedExisting++;
        }

        await prisma.fantasyGameweek.upsert({
          where: {
            fantasyLeagueId_gameweekNumber: {
              fantasyLeagueId: fl.id,
              gameweekNumber: i + 1
            }
          },
          create: {
            fantasyLeagueId: fl.id,
            gameweekNumber: i + 1,
            roundId: round.roundId,
            startDate: start,
            endDate: end,
            isActive: isActive,
            isFinished: isFinished,
            transfersOpen: !isActive
          },
          update: {
            roundId: round.roundId,
            startDate: start,
            endDate: end,
            isActive: isActive,
            isFinished: isFinished,
          }
        });
      }
    }

    return res.json({ 
      success: true, 
      message: `¡Seeding de gameweeks completo!`,
      roundsFound: rounds.length,
      stats,
      affectedLeagues: fantasyLeagues.map(l => l.name)
    });

  } catch (error) {
    console.error('[Fantasy Admin] Error seeding gameweeks:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/admin/fantasy/status
 */
import { resolveGameweekContext } from './fantasy.controller.js';

export async function getStatus(req, res) {
  try {
    const playersCount = await prisma.fantasyPlayer.count();
    const activeGameweek = await prisma.fantasyGameweek.findFirst({
      where: { isActive: true },
      orderBy: { startDate: 'desc' }
    });
    
    const totalTeams = await prisma.fantasyTeam.count();
    const totalLeagues = await prisma.fantasyLeague.count();

    const leagues = await prisma.fantasyLeague.findMany();
    const leaguesContext = [];

    for (const lg of leagues) {
       const ctx = await resolveGameweekContext(lg.id);
       let fixtures = [];
       if (ctx.gameweek) {
         fixtures = await prisma.fixture.findMany({
           where: {
             source: 'sportmonks',
             leagueId: lg.leagueId,
             startTime: {
               gte: ctx.gameweek.startDate,
               lte: ctx.gameweek.endDate
             }
           },
           orderBy: { startTime: 'asc' },
           select: { homeTeamId: true, awayTeamId: true, startTime: true, status: true, homeScore: true, awayScore: true }
         });
       }
       leaguesContext.push({
         leagueDetails: lg,
         context: ctx,
         fixtures
       });
    }

    res.json({
       playersCount,
       activeGameweek,
       totalTeams,
       totalLeagues,
       leaguesContext
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * PUT /api/admin/fantasy/gameweeks/:id/activate
 */
export async function forceActivateGameweek(req, res) {
  const { id } = req.params;
  try {
    const gameweek = await prisma.fantasyGameweek.findUnique({
      where: { id }
    });
    
    if (!gameweek) return res.status(404).json({ error: 'Gameweek no encontrado' });

    // Desactivar todos los demás gameweeks de ESA liga
    await prisma.fantasyGameweek.updateMany({
       where: { fantasyLeagueId: gameweek.fantasyLeagueId, id: { not: gameweek.id } },
       data: { isActive: false, transfersOpen: false }
    });

    // Activar el deseado y abrir/cerrar traspasos según se indique
    // Por simplicidad, forzar activación abre el mercado si no empezó
    const now = new Date();
    const transfersOpen = gameweek.startDate > now;

    const activated = await prisma.fantasyGameweek.update({
       where: { id },
       data: { isActive: true, transfersOpen }
    });

    res.json({ success: true, gameweek: activated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
