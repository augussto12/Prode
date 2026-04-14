import * as predictionService from '../services/prediction.service.js';

export async function upsert(req, res, next) {
  try {
    const { matchId, ...data } = req.body;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const prediction = await predictionService.upsertPrediction(req.user.id, Number(matchId), data);
    res.json(prediction);
  } catch (err) { next(err); }
}

export async function getMy(req, res, next) {
  try {
    const predictions = await predictionService.getMyPredictions(req.user.id);
    res.json(predictions);
  } catch (err) { next(err); }
}

export async function getForMatch(req, res, next) {
  try {
    const predictions = await predictionService.getPredictionsForMatch(Number(req.params.matchId));
    res.json(predictions);
  } catch (err) { next(err); }
}

export async function getGroupPredictions(req, res, next) {
  try {
    const predictions = await predictionService.getGroupPredictionsForMatch(
      Number(req.params.matchId),
      Number(req.params.groupId),
      req.user.id
    );
    res.json(predictions);
  } catch (err) { next(err); }
}
