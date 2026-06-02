import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  authTokenSchema,
  emailOnlySchema,
  favoritesSchema,
  loginSchema,
  passwordResetSchema,
  profileUpdateSchema,
  registerSchema,
} from '../validators/schemas.js';

const router = Router();

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/verify-email', validate(authTokenSchema), ctrl.verifyEmail);
router.post('/resend-verification', validate(emailOnlySchema), ctrl.resendVerification);
router.post('/forgot-password', validate(emailOnlySchema), ctrl.forgotPassword);
router.post('/reset-password', validate(passwordResetSchema), ctrl.resetPassword);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.getMe);
router.put('/me', authenticate, validate(profileUpdateSchema), ctrl.updateMe);
router.put('/me/favorites', authenticate, validate(favoritesSchema), ctrl.setFavorites);
router.get('/me/favorites', authenticate, ctrl.getFavorites);

// League favorites
router.get('/me/league-favorites', authenticate, ctrl.getLeagueFavorites);
router.post('/me/league-favorites', authenticate, ctrl.addLeagueFavorite);
router.delete('/me/league-favorites/:leagueId', authenticate, ctrl.removeLeagueFavorite);

export default router;
