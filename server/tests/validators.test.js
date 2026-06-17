import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupCreateSchema,
  groupThemeSchema,
  jokerConfigSchema,
  jokerGrantSchema,
  predictionSchema,
  scoringConfigSchema,
} from '../src/validators/schemas.js';

describe('predictionSchema', () => {
  it('accepts only result fields plus joker and strips legacy markets', () => {
    const parsed = predictionSchema.parse({
      externalFixtureId: 123,
      competitionId: 1,
      homeGoals: 2,
      awayGoals: 1,
      isJoker: true,
      moreShots: 'HOME',
      doubleChance: 'HOME_DRAW',
    });

    assert.deepEqual(parsed, {
      externalFixtureId: '123',
      competitionId: 1,
      homeGoals: 2,
      awayGoals: 1,
      isJoker: true,
    });
  });

  it('defaults joker to false', () => {
    const parsed = predictionSchema.parse({
      externalFixtureId: '456',
      competitionId: 1,
      homeGoals: 0,
      awayGoals: 0,
    });

    assert.equal(parsed.isJoker, false);
  });

  it('requires both scores', () => {
    assert.throws(() => predictionSchema.parse({
      externalFixtureId: '789',
      competitionId: 1,
      homeGoals: 1,
    }));
  });
});

describe('scoringConfigSchema', () => {
  it('keeps only exact score and correct winner settings', () => {
    const parsed = scoringConfigSchema.parse({
      exactScore: 10,
      correctWinner: 3,
      moreShots: 2,
      overUnder: 2,
    });

    assert.deepEqual(parsed, {
      exactScore: 10,
      correctWinner: 3,
    });
  });
});

describe('joker admin schemas', () => {
  it('accepts manual phase fallback config', () => {
    const parsed = jokerConfigSchema.parse({
      competitionId: 1,
      phaseMode: 'AUTO_WITH_MANUAL_FALLBACK',
      manualPhaseKey: 'round32',
    });

    assert.deepEqual(parsed, {
      competitionId: 1,
      phaseMode: 'AUTO_WITH_MANUAL_FALLBACK',
      manualPhaseKey: 'round32',
    });
  });

  it('accepts a phase grant amount and message', () => {
    const parsed = jokerGrantSchema.parse({
      competitionId: 1,
      phaseKey: 'round16',
      amount: 2,
      message: 'Nueva fase: 2 x2 para octavos',
    });

    assert.equal(parsed.phaseKey, 'round16');
    assert.equal(parsed.amount, 2);
  });

  it('rejects invalid grant amounts', () => {
    assert.throws(() => jokerGrantSchema.parse({
      competitionId: 1,
      phaseKey: 'quarter',
      amount: 0,
    }));
  });
});

describe('group schemas', () => {
  it('strips legacy extra-market toggles from group creation', () => {
    const parsed = groupCreateSchema.parse({
      name: 'Amigos',
      description: '',
      competitionId: 1,
      allowMoreShots: true,
    });

    assert.equal(parsed.allowMoreShots, undefined);
  });

  it('keeps join policy editable and strips legacy market toggles from group theme', () => {
    const parsed = groupThemeSchema.parse({
      joinPolicy: 'WHITELIST_WITH_CODE',
      allowMoreCorners: true,
    });

    assert.deepEqual(parsed, {
      joinPolicy: 'WHITELIST_WITH_CODE',
    });
  });
});
