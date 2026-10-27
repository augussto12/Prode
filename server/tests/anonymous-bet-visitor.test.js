import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymousBetVisitor } from '../src/utils/anonymous-bet-visitor.js';

test('anonymous bet cookie identifies one browser without accepting a forged identity', () => {
  const secret = 'test-only-secret';
  const first = anonymousBetVisitor(null, secret);
  assert.equal(first.fresh, true);
  const repeat = anonymousBetVisitor(first.cookie, secret);
  assert.equal(repeat.fresh, false);
  assert.equal(repeat.visitorKey, first.visitorKey);
  const forged = `${first.cookie.slice(0, -1)}${first.cookie.endsWith('0') ? '1' : '0'}`;
  assert.notEqual(anonymousBetVisitor(forged, secret).visitorKey, first.visitorKey);
  assert.notEqual(anonymousBetVisitor(first.cookie, 'different-secret').visitorKey, first.visitorKey);
});
