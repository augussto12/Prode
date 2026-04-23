import prisma from '../config/database.js';
import { recalculateFixture, recalculateTeamTotals, calculatePendingScores } from '../jobs/fantasyScoring.job.js';
import { getCurrentSeason } from '../services/sportmonks/sportmonksLeagues.js';

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * LIGAS FANTASY
 */
export async function getAvailableLeagues(req, res) {
  // Ligas disponibles 636, 8, 564, 384 mapped by the platform's standard approach
  // We can just return standard active fantasy leagues that the user is NOT a part of?
  // The spec says "Ligas disponibles (636, 8, 564, 384)" -> these are real world leagues to create private leagues for.
  const leagues = [
    { id: 636, name: 'Liga Profesional Argentina' },
    { id: 8, name: 'Premier League' },
    { id: 564, name: 'La Liga' },
    { id: 384, name: 'Serie A' }
  ];
  return res.json(leagues);
}

export async function createFantasyLeague(req, res) {
  const { name, leagueId, maxTeams, description } = req.body;
  const userId = req.user.id; // assuming auth middleware sets req.user.userId

  try {
    const lg = await getCurrentSeason(Number(leagueId));
    if (!lg?.data?.currentseason?.id) {
       return res.status(400).json({ error: 'La liga real seleccionada no tiene temporada activa en Sportmonks' });
    }
    const seasonId = lg.data.currentseason.id;

    // Límite de 3 ligas creadas por usuario
    const ownedLeaguesCount = await prisma.fantasyLeague.count({
      where: { ownerId: userId }
    });
    
    if (ownedLeaguesCount >= 3) {
      return res.status(400).json({ error: 'Límite alcanzado: solo podés crear un máximo de 3 ligas.' });
    }

    const league = await prisma.fantasyLeague.create({
      data: {
        name,
        description,
        code: generateInviteCode(),
        ownerId: userId,
        leagueId: Number(leagueId),
        seasonId,
        maxTeams: maxTeams || 20
      }
    });

    // Also auto-join the owner
    const team = await prisma.fantasyTeam.create({
      data: {
        userId,
        fantasyLeagueId: league.id,
        name: `${req.user.username}'s Team`
      }
    });

    // Auto-create initial Gameweek to allow drafts instantly
    await prisma.fantasyGameweek.create({
       data: {
          fantasyLeagueId: league.id,
          gameweekNumber: 1,
          startDate: new Date(),
          endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // +7 days
          isActive: true,
          transfersOpen: true
       }
    });

    return res.status(201).json({ league, team });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getLeagueByCode(req, res) {
  try {
    const league = await prisma.fantasyLeague.findUnique({
      where: { code: req.params.code }
    });
    if (!league) return res.status(404).json({ error: 'Liga no encontrada' });
    return res.json(league);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function joinLeague(req, res) {
  const { code } = req.params;
  const userId = req.user.id;
  const { teamName } = req.body;

  try {
    const league = await prisma.fantasyLeague.findUnique({
      where: { code },
      include: { _count: { select: { teams: true } } }
    });

    if (!league) return res.status(404).json({ error: 'Liga no encontrada' });
    
    if (league.status !== 'active') {
       return res.status(400).json({ error: 'La liga no está activa' });
    }

    if (league._count.teams >= league.maxTeams) {
       return res.status(400).json({ error: 'La liga está llena' });
    }

    const existingTeam = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: league.id } }
    });

    if (existingTeam) {
       return res.status(400).json({ error: 'Ya estás en esta liga' });
    }

    const team = await prisma.fantasyTeam.create({
      data: {
        userId,
        fantasyLeagueId: league.id,
        name: teamName || `Equipo de ${req.user.username}`
      }
    });

    return res.json({ team, league });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getLeagueStandings(req, res) {
  try {
    const teams = await prisma.fantasyTeam.findMany({
      where: { fantasyLeagueId: req.params.id, status: 'active' }, // Filtro de baneados
      orderBy: { totalPoints: 'desc' },
      include: { user: { select: { username: true, displayName: true, avatar: true } } }
    });
    
    // Enrich with position rank
    const standings = teams.map((t, idx) => ({ ...t, rank: idx + 1 }));
    return res.json(standings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

const REAL_LEAGUES = {
  636: "Liga Profesional Argentina",
  8: "Premier League",
  564: "La Liga",
  384: "Serie A"
};

export async function getLeagueDetails(req, res) {
  try {
    const league = await prisma.fantasyLeague.findUnique({
      where: { id: req.params.id },
      include: {
         teams: {
            include: { user: { select: { username: true } } }
         }
      }
    });
    if (!league) return res.status(404).json({ error: 'Liga no encontrada' });
    
    // Si NO es el owner, ocultamos los equipos baneados de los detalles
    if (league.ownerId !== req.user.id) {
       league.teams = league.teams.filter(t => t.status === 'active');
    }

    return res.json({
       ...league,
       realLeagueName: REAL_LEAGUES[league.leagueId] || 'Liga Desconocida'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getMyLeagues(req, res) {
  const userId = req.user.id;
  try {
    const teams = await prisma.fantasyTeam.findMany({
      where: { userId },
      include: {
        fantasyLeague: true
      }
    });
    
    const leagues = teams.map(t => ({
      ...t.fantasyLeague,
      realLeagueName: REAL_LEAGUES[t.fantasyLeague.leagueId] || 'Liga Desconocida',
      teamStatus: t.status,
      teamId: t.id
    }));
    
    return res.json(leagues);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function banTeam(req, res) {
  const userId = req.user.id;
  const { id, teamId } = req.params;
  
  try {
    // Verificar propiedad
    const league = await prisma.fantasyLeague.findUnique({ where: { id } });
    if (!league) return res.status(404).json({ error: 'Liga no encontrada.' });
    if (league.ownerId !== userId) return res.status(403).json({ error: 'No autorizado, no sos el dueño.' });

    // Banear team
    await prisma.fantasyTeam.update({
      where: { id: teamId },
      data: { status: 'frozen' }
    });
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function unbanTeam(req, res) {
  const userId = req.user.id;
  const { id, teamId } = req.params;
  
  try {
    const league = await prisma.fantasyLeague.findUnique({ where: { id } });
    if (!league) return res.status(404).json({ error: 'Liga no encontrada.' });
    if (league.ownerId !== userId) return res.status(403).json({ error: 'No autorizado, no sos el dueño.' });

    await prisma.fantasyTeam.update({
      where: { id: teamId },
      data: { status: 'active' }
    });
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * EQUIPO DEL USUARIO
 */
export async function getMyTeam(req, res) {
  const userId = req.user.id;
  const { leagueId } = req.params;

  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: leagueId } },
      include: { picks: true }
    });

    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });

    // Devolver los picks del gameweek más reciente (el equipo se "arrastra")
    if (team.picks && team.picks.length > 0) {
      // Find the latest gameweek that has picks
      const gwIds = [...new Set(team.picks.map(p => p.gameweekId))];
      const gameweeks = await prisma.fantasyGameweek.findMany({
        where: { id: { in: gwIds } },
        orderBy: { startDate: 'desc' }
      });
      const latestGwId = gameweeks[0]?.id;
      if (latestGwId) {
        team.picks = team.picks.filter(p => p.gameweekId === latestGwId);
      }

      // Enrich picks with photoUrl from FantasyPlayer
      const playerIds = team.picks.map(p => p.playerId);
      const fantasyPlayers = await prisma.fantasyPlayer.findMany({
        where: { sportmonksId: { in: playerIds } },
        select: { sportmonksId: true, photoUrl: true, name: true }
      });
      const photoMap = new Map(fantasyPlayers.map(fp => [fp.sportmonksId, { photoUrl: fp.photoUrl, fullName: fp.name }]));
      team.picks = team.picks.map(pick => ({
        ...pick,
        photoUrl: photoMap.get(pick.playerId)?.photoUrl || null,
        fullName: photoMap.get(pick.playerId)?.fullName || pick.playerName
      }));
    }

    return res.json(team);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Helper function to resolve active & target gameweeks based on real time dates
export async function resolveGameweekContext(leagueId) {
  const fantasyLeague = await prisma.fantasyLeague.findUnique({
     where: { id: leagueId }
  });

  const gameweeks = await prisma.fantasyGameweek.findMany({
    where: { fantasyLeagueId: leagueId },
    orderBy: { startDate: 'asc' }
  });

  const now = new Date();
  
  // Gameweek activo = cronológicamente hay partidos jugándose
  const active = gameweeks.find(gw => 
    gw.startDate <= now && now <= gw.endDate
  );
  
  if (active && fantasyLeague) {
     // Validar Fixtures: Si TODOS los partidos de la fecha ya terminaron o están suspendidos, 
     // cerramos la fecha automáticamente aunque el "endDate" no haya pasado.
     const fixtures = await prisma.fixture.findMany({
        where: {
           leagueId: fantasyLeague.leagueId,
           startTime: { gte: active.startDate, lte: active.endDate }
        },
        select: { status: true }
     });

     let forceClose = false;
     if (fixtures.length > 0) {
        const allEnded = fixtures.every(f => {
           const st = f.status.trim().toLowerCase();
           return ['finished', 'postponed', 'cancelled', 'ft', 'pen_ft', 'aet'].includes(st);
        });
        if (allEnded) forceClose = true;
     }

     if (!forceClose) {
        return { 
          gameweek: active, 
          transfersOpen: false,  // cerrado durante partidos
          status: 'IN_PROGRESS' 
        };
     }
     // Si forceClose === true, cae a la lógica del siguiente GW (Mercado Abierto).
  }
  
  // Entre fechas = transferencias abiertas
  const next = gameweeks
    .filter(gw => gw.startDate > now)
    .sort((a, b) => a.startDate - b.startDate)[0];
    
  if (next) return { 
    gameweek: next, 
    transfersOpen: true,   // abierto entre fechas
    status: 'OPEN',
    opensUntil: next.startDate
  };
  
  // Temporada terminada
  const last = gameweeks
    .filter(gw => gw.endDate < now)
    .sort((a, b) => b.endDate - a.endDate)[0];
    
  return { 
    gameweek: last, 
    transfersOpen: true,   // abierto al final de temporada
    status: 'SEASON_END' 
  };
}

export async function saveMyTeam(req, res) {
  const userId = req.user.id;
  const { leagueId } = req.params;
  const { picks } = req.body; // Array de { playerId, isCaptain, isBenched }

  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: leagueId } }
    });
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });

    // ── Validar mercado ANTES de tocar datos ──
    const { gameweek, status } = await resolveGameweekContext(leagueId);

    if (status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Mercado cerrado: Hay partidos en curso o por finalizar. No puedes modificar tu equipo ahora.' });
    }

    if (!gameweek) {
      return res.status(400).json({ error: 'No se pueden guardar alineaciones: no hay fechas disponibles en esta liga.' });
    }

    // ── Validaciones de integridad ──
    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return res.status(400).json({ error: 'Debes enviar al menos un jugador.' });
    }
    if (picks.length > 11) {
      return res.status(400).json({ error: 'Máximo 11 titulares permitidos.' });
    }

    // Check duplicates
    const playerIdSet = new Set(picks.map(p => p.playerId));
    if (playerIdSet.size !== picks.length) {
      return res.status(400).json({ error: 'No puedes tener jugadores duplicados en tu equipo.' });
    }

    // Fetch all player data at once
    const playerIds = picks.map(p => p.playerId);
    const fantasyPlayers = await prisma.fantasyPlayer.findMany({
      where: { sportmonksId: { in: playerIds } }
    });
    const playerMap = new Map(fantasyPlayers.map(fp => [fp.sportmonksId, fp]));

    // Verify all players exist
    for (const p of picks) {
      if (!playerMap.has(p.playerId)) {
        return res.status(400).json({ error: `Jugador ${p.playerId} no encontrado.` });
      }
    }

    // Count positions
    const posCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of picks) {
      const player = playerMap.get(p.playerId);
      const pos = player.position === 'ATT' ? 'FWD' : player.position;
      posCounts[pos] = (posCounts[pos] || 0) + 1;
    }

    if (picks.length === 11 && posCounts.GK !== 1) {
      return res.status(400).json({ error: 'Un equipo completo necesita exactamente 1 arquero.' });
    }
    if (posCounts.DEF > 5) {
      return res.status(400).json({ error: 'Máximo 5 defensores.' });
    }
    if (posCounts.MID > 5) {
      return res.status(400).json({ error: 'Máximo 5 mediocampistas.' });
    }
    if (posCounts.FWD > 3) {
      return res.status(400).json({ error: 'Máximo 3 delanteros.' });
    }

    // Max 3 players from same real team
    const teamCounts = {};
    for (const p of picks) {
      const player = playerMap.get(p.playerId);
      teamCounts[player.teamId] = (teamCounts[player.teamId] || 0) + 1;
      if (teamCounts[player.teamId] > 3) {
        return res.status(400).json({ error: `Máximo 3 jugadores del mismo equipo (${player.teamName}).` });
      }
    }

    // Budget check
    let spent = 0;
    const newPicks = [];
    for (const p of picks) {
      const player = playerMap.get(p.playerId);
      spent += player.price;
      newPicks.push({
        fantasyTeamId: team.id,
        gameweekId: gameweek.id,
        playerId: player.sportmonksId,
        playerName: player.name,
        playerPosition: player.position,
        playerTeamId: player.teamId,
        playerTeamName: player.teamName,
        isCaptain: p.isCaptain || false,
        isViceCaptain: false,
        isBenched: p.isBenched || false,
        purchasePrice: player.price
      });
    }

    if (spent > 100.0) {
      return res.status(400).json({ error: `Presupuesto excedido. Gastaste ${spent.toFixed(1)}M de 100M.` });
    }

    // ── Solo borrar picks del gameweek actual, no historial ──
    await prisma.fantasyPick.deleteMany({
      where: {
        fantasyTeamId: team.id,
        gameweekId: gameweek.id,
      }
    });

    await prisma.fantasyPick.createMany({ data: newPicks });

    // Update remaining budget
    await prisma.fantasyTeam.update({
      where: { id: team.id },
      data: { budgetRemaining: 100.0 - spent }
    });

    return res.json({ success: true, newBudget: 100.0 - spent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function setCaptain(req, res) {
  const userId = req.user.id;
  const { leagueId } = req.params;
  const { captainId } = req.body;

  try {
    const { gameweek, status } = await resolveGameweekContext(leagueId);

    if (status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Mercado cerrado: No puedes cambiar el capitán durante la jornada.' });
    }

    if (!gameweek) {
      return res.status(400).json({ error: 'No hay fechas disponibles en esta liga.' });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: leagueId } }
    });

    // Reset all captains
    await prisma.fantasyPick.updateMany({
       where: { fantasyTeamId: team.id, gameweekId: gameweek.id },
       data: { isCaptain: false }
    });

    if (captainId) {
      await prisma.fantasyPick.updateMany({
         where: { fantasyTeamId: team.id, gameweekId: gameweek.id, playerId: captainId },
         data: { isCaptain: true }
      });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * TRANSFERENCIAS
 */
export async function getTransfers(req, res) {
  const userId = req.user.id;
  const { leagueId } = req.params;

  try {
     const team = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: leagueId } },
      include: { transfers: { orderBy: { transferredAt: 'desc' } } }
    });
    return res.json(team ? team.transfers : []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function makeTransfer(req, res) {
  const userId = req.user.id;
  const { leagueId } = req.params;
  const { playerOutId, playerInId } = req.body;
  
  try {
    const { gameweek, status } = await resolveGameweekContext(leagueId);
    
    if (status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Mercado cerrado: Hay un gameweek en curso.' });
    }
    
    if (!gameweek) {
      return res.status(400).json({ error: 'No hay ninguna fecha disponible.' });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: leagueId } },
      include: { picks: { where: { gameweekId: gameweek.id } } }
    });
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado.' });

    const outPlayer = await prisma.fantasyPlayer.findUnique({ where: { sportmonksId: playerOutId } });
    const inPlayer = await prisma.fantasyPlayer.findUnique({ where: { sportmonksId: playerInId } });

    if (!outPlayer || !inPlayer) {
       return res.status(404).json({ error: 'Jugadores involucrados no encontrados.' });
    }

    const pickToDrop = team.picks.find(p => p.playerId === playerOutId);
    if (!pickToDrop) return res.status(400).json({ error: 'El jugador de salida no está en tu equipo.' });

    const budgetRecovered = pickToDrop.purchasePrice;
    const newBudget = team.budgetRemaining + budgetRecovered - inPlayer.price;

    if (newBudget < 0) {
       return res.status(400).json({ error: 'Presupuesto insuficiente.' });
    }

    // Delete old pick
    await prisma.fantasyPick.delete({ where: { id: pickToDrop.id } });

    // Create new pick (sin penalización)
    await prisma.fantasyPick.create({
      data: {
        fantasyTeamId: team.id,
        gameweekId: gameweek.id,
        playerId: inPlayer.sportmonksId,
        playerName: inPlayer.name,
        playerPosition: inPlayer.position,
        playerTeamId: inPlayer.teamId,
        playerTeamName: inPlayer.teamName,
        purchasePrice: inPlayer.price,
        isBenched: pickToDrop.isBenched,
        isCaptain: pickToDrop.isCaptain,
        isViceCaptain: false
      }
    });

    await prisma.fantasyTeam.update({
       where: { id: team.id },
       data: { budgetRemaining: newBudget }
    });

    return res.json({ success: true, budgetRemaining: newBudget });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * JUGADORES DISPONIBLES
 */
export async function getPlayersExposed(req, res) {
  const { leagueId, position, page, teamId, search } = req.query;
  const p = Number(page || 1);
  const skip = (p - 1) * 50;

  let where = {};
  if (leagueId) where.leagueId = Number(leagueId);
  if (position) where.position = position;
  if (teamId) where.teamId = Number(teamId);
  if (search) where.name = { contains: search, mode: 'insensitive' };

  try {
    const total = await prisma.fantasyPlayer.count({ where });
    const players = await prisma.fantasyPlayer.findMany({
      where,
      orderBy: [{ price: 'desc' }, { totalPoints: 'desc' }],
      take: 50,
      skip
    });

    return res.json({
       data: players,
       meta: { total, page: p, pages: Math.ceil(total / 50) }
    });
  } catch (err) {
     return res.status(500).json({ error: err.message });
  }
}

export async function getLeagueTeams(req, res) {
  const { leagueId } = req.query;
  if (!leagueId) return res.status(400).json({ error: 'Falta leagueId' });

  try {
    const teams = await prisma.fantasyPlayer.findMany({
      where: { leagueId: Number(leagueId) },
      distinct: ['teamId'],
      select: { teamId: true, teamName: true },
      orderBy: { teamName: 'asc' }
    });
    return res.json(teams);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getPlayerScores(req, res) {
  const { sportmonksId } = req.params;
  
  try {
    // Siempre primero de BD
    const cachedScores = await prisma.fantasyPlayerScore.findMany({
      where: { playerId: Number(sportmonksId) },
      orderBy: { createdAt: 'desc' }
    });
    
    if (cachedScores.length > 0) {
      return res.json({ data: cachedScores, source: 'cache' });
    }
    
    // Si no hay nada en BD, el partido probablemente no terminó o no fue escrutado.
    return res.json({ data: [], source: 'pending' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GAMEWEEKS
 */
export async function getGameweeks(req, res) {
   try {
     const team = await prisma.fantasyTeam.findUnique({
       where: { userId_fantasyLeagueId: { userId: req.user.id, fantasyLeagueId: req.params.id } }
     });

     let gws = await prisma.fantasyGameweek.findMany({
       where: { fantasyLeagueId: req.params.id },
       orderBy: { gameweekNumber: 'asc' }
     });

     if (team) {
       // Filter out old gameweeks that finished before the team was created
       gws = gws.filter(gw => new Date(gw.endDate) >= new Date(team.createdAt));
     }

     return res.json(gws);
   } catch(err) {
     return res.status(500).json({ error: err.message });
   }
}

export async function getActiveGameweek(req, res) {
   try {
     const { gameweek, status, transfersOpen, opensUntil } = await resolveGameweekContext(req.params.id);
     
     if (!gameweek) {
       return res.status(404).json({ error: 'No gameweeks available' });
     }

     const gw = gameweek;
     
     gw.status = status;
     gw.transfersOpen = transfersOpen;
     if (opensUntil) gw.opensUntil = opensUntil;

     // Calculate fixtures for this gameweek to provide tactical data to frontend
     let fixtures = [];
     if (gw && gw.fantasyLeagueId) {
       const lg = await prisma.fantasyLeague.findUnique({ where: { id: gw.fantasyLeagueId } });
       if (lg) {
         fixtures = await prisma.fixture.findMany({
           where: {
             leagueId: lg.leagueId,
             startTime: {
               gte: gw.startDate,
               lte: gw.endDate
             }
           },
           select: {
             id: true,
             homeTeamId: true,
             awayTeamId: true,
             startTime: true
           }
         });
         
         // Note: we can inject it
         gw.fixtures = fixtures;
       }
     }

      return res.json(gw);
   } catch(err) {
     return res.status(500).json({ error: err.message });
   }
}

export async function getNextFixtures(req, res) {
   try {
     const { gameweek } = await resolveGameweekContext(req.params.id);
     if (!gameweek) {
       return res.json([]);
     }

     const lg = await prisma.fantasyLeague.findUnique({ where: { id: req.params.id } });
     if (!lg) return res.json([]);

     const fixtures = await prisma.fixture.findMany({
       where: {
         source: 'sportmonks',
         leagueId: lg.leagueId,
         startTime: {
           gte: gameweek.startDate,
           lte: gameweek.endDate
         }
       },
       orderBy: { startTime: 'asc' },
       select: {
         id: true,
         startTime: true,
         status: true,
         homeTeamId: true,
         awayTeamId: true,
         homeScore: true,
         awayScore: true,
         isLive: true
       }
     });

     return res.json(fixtures);
   } catch (err) {
     return res.status(500).json({ error: err.message });
   }
}


/**
 * GET /api/fantasy/leagues/:id/calendar
 * Retorna todos los gameweeks de la liga con sus respectivos fixtures (partidos)
 */
export async function getLeagueCalendar(req, res) {
  const { id } = req.params;
  try {
    const league = await prisma.fantasyLeague.findUnique({ where: { id } });
    if (!league) return res.status(404).json({ error: 'Liga no encontrada' });

    const gameweeks = await prisma.fantasyGameweek.findMany({
      where: { fantasyLeagueId: league.id },
      orderBy: { gameweekNumber: 'asc' }
    });

    const now = new Date();

    // Attach fixtures to each gameweek
    const calendar = await Promise.all(gameweeks.map(async (gw) => {
       const fixtures = await prisma.fixture.findMany({
          where: {
            source: 'sportmonks',
            leagueId: league.leagueId,
            seasonId: league.seasonId,
            startTime: { gte: gw.startDate, lte: gw.endDate }
          },
          orderBy: { startTime: 'asc' }
       });

       // Dynamically resolve status specifically for the calendar display
       let status = 'SCHEDULED';
       if (now > gw.endDate) status = 'FINISHED';
       else if (now >= gw.startDate && now <= gw.endDate) status = 'IN_PROGRESS';

       return {
         ...gw,
         status,
         fixtures
       };
    }));

    // Obtener info de los equipos involucrados para mostrar en UI
    const teamIdsSet = new Set();
    calendar.forEach(gw => gw.fixtures.forEach(f => {
       teamIdsSet.add(f.homeTeamId);
       teamIdsSet.add(f.awayTeamId);
    }));

    const teamsInfo = await prisma.team.findMany({
       where: { source: 'sportmonks', externalId: { in: Array.from(teamIdsSet) } },
       select: { externalId: true, name: true, logo: true }
    });

    const teamMap = {};
    teamsInfo.forEach(t => teamMap[t.externalId] = t);

    // Mapear el nombre y logo en cada partido
    const enrichedCalendar = calendar.map(gw => ({
       ...gw,
       fixtures: gw.fixtures.map(f => ({
          ...f,
          homeTeamName: teamMap[f.homeTeamId]?.name || `Team ${f.homeTeamId}`,
          homeTeamLogo: teamMap[f.homeTeamId]?.logo || null,
          awayTeamName: teamMap[f.awayTeamId]?.name || `Team ${f.awayTeamId}`,
          awayTeamLogo: teamMap[f.awayTeamId]?.logo || null,
       }))
    }));

    return res.json(enrichedCalendar);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getGameweekPoints(req, res) {
  const userId = req.user.id;
  const { leagueId, gwId } = req.params;

  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: leagueId } },
      include: { picks: { where: { gameweekId: gwId } } }
    });
    
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    
    return res.json(team.picks);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: RECALCULAR PUNTOS FANTASY
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/fantasy/admin/recalculate/:fixtureId
 * Recalcula puntos de un fixture específico (por su externalId de Sportmonks).
 * Solo dueños de ligas fantasy pueden invocar esto.
 */
export async function adminRecalculateFixture(req, res) {
  const { fixtureId } = req.params;
  const userId = req.user.id;

  try {
    // Verificar que el usuario sea owner de al menos una liga
    const ownedLeague = await prisma.fantasyLeague.findFirst({
      where: { ownerId: userId },
    });
    if (!ownedLeague) {
      return res.status(403).json({ error: 'Solo administradores de ligas pueden recalcular.' });
    }

    // Buscar fixture por externalId (Sportmonks ID)
    const fixture = await prisma.fixture.findFirst({
      where: { externalId: String(fixtureId), source: 'sportmonks' },
    });
    if (!fixture) {
      return res.status(404).json({ error: `Fixture ${fixtureId} no encontrado en BD.` });
    }

    console.log(`[Admin] Usuario ${userId} solicitó recálculo del fixture ${fixtureId}`);
    const result = await recalculateFixture(fixture.id);

    return res.json({
      success: true,
      fixtureId: fixtureId,
      ...result,
      message: `Recálculo completado: ${result.processedPlayers} jugadores, ${result.updatedTeams} equipos actualizados.`,
    });
  } catch (err) {
    console.error('[Admin Recalculate]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/fantasy/admin/recalculate-all
 * Busca y recalcula TODOS los fixtures pendientes.
 */
export async function adminRecalculateAll(req, res) {
  const userId = req.user.id;

  try {
    const ownedLeague = await prisma.fantasyLeague.findFirst({
      where: { ownerId: userId },
    });
    if (!ownedLeague) {
      return res.status(403).json({ error: 'Solo administradores de ligas pueden recalcular.' });
    }

    console.log(`[Admin] Usuario ${userId} solicitó recálculo de TODOS los pendientes`);
    await calculatePendingScores();
    await recalculateTeamTotals();

    return res.json({
      success: true,
      message: 'Barrido completo de fixtures pendientes ejecutado exitosamente.',
    });
  } catch (err) {
    console.error('[Admin Recalculate All]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * RENOMBRAR EQUIPO
 */
export async function renameTeam(req, res) {
  const userId = req.user.id;
  const { leagueId } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length < 2 || name.trim().length > 30) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres.' });
  }

  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { userId_fantasyLeagueId: { userId, fantasyLeagueId: leagueId } }
    });
    if (!team) return res.status(404).json({ error: 'No se encontró tu equipo en esta liga.' });

    const updated = await prisma.fantasyTeam.update({
      where: { id: team.id },
      data: { name: name.trim() }
    });

    return res.json({ success: true, name: updated.name });
  } catch (err) {
    console.error('[Rename Team]', err.message);
    return res.status(500).json({ error: 'Error al renombrar el equipo.' });
  }
}

export async function updateLeague(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const league = await prisma.fantasyLeague.findUnique({ where: { id } });
    if (!league) return res.status(404).json({ error: 'Liga no encontrada.' });
    if (league.ownerId !== userId) return res.status(403).json({ error: 'Solo el administrador puede editar la liga.' });

    const data = {};
    if (name !== undefined) {
      if (!name.trim() || name.trim().length < 2 || name.trim().length > 30) {
        return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres.' });
      }
      data.name = name.trim();
    }
    if (description !== undefined) {
      data.description = (description || '').trim().substring(0, 150);
    }

    const updated = await prisma.fantasyLeague.update({ where: { id }, data });
    return res.json({ success: true, name: updated.name, description: updated.description });
  } catch (err) {
    console.error('[Update League]', err.message);
    return res.status(500).json({ error: 'Error al actualizar la liga.' });
  }
}
