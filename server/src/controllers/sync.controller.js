import * as syncService from '../services/sync.service.js';

export async function syncTeams(req, res, next) {
  try {
    const result = await syncService.syncTeams(
      req.body.leagueId,
      req.body.season
    );
    res.json({ message: 'Equipos sincronizados', ...result });
  } catch (err) { next(err); }
}


export async function syncSquad(req, res, next) {
  try {
    const { teamId, competitionId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId es requerido' });
    const result = await syncService.syncSquad(Number(teamId), competitionId ? Number(competitionId) : null);
    res.json({ message: 'Plantel sincronizado', ...result });
  } catch (err) { next(err); }
}

export async function syncAllSquads(req, res, next) {
  try {
    const batchSize = Number(req.body.batchSize) || 10;
    const competitionId = req.body.competitionId ? Number(req.body.competitionId) : null;
    const result = await syncService.syncAllSquads(batchSize, competitionId);
    res.json({ message: 'Planteles sincronizados', ...result });
  } catch (err) { next(err); }
}

export async function getApiStatus(req, res, next) {
  try {
    const status = await syncService.getApiStatus();
    res.json(status);
  } catch (err) { next(err); }
}
