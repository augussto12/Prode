import * as outrightsService from '../services/outrights.service.js';

export async function getMyOutrights(req, res, next) {
  try {
    const { competitionId } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }

    const data = await outrightsService.getMyOutrights(req.user.id, Number(competitionId));
    res.json(data);
  } catch (err) { next(err); }
}

export async function saveOutrights(req, res, next) {
  try {
    const prediction = await outrightsService.saveMyOutrights(req.user.id, req.body);
    res.json(prediction);
  } catch (err) { next(err); }
}

export async function getOptions(req, res, next) {
  try {
    const { competitionId } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }

    const [teams, lockInfo] = await Promise.all([
      outrightsService.listTeams(Number(competitionId)),
      outrightsService.getLockInfo(Number(competitionId)),
    ]);
    res.json({ teams, lockAt: lockInfo.lockAt, locked: lockInfo.locked });
  } catch (err) { next(err); }
}

export async function getPlayers(req, res, next) {
  try {
    const { competitionId, teamId, position } = req.query;
    if (!teamId) {
      return res.status(400).json({ error: 'teamId es requerido' });
    }
    const players = await outrightsService.listPlayers({ competitionId, teamId, position });
    res.json(players);
  } catch (err) { next(err); }
}
