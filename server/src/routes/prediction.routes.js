import { Router } from 'express';
import * as ctrl from '../controllers/prediction.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { predictionSchema } from '../validators/schemas.js';

const router = Router();

router.post('/', authenticate, validate(predictionSchema), ctrl.upsert);
router.get('/my', authenticate, ctrl.getMy);
router.get('/match/:matchId', authenticate, ctrl.getForMatch);
router.get('/match/:matchId/group/:groupId', authenticate, ctrl.getGroupPredictions);

export default router;
