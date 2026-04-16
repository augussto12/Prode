import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import prisma from '../config/database.js';

const router = Router();

// Listar todas las competencias (público)
router.get('/', async (req, res, next) => {
  try {
    const competitions = await prisma.competition.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            matches: true,
            groups: true,
          },
        },
      },
    });
    res.json(competitions);
  } catch (err) { next(err); }
});

// Detalle de una competencia
router.get('/:id', async (req, res, next) => {
  try {
    const competition = await prisma.competition.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        _count: {
          select: { matches: true, groups: true },
        },
      },
    });
    if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });
    res.json(competition);
  } catch (err) { next(err); }
});

// Crear competencia manualmente (ADMIN+)
router.post('/', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { externalId, name, logo, season } = req.body;
    if (!externalId || !name) {
      return res.status(400).json({ error: 'externalId y name son requeridos' });
    }
    const competition = await prisma.competition.upsert({
      where: { externalId_season: { externalId: Number(externalId), season: Number(season) || 2022 } },
      update: { name, logo: logo || null },
      create: {
        externalId: Number(externalId),
        name,
        logo: logo || null,
        season: Number(season) || 2022,
      },
    });
    res.json(competition);
  } catch (err) { next(err); }
});

export default router;
