import { Router } from 'express';
import * as ctrl from '../controllers/sync.controller.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';

const router = Router();

// Todas las rutas requieren autenticación + rol ADMIN como mínimo
router.post('/teams', authenticate, isAdmin, ctrl.syncTeams);
router.post('/squad', authenticate, isAdmin, ctrl.syncSquad);
router.post('/squads', authenticate, isAdmin, ctrl.syncAllSquads);
router.get('/status', authenticate, isAdmin, ctrl.getApiStatus);

export default router;
