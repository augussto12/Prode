import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineBetOcrTexts, detectProviderFromText, parseBetOcrText } from '../src/services/bet-screenshot.service.js';
import { detectProviderFromUrl } from '../src/services/bet-community.service.js';

test('bookmaker is detected from the usual shared links', () => {
  assert.equal(detectProviderFromUrl('https://www.bet365.bet.ar/s/r/glfrM'), 'bet365');
  assert.equal(detectProviderFromUrl('https://www.betano.bet.ar/bookingcode/MGK5HSFM/'), 'betano');
  assert.equal(detectProviderFromUrl('https://pba.stake.bet.ar/sports/home?betId=5fc3dfe6-5aa3-48e8-9dbe-9285aa8b7552&source=link_shared&modal=bet&iid=sport%3A915877'), 'stake_pba');
  assert.equal(detectProviderFromUrl('https://example.com/x'), null);
});

test('bookmaker is detected from screenshot text', () => {
  assert.equal(detectProviderFromText('CREAR APUESTA 2.75\nDuncan Robinson - 10+ puntos'), 'bet365');
  assert.equal(detectProviderFromText('Doble $10.000,00 16.42\nCreador de Apuestas 4.50'), 'betano');
  assert.equal(detectProviderFromText('Multi apuesta del mismo partido (6 9,80'), 'stake_pba');
});

test('Stake two overlapping screenshots: kick-off time and no duplicated markets', () => {
  const first = `Apuesta
Multi apuesta del mismo partido (6 9,80
Denver Nuggets - Golden State Warriors
En vivo lun, 26 oct 11:00 p. m.
29' 2° Cuarto
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
  const second = `Apuesta
Brandin Podziemski
8 12
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
Stake
Apuesta $ 15.000,00
Pago $ 147.000,00`;
  const parsed = combineBetOcrTexts([first, second]);
  assert.equal(parsed.selections.length, 6);
  assert.equal(parsed.totalOdds, '9.80');
  assert.equal(parsed.selections[0].startsAt, 'En vivo lun, 26 oct 11:00 p. m.');
  assert.doesNotMatch(JSON.stringify(parsed), /15\.000|147\.000/);
});

test('Betano "Creador de Apuestas" blocks keep their odds and kick-off', () => {
  const parsed = parseBetOcrText(`Doble $10.000,00 16.42
Creador de Apuestas 4.50
San Antonio Spurs
Sacramento Kings
Esta noche 21:00
10+ Victor Wembanyama Total de rebotes
Creador de Apuestas
3.65
Los Angeles Lakers
Portland Trail Blazers
Esta noche 00:00
3+ Damian Lillard Total de Asistencias`, 'betano');
  assert.deepEqual(parsed.selections.map((item) => item.groupOdds), ['4.50', '3.65']);
  assert.equal(parsed.selections[0].startsAt, 'Esta noche 21:00');
  assert.equal(parsed.selections[1].event, 'Los Angeles Lakers - Portland Trail Blazers');
});
