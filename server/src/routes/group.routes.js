import { Router } from 'express';
import * as ctrl from '../controllers/group.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireGroupMember, requireGroupAdmin } from '../middleware/groupAccess.js';
import { groupCreateSchema, groupThemeSchema, joinGroupSchema } from '../validators/schemas.js';

const router = Router();

// Públicos (requieren auth pero no membresía)
router.post('/', authenticate, validate(groupCreateSchema), ctrl.create);
router.get('/', authenticate, ctrl.getMyGroups);
router.get('/public', authenticate, ctrl.getPublic);
router.post('/join', authenticate, validate(joinGroupSchema), ctrl.join);

// Requieren membresía (Anti-IDOR)
router.get('/:id', authenticate, requireGroupMember, ctrl.getById);
router.get('/:id/leaderboard', authenticate, requireGroupMember, ctrl.getLeaderboard);
router.put('/:id/theme', authenticate, requireGroupAdmin, validate(groupThemeSchema), ctrl.updateTheme);
router.delete('/:id', authenticate, requireGroupAdmin, ctrl.removeGroup);
router.delete('/:id/leave', authenticate, requireGroupMember, ctrl.leave);

// Admin del grupo
router.delete('/:id/members/:userId', authenticate, requireGroupAdmin, ctrl.removeMember);
router.get('/:id/banned', authenticate, requireGroupAdmin, ctrl.getBanned);
router.post('/:id/unban/:userId', authenticate, requireGroupAdmin, ctrl.unban);

export default router;
