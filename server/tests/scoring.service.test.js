import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePredictionPoints } from '../src/services/scoring.service.js';

const config = {
  exactScore: 10,
  correctWinner: 3,
};

const fixture = (home, away) => ({
  goals: { home, away },
});

describe('calculatePredictionPoints', () => {
  it('scores exact result and stores base points without multiplier', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 2, awayGoals: 1, isJoker: false },
      fixture(2, 1),
      config,
    );

    assert.equal(result.points, 10);
    assert.equal(result.basePoints, 10);
  });

  it('scores correct winner when score is not exact', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 3, awayGoals: 0, isJoker: false },
      fixture(1, 0),
      config,
    );

    assert.equal(result.points, 3);
    assert.equal(result.basePoints, 3);
  });

  it('scores correct draw as winner/sign hit', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 0, awayGoals: 0, isJoker: false },
      fixture(1, 1),
      config,
    );

    assert.equal(result.points, 3);
    assert.equal(result.basePoints, 3);
  });

  it('doubles only result points with joker and keeps base points unchanged', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 2, awayGoals: 1, isJoker: true },
      fixture(2, 1),
      config,
    );

    assert.equal(result.points, 20);
    assert.equal(result.basePoints, 10);
  });

  it('does not score wrong result even with joker', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 2, awayGoals: 0, isJoker: true },
      fixture(0, 1),
      config,
    );

    assert.equal(result.points, 0);
    assert.equal(result.basePoints, 0);
  });

  it('does not score when final goals are missing', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 2, awayGoals: 1, isJoker: true },
      fixture(null, 1),
      config,
    );

    assert.equal(result.points, 0);
    assert.equal(result.basePoints, 0);
  });
});
