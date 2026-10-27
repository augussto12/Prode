import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBetOcrText } from '../src/services/bet-screenshot.service.js';

test('OCR text suggests visible selections and odds without guessing team or money', () => {
  const parsed = parseBetOcrText(`Warriors vs Lakers
Stephen Curry - Mas de 3 triples - cuota 1.80
Celtics vs Heat
Jayson Tatum - Mas de 20 puntos - cuota 2.20
Importe apostado $500
Cuota total 3.96`);
  assert.equal(parsed.selections.length, 2);
  assert.equal(parsed.selections[0].event, 'Warriors vs Lakers');
  assert.equal(parsed.selections[0].player, 'Stephen Curry');
  assert.equal(parsed.selections[0].pick, 'Mas de 3 triples');
  assert.equal(parsed.selections[0].odds, '1.80');
  assert.equal(parsed.selections[0].team, null);
  assert.equal(parsed.totalOdds, '3.96');
  assert.doesNotMatch(JSON.stringify(parsed.selections), /500/);
});
