import prisma from '../config/database.js';

export async function listCompetitions(req, res, next) {
  try {
    const competitions = await prisma.competition.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            groups: true,
          },
        },
      },
    });
    res.json(competitions);
  } catch (err) { next(err); }
}

export async function getCompetitionById(req, res, next) {
  try {
    const competition = await prisma.competition.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        _count: {
          select: { groups: true },
        },
      },
    });
    if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });
    res.json(competition);
  } catch (err) { next(err); }
}

export async function createCompetition(req, res, next) {
  try {
    const { externalId, name, logo, season } = req.body;

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
}
