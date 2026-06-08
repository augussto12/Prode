import { Router } from 'express';
import * as ctrl from '../controllers/outrights.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { outrightPredictionSchema } from '../validators/schemas.js';

const router = Router();
router.use(authenticate);

router.get('/options', ctrl.getOptions);
router.get('/players', ctrl.getPlayers);
router.get('/', ctrl.getMyOutrights);
router.post('/', validate(outrightPredictionSchema), ctrl.saveOutrights);

export default router;
