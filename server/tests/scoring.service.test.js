import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePredictionPoints,
  getRegulationScore,
  hasFinalFixtureScore,
  isFinishedFixture,
} from '../src/services/scoring.service.js';

const config = {
  exactScore: 10,
  correctWinner: 3,
};

const fixture = (home, away) => ({
  goals: { home, away },
});

const aetFixture = {
  goals: { home: 2, away: 1 },
  score: {
    fulltime: { home: 1, away: 1 },
    extratime: { home: 2, away: 1 },
  },
};

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

  it('scores knockout predictions against the 90-minute result, not extra time', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 1, awayGoals: 1, isJoker: false },
      aetFixture,
      config,
    );

    assert.equal(result.points, 10);
    assert.equal(result.basePoints, 10);
  });

  it('does not score an extra-time final score when the 90-minute result differs', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 2, awayGoals: 1, isJoker: false },
      aetFixture,
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

  it('does not score when final goals are undefined', () => {
    const result = calculatePredictionPoints(
      { homeGoals: 0, awayGoals: 0, isJoker: false },
      { goals: {} },
      config,
    );

    assert.equal(result.points, 0);
    assert.equal(result.basePoints, 0);
  });
});

describe('fixture scoring guards', () => {
  it('uses fulltime score as the regulation-time prode result', () => {
    assert.deepEqual(getRegulationScore(aetFixture), {
      home: 1,
      away: 1,
      source: 'fulltime',
    });
  });

  it('handles API detail responses that wrap the raw fixture under fixture', () => {
    assert.deepEqual(getRegulationScore({ fixture: aetFixture }), {
      home: 1,
      away: 1,
      source: 'fulltime',
    });
  });

  it('falls back to goals when fulltime score is unavailable', () => {
    assert.deepEqual(getRegulationScore(fixture(2, 0)), {
      home: 2,
      away: 0,
      source: 'goals',
    });
  });

  it('accepts only API-Football finished statuses used for scoring', () => {
    assert.equal(isFinishedFixture({ fixture: { status: { short: 'FT' } } }), true);
    assert.equal(isFinishedFixture({ fixture: { status: { short: 'AET' } } }), true);
    assert.equal(isFinishedFixture({ fixture: { status: { short: 'PEN' } } }), true);
    assert.equal(isFinishedFixture({ fixture: { status: { short: 'LIVE' } } }), false);
    assert.equal(isFinishedFixture({ fixture: { status: { short: 'NS' } } }), false);
  });

  it('requires both final goals before a fixture can be scored', () => {
    assert.equal(hasFinalFixtureScore(fixture(0, 0)), true);
    assert.equal(hasFinalFixtureScore(fixture(null, 0)), false);
    assert.equal(hasFinalFixtureScore({ goals: { home: 1 } }), false);
  });
});
