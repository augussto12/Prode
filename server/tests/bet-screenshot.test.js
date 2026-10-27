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

test('Bet365 multiple builders keep odds on each match group, not each player', () => {
  const parsed = parseBetOcrText(`CREAR APUESTA 1.62
Giannis Antetokounmpo - 25+ puntos
Davion Mitchell - 5+ asistencias
Bam Adebayo - 7+ rebotes
DAL Mavericks
MIA Heat
CREAR APUESTA 4.30
Jayson Tatum - 25+ puntos
Jayson Tatum - 10+ rebotes
Norman Powell - 15+ puntos
CHI Bulls
BOS Celtics`, 'bet365');
  assert.equal(parsed.totalOdds, null);
  assert.equal(parsed.selections.length, 6);
  assert.equal(parsed.selections[0].event, 'DAL Mavericks - MIA Heat');
  assert.equal(parsed.selections[3].event, 'CHI Bulls - BOS Celtics');
  assert.equal(parsed.selections[0].groupOdds, '1.62');
  assert.equal(parsed.selections[3].groupOdds, '4.30');
  assert.ok(parsed.selections.every((selection) => selection.odds === null));
});

test('Stake keeps separate match-group odds when a ticket contains two games', () => {
  const parsed = parseBetOcrText(`Multi apuesta del mismo partido (2) 1,80
Denver Nuggets - Golden State Warriors
Sobre 2.5 Triples realizados
Stephen Curry
Sobre 5.5 Rebotes
Jamal Murray
Multi apuesta del mismo partido (2) 2,10
Boston Celtics - Miami Heat
Sobre 20.5 Puntos
Jayson Tatum
Sobre 6.5 Rebotes
Bam Adebayo`);
  assert.equal(parsed.totalOdds, null);
  assert.deepEqual(parsed.selections.map((selection) => selection.groupOdds), ['1.80', '1.80', '2.10', '2.10']);
});

test('Bet365 one builder has ticket odds and ignores live stat numbers', () => {
  const parsed = parseBetOcrText(`CREAR APUESTA 23.00
Yaxel Lendeborg - 15+ puntos
17
Brandin Podziemski - 15+ puntos
13 14.5
Yaxel Lendeborg - 3+ asistencias
3
GS Warriors
DEN Nuggets
Apuesta $4.600,00`, 'bet365');
  assert.equal(parsed.totalOdds, '23.00');
  assert.equal(parsed.selections.length, 3);
  assert.equal(parsed.selections[0].event, 'GS Warriors - DEN Nuggets');
  assert.ok(parsed.selections.every((selection) => selection.odds === null));
});

test('Betano combined ticket reads per-game builder odds and selections', () => {
  const parsed = parseBetOcrText(`Combinada de 4
Bet Builder 2.18
Oklahoma City Thunder
Phoenix Suns
6+ Aday Mara Total de Puntos
5+ Aday Mara Total de rebotes
Bet Builder 1.78
6+ Jaime Jaquez Jr. Total de rebotes
Milwaukee Bucks
Indiana Pacers
Bet Builder 1.75
Utah Jazz
Memphis Grizzlies
6+ Keyonte George Total de Asistencias
5+ Ty Jerome Total de Asistencias
Bet Builder 2.20
Houston Rockets
Atlanta Hawks
5+ Alperen Sengun Total de Asistencias
6+ Jalen Johnson Total de rebotes`, 'betano');
  assert.equal(parsed.totalOdds, null);
  assert.equal(parsed.selections.length, 7);
  assert.equal(parsed.selections[0].groupOdds, '2.18');
  assert.equal(parsed.selections[2].event, 'Milwaukee Bucks - Indiana Pacers');
  assert.equal(parsed.selections[6].groupOdds, '2.20');
});

test('Bet365 simple picks keep their own odds and their own games', () => {
  const parsed = parseBetOcrText(`Ace Bailey - 5+ rebotes
MEM Grizzlies
UTA Jazz
Luguentz Dort: 5+ puntos 1.44
ATL Hawks
HOU Rockets
Kyle Kuzma: 5+ rebotes 1.44
IND Pacers
MIL Bucks
Christian Braun: 5+ rebotes 1.68
GS Warriors
DEN Nuggets`, 'bet365');
  assert.equal(parsed.selections.length, 4);
  assert.equal(parsed.selections[0].event, 'MEM Grizzlies - UTA Jazz');
  assert.equal(parsed.selections[1].event, 'ATL Hawks - HOU Rockets');
  assert.equal(parsed.selections[1].odds, '1.44');
  assert.equal(parsed.selections[3].odds, '1.68');
  assert.equal(parsed.selections[3].groupOdds, null);
});

test('Bet365 derives total odds from displayed stake and potential payout without exposing the amounts', () => {
  const parsed = parseBetOcrText(`Christian Braun: 5+ rebotes 1.68
GS Warriors
DEN Nuggets
Apuesta
$4.600,00
Ganancias potenciales
$105.800,00`, 'bet365');
  assert.equal(parsed.totalOdds, '23.00');
  assert.doesNotMatch(JSON.stringify(parsed.selections), /4\.600|105\.800/);
});

test('Bet365 keeps a displayed payout-based total across several builder groups', () => {
  const parsed = parseBetOcrText(`CREAR APUESTA 1.62
Giannis Antetokounmpo - 25+ puntos
DAL Mavericks
MIA Heat
CREAR APUESTA 4.30
Jayson Tatum - 25+ puntos
CHI Bulls
BOS Celtics
Apuesta $100,00
Ganancias potenciales $696,60`, 'bet365');
  assert.equal(parsed.totalOdds, '6.97');
  assert.deepEqual(parsed.selections.map((selection) => selection.groupOdds), ['1.62', '4.30']);
});
