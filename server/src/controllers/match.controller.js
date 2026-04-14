import * as matchService from '../services/match.service.js';

export async function getAll(req, res, next) {
  try {
    const matches = await matchService.getAllMatches(req.query);
    res.json(matches);
  } catch (err) { next(err); }
}

export async function getToday(req, res, next) {
  try {
    const matches = await matchService.getTodayMatches();
    res.json(matches);
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const match = await matchService.getMatchById(Number(req.params.id));
    res.json(match);
  } catch (err) { next(err); }
}

export async function getByStage(req, res, next) {
  try {
    const matches = await matchService.getMatchesByStage(req.params.stage);
    res.json(matches);
  } catch (err) { next(err); }
}

export async function getTeams(req, res, next) {
  try {
    const teams = await matchService.getAllTeams();
    res.json(teams);
  } catch (err) { next(err); }
}
