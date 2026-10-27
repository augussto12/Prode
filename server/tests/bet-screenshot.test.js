import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineBetOcrTexts, parseBetOcrText } from '../src/services/bet-screenshot.service.js';

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

test('OCR text reads stacked player, selection and odds', () => {
  const parsed = parseBetOcrText(`Warriors vs Lakers
Stephen Curry
Más de 3,5 triples
1,85
Cuota total
4,60`);
  assert.equal(parsed.selections.length, 1);
  assert.equal(parsed.selections[0].player, 'Stephen Curry');
  assert.equal(parsed.selections[0].odds, '1.85');
  assert.equal(parsed.totalOdds, '4.60');
});

test('Stake screenshots combine one match and six unique markets without treating live counts as odds', () => {
  const upper = `Multi apuesta del mismo partido (6 9,80
Denver Nuggets - Golden State Warriors
Denver Nuggets 50
Golden State Warriors 47
Sobre 10.5 Puntos
DeMar DeRozan
12
Sobre 11.5 Puntos
Brandin Podziemski
8 12
Sobre 2.5 Triples realizados
Stephen Curry
1 3
Sobre 5.5 Rebotes
Yaxel Lendeborg`;
  const lower = `Brandin Podziemski
Sobre 2.5 Triples realizados
Stephen Curry
1 3
Sobre 5.5 Rebotes
Yaxel Lendeborg
3 6
Sobre 4.5 Asistencias
Jamal Murray
5
Sobre 3.5 Rebotes
Jamal Murray
3 4
Stake`;
  const parsed = combineBetOcrTexts([upper, lower]);
  assert.equal(parsed.totalOdds, '9.80');
  assert.equal(parsed.expectedSelections, 6);
  assert.equal(parsed.selections.length, 6);
  assert.ok(parsed.selections.every((selection) => selection.event === 'Denver Nuggets - Golden State Warriors'));
  assert.ok(parsed.selections.every((selection) => selection.odds === null));
  assert.deepEqual(parsed.selections.map((selection) => selection.player),
    ['DeMar DeRozan', 'Brandin Podziemski', 'Stephen Curry', 'Yaxel Lendeborg', 'Jamal Murray', 'Jamal Murray']);
});
