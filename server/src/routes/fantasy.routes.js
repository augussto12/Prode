import { Router } from 'express';
import * as ctrl from '../controllers/fantasy.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ================================
// LIGAS FANTASY
// ================================
router.get('/my-leagues', authenticate, ctrl.getMyLeagues);
router.get('/teams', authenticate, ctrl.getLeagueTeams);
router.get('/leagues', authenticate, ctrl.getAvailableLeagues);
router.post('/leagues', authenticate, ctrl.createFantasyLeague);
router.get('/leagues/:id/details', authenticate, ctrl.getLeagueDetails);
router.get('/leagues/code/:code', authenticate, ctrl.getLeagueByCode);
router.post('/leagues/:code/join', authenticate, ctrl.joinLeague);
router.get('/leagues/:id/standings', authenticate, ctrl.getLeagueStandings);
router.put('/leagues/:id/teams/:teamId/ban', authenticate, ctrl.banTeam);
router.put('/leagues/:id/teams/:teamId/unban', authenticate, ctrl.unbanTeam);
router.put('/leagues/:id', authenticate, ctrl.updateLeague);

// ================================
// GAMEWEEKS
// ================================
router.get('/leagues/:id/gameweeks', authenticate, ctrl.getGameweeks);
router.get('/leagues/:id/gameweeks/active', authenticate, ctrl.getActiveGameweek);
router.get('/leagues/:id/ideal-team', authenticate, ctrl.getIdealTeam);
router.get('/leagues/:id/calendar', authenticate, ctrl.getLeagueCalendar);
router.get('/leagues/:id/next-fixtures', authenticate, ctrl.getNextFixtures);

// ================================
// EQUIPO DEL USUARIO
// ================================
router.get('/my-team/:leagueId', authenticate, ctrl.getMyTeam);
router.post('/my-team/:leagueId', authenticate, ctrl.saveMyTeam);
router.put('/my-team/:leagueId/captain', authenticate, ctrl.setCaptain);
router.put('/my-team/:leagueId/name', authenticate, ctrl.renameTeam);

// ================================
// TRANSFERENCIAS
// ================================
router.get('/my-team/:leagueId/transfers', authenticate, ctrl.getTransfers);
router.post('/my-team/:leagueId/transfers', authenticate, ctrl.makeTransfer);

// ================================
// PUNTOS Y DESGLOSE
// ================================
router.get('/my-team/:leagueId/gameweeks/:gwId/points', authenticate, ctrl.getGameweekPoints);

// ================================
// MERCADO DE JUGADORES
// ================================
router.get('/players', authenticate, ctrl.getPlayersExposed);
router.get('/players/:sportmonksId/scores', authenticate, ctrl.getPlayerScores);

// ================================
// ADMIN: RECÁLCULO DE PUNTOS
// ================================
router.post('/admin/recalculate/:fixtureId', authenticate, ctrl.adminRecalculateFixture);
router.post('/admin/recalculate-all', authenticate, ctrl.adminRecalculateAll);

export default router;
