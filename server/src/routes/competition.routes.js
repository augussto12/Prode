import { Router } from 'express';
import * as ctrl from '../controllers/competition.controller.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { competitionCreateSchema } from '../validators/schemas.js';

const router = Router();

// Middleware de caché simple para datos que cambian poco
const setCacheHeader = (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutos
  next();
};

// Listar todas las competencias (público)
router.get('/', setCacheHeader, ctrl.listCompetitions);

// Detalle de una competencia (público)
router.get('/:id', setCacheHeader, ctrl.getCompetitionById);

// Crear competencia manualmente (ADMIN+)
router.post('/', authenticate, isAdmin, validate(competitionCreateSchema), ctrl.createCompetition);

export default router;
