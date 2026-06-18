import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLeaderboard } from '../src/services/group.service.js';

function member({ userId, totalPoints, joinedAt, displayName }) {
  return {
    userId,
    totalPoints,
    joinedAt,
    isAdmin: false,
    user: {
      id: userId,
      username: `user${userId}`,
      displayName,
      avatar: null,
    },
  };
}

describe('buildLeaderboard', () => {
  it('uses exact hits as the tiebreaker after total points', () => {
    const leaderboard = buildLeaderboard(
      [
        member({ userId: 1, totalPoints: 30, joinedAt: '2026-01-01T00:00:00Z', displayName: 'Ana' }),
        member({ userId: 2, totalPoints: 30, joinedAt: '2026-01-02T00:00:00Z', displayName: 'Bruno' }),
        member({ userId: 3, totalPoints: 33, joinedAt: '2026-01-03T00:00:00Z', displayName: 'Carla' }),
      ],
      new Map([
        [1, 1],
        [2, 3],
        [3, 0],
      ]),
    );

    assert.deepEqual(leaderboard.map((entry) => entry.userId), [3, 2, 1]);
    assert.deepEqual(leaderboard.map((entry) => entry.rank), [1, 2, 3]);
    assert.equal(leaderboard[1].exactHits, 3);
  });

  it('keeps joined order when points and exact hits are tied', () => {
    const leaderboard = buildLeaderboard(
      [
        member({ userId: 2, totalPoints: 20, joinedAt: '2026-01-02T00:00:00Z', displayName: 'Bruno' }),
        member({ userId: 1, totalPoints: 20, joinedAt: '2026-01-01T00:00:00Z', displayName: 'Ana' }),
      ],
      new Map([
        [1, 2],
        [2, 2],
      ]),
    );

    assert.deepEqual(leaderboard.map((entry) => entry.userId), [1, 2]);
  });
});
