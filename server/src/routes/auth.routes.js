import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, profileUpdateSchema, favoritesSchema } from '../validators/schemas.js';

const router = Router();

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.getMe);
router.put('/me', authenticate, validate(profileUpdateSchema), ctrl.updateMe);
router.put('/me/favorites', authenticate, validate(favoritesSchema), ctrl.setFavorites);
router.get('/me/favorites', authenticate, ctrl.getFavorites);

export default router;
