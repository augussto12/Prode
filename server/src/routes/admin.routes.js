import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin, isSuperAdmin } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { matchResultSchema, scoringConfigSchema, roleUpdateSchema } from '../validators/schemas.js';

const router = Router();

// User management (SUPERADMIN only)
router.get('/users', authenticate, isSuperAdmin, ctrl.getUsers);
router.put('/users/:id/role', authenticate, isSuperAdmin, validate(roleUpdateSchema), ctrl.updateUserRole);
router.delete('/users/:id', authenticate, isSuperAdmin, ctrl.deleteUser);

// Match management (ADMIN+)
router.put('/matches/:id/result', authenticate, isAdmin, validate(matchResultSchema), ctrl.updateMatchResult);
router.post('/scoring/calculate', authenticate, isAdmin, ctrl.calculateScores);

// Scoring config (SUPERADMIN only to edit, ADMIN can view)
router.get('/scoring/config', authenticate, isAdmin, ctrl.getScoringConfig);
router.put('/scoring/config', authenticate, isSuperAdmin, validate(scoringConfigSchema), ctrl.updateScoringConfig);

export default router;
