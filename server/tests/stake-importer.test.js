import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StakeArgentinaImporter, parseStakeUrl } from '../src/services/bet-imports/stake-argentina.importer.js';
import { createBetImportService } from '../src/services/bet-imports/index.js';
import { STAKE_BET_LOOKUP_QUERY } from '../src/services/bet-imports/stake-query.js';

const URL = 'https://pba.stake.bet.ar/sports/home?betId=e3351002-10aa-43bd-812f-751e71d2f637&source=link_shared&modal=bet&iid=sport%3A899911';

// SYNTHETIC transport fixture, based on the normalized example in the ZIP.
// This is NOT the original GraphQL response and does not establish a live contract.
function fixture() {
  const events = [
    ['6973e08c-075d-4ad7-9ea3-77188cc3c8c0', 'Cleveland Cavaliers - Minnesota Timberwolves', '2.15'],
    ['725da54b-b067-4fc0-a5be-52704a34ef33', 'Miami Heat - Dallas Mavericks', '2.19'],
    ['fdc07674-f593-4775-854b-ee1b3e7cc668', 'Boston Celtics - Chicago Bulls', '2.70'],
    ['4bd77051-afa6-44f5-a89a-2b4ee541d5ed', 'Charlotte Hornets - Washington Wizards', '2.13'],
  ];
  const rows = [
    [0, 'Donovan Mitchell', 'rebounds', 'over', 3.5],
    [1, 'Davion Mitchell', 'points', 'over', 9.5],
    [1, 'Bam Adebayo', 'points+assists+rebounds', 'under', 37.5],
    [2, 'Tre Jones', 'points', 'over', 8.5],
    [2, 'Jalen Smith', 'points', 'over', 8.5],
    [3, 'Ryan Kalkbrenner', 'points', 'over', 4.5],
    [0, 'Jaden McDaniels', 'rebounds', 'over', 3.5],
    [3, 'Grayson Allen', 'points', 'over', 11.5],
  ];
  return { data: { bet: {
    id: 'e3351002-10aa-43bd-812f-751e71d2f637', iid: 'sport:899911',
    bet: {
      __typename: 'SwishBet', potentialMultiplier: 27.078583, status: 'confirmed',
      amount: 7500, currency: 'ars', user: { username: 'PRIVATE_TEST_ACCOUNT' },
      outcomes: rows.map(([eventIndex, player, market, lineType, line]) => {
        const [id, name, totalOdds] = events[eventIndex];
        return { lineType, totalOdds, odds: 999, outcome: {
          line, name: market, competitor: { name: player },
          market: { game: { fixture: { id, name } } },
        } };
      }),
    },
  } } };
}

function response(payload = fixture()) {
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
}

async function importPayload(payload) {
  return new StakeArgentinaImporter({ fetchImpl: async () => response(payload) }).import(URL);
}

describe('Stake importer: URL validation and transport boundaries', () => {
  it('sends only the fixed query and iid to the fixed endpoint without authentication', async () => {
    let calls = 0;
    const importer = new StakeArgentinaImporter({ fetchImpl: async (endpoint, options) => {
      calls++;
      assert.equal(endpoint, 'https://pba.stake.bet.ar/_api/graphql');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'manual');
      assert.equal(options.method, 'POST');
      assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Content-Type']);
      assert.deepEqual(JSON.parse(options.body), {
        operationName: 'BetLookup', variables: { iid: 'sport:899911' }, query: STAKE_BET_LOOKUP_QUERY,
      });
      assert.doesNotMatch(STAKE_BET_LOOKUP_QUERY, /\b(amount|currency|user)\b/);
      return response();
    } });
    assert.equal((await importer.import(URL)).state, 'ready');
    assert.equal(calls, 1);
    assert.doesNotMatch(parseStakeUrl(URL).originalUrl, /source=/);
  });

  for (const [label, value] of [
    ['HTTP', URL.replace('https:', 'http:')],
    ['lookalike domain', URL.replace('pba.stake.bet.ar', 'pba.stake.bet.ar.evil.test')],
    ['userinfo', URL.replace('https://', 'https://name:password@')],
    ['private destination', URL.replace('pba.stake.bet.ar', '127.0.0.1')],
    ['port', URL.replace('pba.stake.bet.ar', 'pba.stake.bet.ar:8443')],
    ['wrong path', URL.replace('/sports/home', '/_api/graphql')],
    ['duplicate iid', `${URL}&iid=sport:899288`],
    ['duplicate UUID', `${URL}&betId=e3351002-10aa-43bd-812f-751e71d2f637`],
    ['invalid iid', URL.replace('sport%3A899911', 'sport%3Aabc')],
    ['invalid UUID', URL.replace('e3351002-10aa-43bd-812f-751e71d2f637', 'abc')],
    ['fragment', `${URL}#secret`],
    ['oversized URL', `${URL}&x=${'a'.repeat(2048)}`],
    ['not a URL', 'hello'],
  ]) {
    it(`rejects ${label} without any network request`, async () => {
      const importer = new StakeArgentinaImporter({ fetchImpl: async () => assert.fail('must not fetch') });
      const result = await importer.import(value);
      assert.notEqual(result.state, 'ready');
      assert.equal(result.ticket, undefined);
    });
  }
});

describe('Stake normalization', () => {
  it('preserves all eight selections, four event groups and original decimal odds', async () => {
    const { state, ticket } = await importPayload(fixture());
    assert.equal(state, 'ready');
    assert.equal(ticket.groupsCount, 4);
    assert.equal(ticket.selectionCount, 8);
    assert.equal(ticket.originalOdds, '27.078583');
    assert.deepEqual(ticket.groups.map((g) => g.groupOdds), ['2.15', '2.19', '2.7', '2.13']);
    assert.ok(ticket.groups.every((g) => g.selections.length === 2));
    const bam = ticket.groups[1].selections[1];
    assert.deepEqual(bam, { sourceIndex: 2, player: 'Bam Adebayo', market: 'points+assists+rebounds', direction: 'under', line: '37.5', resultStatus: 'unknown' });
    assert.equal(ticket.groups[3].selections[1].player, 'Grayson Allen');
    assert.equal(ticket.betAcceptanceStatus, 'confirmed');
    assert.equal(ticket.settlementStatus, 'unknown');
    assert.doesNotMatch(JSON.stringify(ticket), /7500|PRIVATE_TEST_ACCOUNT|amount|currency|username/);
    assert.ok(ticket.groups.flatMap((g) => g.selections).every((s) => !Object.hasOwn(s, 'odds')));
  });

  for (const [label, mutate, code] of [
    ['UUID mismatch', (p) => { p.data.bet.id = '916b119d-e59b-4cab-9bee-a305f62831f7'; }, 'IDENTIFIER_MISMATCH'],
    ['IID mismatch', (p) => { p.data.bet.iid = 'sport:899288'; }, 'IDENTIFIER_MISMATCH'],
    ['unknown type', (p) => { p.data.bet.bet.__typename = 'SportBet'; }, 'UNSUPPORTED_TYPE'],
    ['missing outcomes', (p) => { p.data.bet.bet.outcomes = null; }, 'INCOMPLETE_DATA'],
    ['empty outcomes', (p) => { p.data.bet.bet.outcomes = []; }, 'INCOMPLETE_DATA'],
    ['missing event ID', (p) => { delete p.data.bet.bet.outcomes[0].outcome.market.game.fixture.id; }, 'INCOMPLETE_DATA'],
    ['missing player', (p) => { p.data.bet.bet.outcomes[0].outcome.competitor = null; }, 'INCOMPLETE_DATA'],
    ['missing line', (p) => { p.data.bet.bet.outcomes[0].outcome.line = null; }, 'INVALID_DECIMAL'],
    ['invalid odds', (p) => { p.data.bet.bet.potentialMultiplier = 'NaN'; }, 'INVALID_DECIMAL'],
    ['inconsistent repeated odds', (p) => { p.data.bet.bet.outcomes[6].totalOdds = 3; }, 'INCONSISTENT_GROUP'],
    ['unsupported direction', (p) => { p.data.bet.bet.outcomes[0].lineType = 'other'; }, 'UNSUPPORTED_DIRECTION'],
    ['partial GraphQL failure', (p) => { p.errors = [{ message: 'PRIVATE_TEST_ACCOUNT' }]; }, 'GRAPHQL_ERROR'],
  ]) {
    it(`does not return a ticket for ${label}`, async () => {
      const payload = fixture();
      mutate(payload);
      const result = await importPayload(payload);
      assert.equal(result.code, code);
      assert.equal(result.ticket, undefined);
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TEST_ACCOUNT/);
    });
  }

  it('does not merge different event IDs with identical names', async () => {
    const payload = fixture();
    for (const item of payload.data.bet.bet.outcomes) item.outcome.market.game.fixture.name = 'Same label';
    assert.equal((await importPayload(payload)).ticket.groupsCount, 4);
  });

  it('accepts canonical-equivalent repeated decimal odds and zero lines', async () => {
    const payload = fixture();
    payload.data.bet.bet.outcomes[0].totalOdds = '2.150000';
    payload.data.bet.bet.outcomes[0].outcome.line = 0;
    const result = await importPayload(payload);
    assert.equal(result.ticket.groups[0].groupOdds, '2.15');
    assert.equal(result.ticket.groups[0].selections[0].line, '0');
  });
});

describe('Stake provider failures', () => {
  for (const [status, code] of [[401, 'ACCESS_DENIED'], [403, 'ACCESS_DENIED'], [429, 'RATE_LIMITED'], [302, 'REDIRECT_BLOCKED'], [500, 'PROVIDER_HTTP_ERROR']]) {
    it(`handles HTTP ${status} without retries or leaking the body`, async () => {
      let calls = 0;
      const importer = new StakeArgentinaImporter({ fetchImpl: async () => {
        calls++;
        return new Response('PRIVATE_TEST_ACCOUNT', { status });
      } });
      const result = await importer.import(URL);
      assert.equal(result.code, code);
      assert.equal(result.httpStatus, status);
      assert.equal(calls, 1);
      assert.equal(result.ticket, undefined);
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TEST_ACCOUNT/);
    });
  }

  it('aborts a slow request and returns a timeout', async () => {
    const importer = new StakeArgentinaImporter({ timeoutMs: 10, fetchImpl: (_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('private transport details')), { once: true });
    }) });
    assert.equal((await importer.import(URL)).code, 'TIMEOUT');
  });

  it('limits total response-body time, not only response headers', async () => {
    const importer = new StakeArgentinaImporter({ timeoutMs: 10, fetchImpl: async (_, { signal }) => new Response(new ReadableStream({
      start(controller) { signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true }); },
    }), { headers: { 'content-type': 'application/json' } }) });
    assert.equal((await importer.import(URL)).code, 'TIMEOUT');
  });

  it('does not echo network errors', async () => {
    const importer = new StakeArgentinaImporter({ fetchImpl: async () => { throw new Error('PRIVATE_TEST_ACCOUNT'); } });
    const result = await importer.import(URL);
    assert.equal(result.code, 'NETWORK_ERROR');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TEST_ACCOUNT/);
  });

  it('rejects HTML challenges and malformed JSON', async () => {
    for (const headers of [{ 'content-type': 'text/html' }, { 'content-type': 'application/json' }]) {
      const importer = new StakeArgentinaImporter({ fetchImpl: async () => new Response('<html>challenge</html>', { headers }) });
      assert.equal((await importer.import(URL)).code, 'INVALID_RESPONSE');
    }
  });

  it('enforces body limits with and without Content-Length', async () => {
    for (const lengthHeader of [false, true]) {
      const importer = new StakeArgentinaImporter({ maxResponseBytes: 50, fetchImpl: async () => new Response('x'.repeat(100), {
        headers: { 'content-type': 'application/json', ...(lengthHeader ? { 'content-length': '100' } : {}) },
      }) });
      assert.equal((await importer.import(URL)).code, 'RESPONSE_TOO_LARGE');
    }
  });

  it('handles missing tickets', async () => {
    assert.equal((await importPayload({ data: { bet: null } })).code, 'NOT_FOUND');
  });

  it('keeps provider dispatch extensible and never invents an import for unsupported houses', async () => {
    const result = await createBetImportService([]).import('https://example.com/ticket');
    assert.equal(result.code, 'UNSUPPORTED_PROVIDER');
    assert.equal(result.ticket, undefined);
    const mock = { providerId: 'test', canHandle: (url) => url === 'test-url', import: async () => ({ state: 'test-result' }) };
    assert.equal((await createBetImportService([mock]).import('test-url')).state, 'test-result');
  });
});
