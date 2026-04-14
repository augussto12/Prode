import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as dtController from '../controllers/dreamteam.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/players', dtController.getPlayers);
router.get('/', dtController.getMyDreamTeam);
router.post('/', dtController.saveDreamTeam);

export default router;
