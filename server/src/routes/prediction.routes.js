import { Router } from 'express';
import * as ctrl from '../controllers/prediction.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { predictionSchema } from '../validators/schemas.js';

const router = Router();

router.post('/', authenticate, validate(predictionSchema), ctrl.upsert);
router.get('/scoring-config', ctrl.getScoringConfig);
router.get('/phase-windows', ctrl.getPhaseWindows);
router.get('/joker-status', authenticate, ctrl.getJokerStatus);
router.post('/joker-grants/:grantId/seen', authenticate, ctrl.markJokerGrantSeen);
router.get('/my', authenticate, ctrl.getMy);
router.get('/fixture/:fixtureId', authenticate, ctrl.getForFixture);
router.get('/fixture/:fixtureId/group/:groupId', authenticate, ctrl.getGroupPredictions);

export default router;
