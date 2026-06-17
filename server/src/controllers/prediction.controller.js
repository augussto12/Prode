import * as predictionService from '../services/prediction.service.js';
import * as scoringService from '../services/scoring.service.js';
import * as phaseWindowService from '../services/phase-window.service.js';
import * as jokerService from '../services/joker.service.js';

export async function upsert(req, res, next) {
  try {
    const { externalFixtureId, competitionId, ...data } = req.body;
    if (!externalFixtureId || !competitionId) return res.status(400).json({ error: 'externalFixtureId and competitionId are required' });
    const prediction = await predictionService.upsertPrediction(req.user.id, String(externalFixtureId), Number(competitionId), data);
    res.json(prediction);
  } catch (err) { next(err); }
}

export async function getMy(req, res, next) {
  try {
    const competitionId = req.query.competitionId || null;
    const predictions = await predictionService.getMyPredictions(req.user.id, competitionId);
    res.json(predictions);
  } catch (err) { next(err); }
}

export async function getForFixture(req, res, next) {
  try {
    const predictions = await predictionService.getPredictionsForFixture(
      String(req.params.fixtureId),
      req.user.id,
    );
    res.json(predictions);
  } catch (err) { next(err); }
}

export async function getGroupPredictions(req, res, next) {
  try {
    const predictions = await predictionService.getGroupPredictionsForFixture(
      String(req.params.fixtureId),
      Number(req.params.groupId),
      req.user.id
    );
    res.json(predictions);
  } catch (err) { next(err); }
}

export async function getScoringConfig(req, res, next) {
  try {
    const config = await scoringService.getScoringConfig();
    res.json({
      exactScore: config.exactScore,
      correctWinner: config.correctWinner,
      champion: config.champion,
      runnerUp: config.runnerUp,
      topScorer: config.topScorer,
      goldenGlove: config.goldenGlove,
    });
  } catch (err) { next(err); }
}

export async function getPhaseWindows(req, res, next) {
  try {
    const { competitionId, fresh } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }

    const windows = await phaseWindowService.getCompetitionPredictionWindows(
      Number(competitionId),
      { fresh: fresh === 'true' },
    );

    if (!windows) return res.status(404).json({ error: 'Competicion no encontrada' });
    res.json(windows);
  } catch (err) { next(err); }
}

export async function getJokerStatus(req, res, next) {
  try {
    const { competitionId } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }
    const status = await jokerService.getUserJokerStatus(req.user.id, Number(competitionId));
    res.json(status);
  } catch (err) { next(err); }
}

export async function markJokerGrantSeen(req, res, next) {
  try {
    const seen = await jokerService.markJokerGrantSeen(req.user.id, Number(req.params.grantId));
    res.json({ success: true, seen });
  } catch (err) { next(err); }
}
