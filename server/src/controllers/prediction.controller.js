import * as predictionService from '../services/prediction.service.js';

export async function upsert(req, res, next) {
  try {
    const { externalFixtureId, competitionId, ...data } = req.body;
    if (!externalFixtureId || !competitionId) return res.status(400).json({ error: 'externalFixtureId and competitionId are required' });
    const prediction = await predictionService.upsertPrediction(req.user.id, Number(externalFixtureId), Number(competitionId), data);
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
    const predictions = await predictionService.getPredictionsForFixture(Number(req.params.fixtureId));
    res.json(predictions);
  } catch (err) { next(err); }
}

export async function getGroupPredictions(req, res, next) {
  try {
    const predictions = await predictionService.getGroupPredictionsForFixture(
      Number(req.params.fixtureId),
      Number(req.params.groupId),
      req.user.id
    );
    res.json(predictions);
  } catch (err) { next(err); }
}
