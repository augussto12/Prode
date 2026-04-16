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
 * Sync fixtures (partidos): 1 call → guarda/actualiza en tabla Match
 * Ahora cada Match queda asociado a su Competition.
 */
export async function syncFixtures(leagueId = LEAGUE_ID, season = SEASON) {
  const competition = await ensureCompetition(leagueId, season);
  const { response } = await footballApi.fetchFixtures(leagueId, season);

  // Pre-cargar equipos locales para resolver logos
  const localTeams = await prisma.team.findMany();
  const teamMap = new Map(localTeams.map(t => [t.name, t]));

  // Intentar obtener grupo real de cada equipo desde standings (1 call extra)
  let teamToGroup = new Map();
  try {
    const standingsData = await footballApi.fetchStandings(leagueId, season);
    if (standingsData.response?.[0]?.league?.standings) {
      standingsData.response[0].league.standings.forEach(group => {
        const groupName = group[0]?.group || '';
        const localizedGroup = groupName.replace('Group', 'Grupo');
        group.forEach(entry => {
          teamToGroup.set(entry.team.name, localizedGroup);
        });
      });
    }
  } catch (err) {
    console.warn('No se pudieron obtener standings, usando round como stage:', err.message);
  }

  let created = 0;
  let updated = 0;

  for (const item of response) {
    const fix = item.fixture;
    const league = item.league;
    const teams = item.teams;
    const goals = item.goals;

    // Mapear status de la API a nuestro enum
    const statusMap = {
      'NS': 'SCHEDULED', 'TBD': 'SCHEDULED',
      '1H': 'LIVE', '2H': 'LIVE', 'HT': 'LIVE', 'ET': 'LIVE', 'P': 'LIVE', 'BT': 'LIVE', 'LIVE': 'LIVE',
      'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
      'PST': 'POSTPONED', 'SUSP': 'POSTPONED', 'INT': 'POSTPONED',
      'CANC': 'CANCELLED', 'ABD': 'CANCELLED', 'AWD': 'CANCELLED', 'WO': 'CANCELLED',
    };

    const round = league.round || '';
    let stage = round;

    // Si es fase de grupos, usar el grupo real del equipo
    if (round.startsWith('Group Stage') || round.startsWith('Group')) {
      const homeGroup = teamToGroup.get(teams.home.name);
      const awayGroup = teamToGroup.get(teams.away.name);
      stage = homeGroup || awayGroup || round.replace('Group', 'Grupo').replace(/ - \d+$/, '');
    } else if (round.includes('Quarter')) {
      stage = 'Cuartos de Final';
    } else if (round.includes('Semi')) {
      stage = 'Semifinal';
    } else if (round.includes('3rd')) {
      stage = 'Tercer Puesto';
    } else if (round === 'Round of 16') {
      stage = 'Octavos de Final';
    }

    // Buscar logos de equipos locales
    const homeTeamLocal = teamMap.get(teams.home.name);
    const awayTeamLocal = teamMap.get(teams.away.name);

    const data = {
      externalId: fix.id,
      homeTeam: teams.home.name,
      awayTeam: teams.away.name,
      homeFlag: homeTeamLocal?.flag || null,
      awayFlag: awayTeamLocal?.flag || null,
      homeTeamLogo: teams.home.logo || homeTeamLocal?.logo || null,
      awayTeamLogo: teams.away.logo || awayTeamLocal?.logo || null,
      round: round,
      matchDate: new Date(fix.date),
      stage: stage,
      venue: fix.venue ? `${fix.venue.name}, ${fix.venue.city}` : null,
      status: statusMap[fix.status?.short] || 'SCHEDULED',
      homeGoals: goals.home,
      awayGoals: goals.away,
      competitionId: competition.id,
    };

    const existing = await prisma.match.findUnique({
      where: { externalId: fix.id },
    });

    if (existing) {
      await prisma.match.update({ where: { externalId: fix.id }, data });
      updated++;
    } else {
      await prisma.match.create({ data });
      created++;
    }
  }

  return { competitionId: competition.id, competitionName: competition.name, created, updated, total: response.length };
}

/**
 * Sync solo resultados de partidos terminados/en vivo: 1 call.
 * Datos DINÁMICOS — ejecutar durante jornadas.
 */
export async function syncResults(leagueId = LEAGUE_ID, season = SEASON) {
  // Traer fixtures que ya terminaron o están en vivo
  const { response } = await footballApi.fetchFixtures(leagueId, season);

  let updated = 0;

  for (const item of response) {
    const fix = item.fixture;
    const shortStatus = fix.status?.short;

    // Solo actualizar si está en vivo o terminado
    if (!['1H', '2H', 'HT', 'ET', 'FT', 'AET', 'PEN', 'BT', 'P'].includes(shortStatus)) {
      continue;
    }

    const statusMap = {
      '1H': 'LIVE', '2H': 'LIVE', 'HT': 'LIVE', 'ET': 'LIVE', 'P': 'LIVE', 'BT': 'LIVE',
      'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
    };

    const existing = await prisma.match.findUnique({ where: { externalId: fix.id } });
    if (!existing) continue;

    await prisma.match.update({
      where: { externalId: fix.id },
      data: {
        homeGoals: item.goals.home,
        awayGoals: item.goals.away,
        status: statusMap[shortStatus] || existing.status,
      },
    });
    updated++;
  }

  return { updated };
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
