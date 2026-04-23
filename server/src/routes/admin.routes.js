import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import * as smSyncCtrl from '../controllers/sportmonksSync.controller.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin, isSuperAdmin } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { scoringConfigSchema, roleUpdateSchema } from '../validators/schemas.js';
import * as fantasyAdminCtrl from '../controllers/fantasyAdmin.controller.js';
import { sportmonksRateLimit } from '../services/sportmonks/sportmonksClient.js';
import { afRateLimit } from '../services/football-api.service.js';
import { syncAllRounds, syncRoundsForLeague } from '../jobs/syncRounds.helper.js';
import { SPORTMONKS_LEAGUE_IDS } from '../constants/sportmonks.constants.js';

const router = Router();

// User management (SUPERADMIN only)
router.get('/users', authenticate, isSuperAdmin, ctrl.getUsers);
router.put('/users/:id/role', authenticate, isSuperAdmin, validate(roleUpdateSchema), ctrl.updateUserRole);
router.delete('/users/:id', authenticate, isSuperAdmin, ctrl.deleteUser);

// Cron Logs (SUPERADMIN only)
router.get('/cron-logs', authenticate, isSuperAdmin, ctrl.getCronLogs);

// Scoring management (ADMIN+)
router.post('/scoring/calculate', authenticate, isAdmin, ctrl.calculateScores);
router.post('/scoring/recalculate-leaderboards', authenticate, isAdmin, ctrl.recalculateLeaderboards);

// Scoring config (SUPERADMIN only to edit, ADMIN can view)
router.get('/scoring/config', authenticate, isAdmin, ctrl.getScoringConfig);
router.put('/scoring/config', authenticate, isSuperAdmin, validate(scoringConfigSchema), ctrl.updateScoringConfig);

// Sportmonks sync management (SUPERADMIN only)
router.post('/sportmonks/sync-initial', authenticate, isSuperAdmin, smSyncCtrl.syncInitial);
router.get('/sportmonks/sync-status', authenticate, isAdmin, smSyncCtrl.getSyncStatus);
router.post('/sportmonks/sync-fixtures', authenticate, isAdmin, smSyncCtrl.syncFixturesNow);
router.post('/sportmonks/sync-static', authenticate, isAdmin, smSyncCtrl.syncStaticNow);
router.post('/sportmonks/sync-rounds', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await syncAllRounds(SPORTMONKS_LEAGUE_IDS);
    res.json({ success: true, message: `Rounds sincronizadas`, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/sportmonks/sync-rounds/:leagueId', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await syncRoundsForLeague(Number(req.params.leagueId));
    res.json({ success: true, message: `Rounds sincronizadas para liga ${req.params.leagueId}`, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fantasy admin endpoints
router.post('/fantasy/seed-players/:leagueId', authenticate, isSuperAdmin, fantasyAdminCtrl.seedPlayers);
router.post('/fantasy/sync-season/:leagueId', authenticate, isSuperAdmin, fantasyAdminCtrl.syncSeason);
router.post('/fantasy/seed-gameweeks/:leagueId', authenticate, isSuperAdmin, fantasyAdminCtrl.seedGameweeks);
router.get('/fantasy/status', authenticate, isSuperAdmin, fantasyAdminCtrl.getStatus);
router.put('/fantasy/gameweeks/:id/activate', authenticate, isSuperAdmin, fantasyAdminCtrl.forceActivateGameweek);

// System
router.get('/rate-limits', authenticate, isAdmin, (req, res) => {
  res.json({
    sportmonks: sportmonksRateLimit,
    apiFootball: afRateLimit
  });
});

export default router;
