import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePredictionWindows,
  normalizePhase,
} from '../src/services/phase-window.service.js';

function fixture(id, round, date, status = 'NS', homeId = 1, awayId = 2) {
  return {
    fixture: {
      id,
      date,
      status: { short: status },
    },
    league: { round },
    teams: {
      home: { id: homeId, name: homeId ? `Team ${homeId}` : 'TBD' },
      away: { id: awayId, name: awayId ? `Team ${awayId}` : 'TBD' },
    },
  };
}

describe('phase prediction windows', () => {
  it('normalizes API-Football knockout rounds', () => {
    assert.equal(normalizePhase('Group Stage - 1'), 'group');
    assert.equal(normalizePhase('Round of 32'), 'round32');
    assert.equal(normalizePhase('Round of 16'), 'round16');
    assert.equal(normalizePhase('Quarter-finals'), 'quarter');
    assert.equal(normalizePhase('Semi-finals'), 'semi');
    assert.equal(normalizePhase('3rd Place Final'), 'thirdPlace');
    assert.equal(normalizePhase('Final'), 'final');
  });

  it('keeps published knockout fixtures open even if the previous phase is not finished', () => {
    const windows = computePredictionWindows([
      fixture(1, 'Group Stage - 3', '2026-06-26T18:00:00.000Z', 'NS'),
      fixture(2, 'Round of 32', '2026-06-28T18:00:00.000Z'),
    ], new Date('2026-06-26T12:00:00.000Z'));

    assert.equal(windows.fixtureWindows['2'].canPredict, true);
    assert.equal(windows.fixtureWindows['2'].phaseRule, false);
    assert.equal(windows.fixtureWindows['2'].reason, null);
  });

  it('does not close a whole knockout phase when its first match starts', () => {
    const fixtures = [
      fixture(1, 'Group Stage - 3', '2026-06-26T18:00:00.000Z', 'FT'),
      fixture(2, 'Round of 32', '2026-06-28T18:00:00.000Z'),
      fixture(3, 'Round of 32', '2026-06-29T18:00:00.000Z'),
    ];

    const open = computePredictionWindows(fixtures, new Date('2026-06-27T12:00:00.000Z'));
    assert.equal(open.fixtureWindows['2'].canPredict, true);
    assert.equal(open.fixtureWindows['3'].canPredict, true);

    const afterFirstKickoff = computePredictionWindows(fixtures, new Date('2026-06-28T18:00:00.000Z'));
    assert.equal(afterFirstKickoff.fixtureWindows['2'].canPredict, true);
    assert.equal(afterFirstKickoff.fixtureWindows['3'].canPredict, true);
  });

  it('opens final after semifinals finish without requiring third-place match to finish', () => {
    const windows = computePredictionWindows([
      fixture(10, 'Semi-finals', '2026-07-10T18:00:00.000Z', 'FT'),
      fixture(11, 'Semi-finals', '2026-07-11T18:00:00.000Z', 'FT'),
      fixture(12, '3rd Place Final', '2026-07-18T18:00:00.000Z'),
      fixture(13, 'Final', '2026-07-19T18:00:00.000Z'),
    ], new Date('2026-07-12T12:00:00.000Z'));

    assert.equal(windows.fixtureWindows['12'].canPredict, true);
    assert.equal(windows.fixtureWindows['13'].canPredict, true);
  });

  it('does not open an undefined knockout fixture', () => {
    const windows = computePredictionWindows([
      fixture(1, 'Group Stage - 3', '2026-06-26T18:00:00.000Z', 'FT'),
      fixture(2, 'Round of 32', '2026-06-28T18:00:00.000Z', 'NS', null, null),
    ], new Date('2026-06-27T12:00:00.000Z'));

    assert.equal(windows.fixtureWindows['2'].canPredict, false);
    assert.match(windows.fixtureWindows['2'].reason, /equipos definidos/);
  });
});
