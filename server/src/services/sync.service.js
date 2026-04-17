/**
 * Servicio de sincronización: baja datos de la API Football y los guarda en BD.
 * Estrategia: datos estáticos se sincronizan UNA vez, dinámicos periódicamente.
 * 
 * MULTI-LIGA: Cada sync ahora crea/busca la Competition y asocia todo con competitionId.
 */
import prisma from '../config/database.js';
import * as footballApi from './football-api.service.js';

const LEAGUE_ID = Number(process.env.FOOTBALL_LEAGUE_ID) || 1;
const SEASON = Number(process.env.FOOTBALL_SEASON) || 2022;

/**
 * Busca o crea la Competition en BD a partir de los datos de la liga.
 * Retorna el registro Competition con su id interno.
 */
async function ensureCompetition(leagueId, season) {
  // Intentar upsert por externalId + season
  let competition = await prisma.competition.findUnique({
    where: { externalId_season: { externalId: leagueId, season } },
  });

  if (!competition) {
    // Intentar obtener nombre/logo de la API (si falla, usar genérico)
    let name = `Liga ${leagueId}`;
    let logo = null;
    try {
      const standingsData = await footballApi.fetchStandings(leagueId, season);
      const leagueInfo = standingsData.response?.[0]?.league;
      if (leagueInfo) {
        name = leagueInfo.name;
        logo = leagueInfo.logo;
      }
    } catch (err) {
      console.warn('No se pudo obtener info de liga, usando nombre genérico:', err.message);
    }

    competition = await prisma.competition.create({
      data: { externalId: leagueId, name, logo, season },
    });
  }

  return competition;
}

/**
 * Sync equipos: 1 call a la API → guarda en tabla Team
 * Datos ESTÁTICOS — se ejecuta una vez.
 */
export async function syncTeams(leagueId = LEAGUE_ID, season = SEASON) {
  // Asegurar que la Competition existe
  const competition = await ensureCompetition(leagueId, season);

  const { response } = await footballApi.fetchTeams(leagueId, season);

  let created = 0;
  let updated = 0;

  for (const item of response) {
    const team = item.team;
    const existing = await prisma.team.findUnique({
      where: { externalId: team.id },
    });

    const data = {
      externalId: team.id,
      name: team.name,
      code: team.code,
      logo: team.logo,
      country: team.country || item.venue?.city || null,
      flag: team.national ? `https://media.api-sports.io/flags/${team.code?.toLowerCase()}.svg` : null,
    };

    if (existing) {
      await prisma.team.update({ where: { externalId: team.id }, data });
      updated++;
    } else {
      await prisma.team.create({ data });
      created++;
    }
  }

  return { competitionId: competition.id, competitionName: competition.name, created, updated, total: response.length };
}


/**
 * Sync plantel de UN equipo: 1 call por equipo.
 * Datos ESTÁTICOS — se ejecuta una vez por equipo.
 * Ahora crea PlayerCompetitionStats vacío para el torneo indicado.
 */
export async function syncSquad(teamExternalId, competitionId = null) {
  const { response } = await footballApi.fetchSquad(teamExternalId);

  if (!response || response.length === 0) {
    return { created: 0, updated: 0 };
  }

  // Buscar nuestro Team local para linkear via FK
  const localTeam = await prisma.team.findUnique({ where: { externalId: teamExternalId } });

  const squadData = response[0];
  const teamName = squadData.team?.name || 'Unknown';
  const players = squadData.players || [];

  let created = 0;
  let updated = 0;

  for (const p of players) {
    const posMap = { 'Goalkeeper': 'GK', 'Defender': 'DEF', 'Midfielder': 'MID', 'Attacker': 'FWD' };

    const data = {
      externalId: p.id,
      name: p.name,
      teamId: localTeam?.id || null,
      country: teamName,
      position: posMap[p.position] || 'MID',
      photo: p.photo || null,
      number: p.number || null,
      age: p.age || null,
    };

    const existing = await prisma.player.findUnique({ where: { externalId: p.id } });

    let playerId;
    if (existing) {
      await prisma.player.update({ where: { externalId: p.id }, data });
      playerId = existing.id;
      updated++;
    } else {
      const newPlayer = await prisma.player.create({ data });
      playerId = newPlayer.id;
      created++;
    }

    // Crear PlayerCompetitionStats vacío si tenemos competitionId
    if (competitionId) {
      await prisma.playerCompetitionStats.upsert({
        where: { playerId_competitionId: { playerId, competitionId } },
        update: {}, // No sobreescribir stats existentes
        create: { playerId, competitionId },
      });
    }
  }

  return { team: teamName, created, updated, total: players.length };
}

/**
 * Sync planteles de TODOS los equipos guardados en BD.
 * Opción batch para no exceder cuota.
 * Skipea equipos que ya tienen jugadores linkeados.
 */
export async function syncAllSquads(batchSize = 10, competitionId = null) {
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });
  
  // Filtrar equipos que ya tienen jugadores
  const teamsWithPlayerCount = await Promise.all(
    teams.map(async t => ({
      ...t,
      playerCount: await prisma.player.count({ where: { teamId: t.id } }),
    }))
  );
  const pendingTeams = teamsWithPlayerCount.filter(t => t.playerCount === 0);
  
  const results = [];
  const batch = pendingTeams.slice(0, batchSize);

  for (const team of batch) {
    try {
      const result = await syncSquad(team.externalId, competitionId);
      results.push(result);
      // Pausa de 1s entre calls para respetar rate limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      results.push({ team: team.name, error: err.message });
    }
  }

  return {
    synced: results.length,
    totalTeams: teams.length,
    pendingTeams: pendingTeams.length,
    remaining: pendingTeams.length - batch.length,
    results,
  };
}

/**
 * Sync detalle de un partido: events + statistics.
 * Se ejecuta bajo demanda y se cachea en BD para siempre.
 * Cuesta 2 calls la primera vez, 0 después.
 */
export async function syncMatchDetail(matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { events: true },
  });

  if (!match) throw new Error('Partido no encontrado');
  if (!match.externalId) throw new Error('Partido sin ID externo');

  // Si ya tiene eventos cacheados, devolver de BD
  if (match.events.length > 0 && match.statistics) {
    return { cached: true, events: match.events, statistics: match.statistics };
  }

  // Solo cachear si el partido ya terminó
  if (match.status !== 'FINISHED') {
    return { cached: false, events: [], statistics: null, message: 'Partido no finalizado aún' };
  }

  // Fetch events (1 call)
  const eventsData = await footballApi.fetchFixtureById(match.externalId);
  // Fetch stats (1 call) 
  const statsData = await footballApi.fetchFixtureStats(match.externalId);

  // Guardar eventos
  const apiEvents = eventsData.response?.[0]?.events || [];
  if (apiEvents.length > 0) {
    // Borrar eventos previos si existían
    await prisma.matchEvent.deleteMany({ where: { matchId } });
    
    await prisma.matchEvent.createMany({
      data: apiEvents.map(e => ({
        matchId,
        elapsed: e.time.elapsed || 0,
        extraTime: e.time.extra || null,
        teamName: e.team.name,
        teamLogo: e.team.logo || null,
        type: e.type,
        detail: e.detail,
        playerName: e.player?.name || null,
        assistName: e.assist?.name || null,
      })),
    });
  }

  // Guardar statistics como JSON
  const statsJson = {};
  statsData.response?.forEach(team => {
    statsJson[team.team.name] = {};
    team.statistics?.forEach(s => {
      statsJson[team.team.name][s.type] = s.value;
    });
  });

  await prisma.match.update({
    where: { id: matchId },
    data: { statistics: statsJson },
  });

  // Devolver datos frescos
  const savedEvents = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: { elapsed: 'asc' },
  });

  return { cached: false, events: savedEvents, statistics: statsJson };
}

/** Obtener status de la cuota de API */
export async function getApiStatus() {
  const status = await footballApi.fetchAccountStatus();
  return status;
}
