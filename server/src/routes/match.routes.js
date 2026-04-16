import { Router } from 'express';
import * as ctrl from '../controllers/match.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, ctrl.getAll);
router.get('/today', authenticate, ctrl.getToday);
router.get('/teams', authenticate, ctrl.getTeams);
router.get('/teams/:id/squad', authenticate, ctrl.getTeamSquad);
router.get('/stage/:stage', authenticate, ctrl.getByStage);
router.get('/:id/detail', authenticate, ctrl.getMatchDetail);
router.get('/:id', authenticate, ctrl.getById);

export default router;
