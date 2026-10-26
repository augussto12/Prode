import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StakeArgentinaImporter } from '../src/services/bet-imports/stake-argentina.importer.js';

const responseFile = new URL('./fixtures/stake/stake_899911_graphql_response_original_sanitizada.json', import.meta.url);
const sharedUrl = 'https://pba.stake.bet.ar/sports/home?betId=e3351002-10aa-43bd-812f-751e71d2f637&iid=sport%3A899911';
const loadOriginal = () => JSON.parse(readFileSync(responseFile, 'utf8'));
const importRecorded = (payload) => new StakeArgentinaImporter({ fetchImpl: async () => new Response(
  JSON.stringify(payload), { headers: { 'content-type': 'application/json' } },
) }).import(sharedUrl);

describe('Stake contract against user-supplied sanitized Network response (offline)', () => {
  it('reconstructs every recorded selection and original event grouping without altering the source', async () => {
    const original = loadOriginal();
    const before = structuredClone(original);
    const { state, ticket } = await importRecorded(original);
    assert.equal(state, 'ready');
    assert.deepEqual(original, before);
    assert.equal(ticket.ticketUuid, 'e3351002-10aa-43bd-812f-751e71d2f637');
    assert.equal(ticket.iid, 'sport:899911');
    assert.equal(ticket.selectionCount, 8);
    assert.equal(ticket.groupsCount, 4);
    assert.equal(ticket.originalOdds, '27.078583');
    assert.equal(ticket.betAcceptanceStatus, 'confirmed');
    assert.equal(ticket.settlementStatus, 'unknown');
    assert.deepEqual(ticket.groups.map(({ eventId, event, groupOdds, selections }) => [eventId, event, groupOdds, selections.length]), [
      ['6973e08c-075d-4ad7-9ea3-77188cc3c8c0', 'Cleveland Cavaliers - Minnesota Timberwolves', '2.15', 2],
      ['725da54b-b067-4fc0-a5be-52704a34ef33', 'Miami Heat - Dallas Mavericks', '2.19', 2],
      ['fdc07674-f593-4775-854b-ee1b3e7cc668', 'Boston Celtics - Chicago Bulls', '2.7', 2],
      ['4bd77051-afa6-44f5-a89a-2b4ee541d5ed', 'Charlotte Hornets - Washington Wizards', '2.13', 2],
    ]);
    const rows = ticket.groups.flatMap((group) => group.selections).sort((a, b) => a.sourceIndex - b.sourceIndex);
    assert.deepEqual(rows.map(({ sourceIndex, player, market, direction, line, resultStatus }) => [sourceIndex, player, market, direction, line, resultStatus]), [
      [0, 'Donovan Mitchell', 'rebounds', 'over', '3.5', 'unknown'],
      [1, 'Davion Mitchell', 'points', 'over', '9.5', 'unknown'],
      [2, 'Bam Adebayo', 'points+assists+rebounds', 'under', '37.5', 'unknown'],
      [3, 'Tre Jones', 'points', 'over', '8.5', 'unknown'],
      [4, 'Jalen Smith', 'points', 'over', '8.5', 'unknown'],
      [5, 'Ryan Kalkbrenner', 'points', 'over', '4.5', 'unknown'],
      [6, 'Jaden McDaniels', 'rebounds', 'over', '3.5', 'unknown'],
      [7, 'Grayson Allen', 'points', 'over', '11.5', 'unknown'],
    ]);
    assert.doesNotMatch(JSON.stringify(ticket), /"(?:amount|activeAmount|payout|payoutMultiplier|currency|user|odds|stats|cashouts)":/);
  });

  it('works with only the fields requested by the importer query, without relying on Network-only data', async () => {
    const original = loadOriginal().data.bet;
    const payload = { data: { bet: { id: original.id, iid: original.iid, bet: {
      __typename: original.bet.__typename,
      potentialMultiplier: original.bet.potentialMultiplier,
      status: original.bet.status,
      outcomes: original.bet.outcomes.map(({ lineType, totalOdds, outcome }) => ({
        lineType, totalOdds, outcome: {
          line: outcome.line, name: outcome.name, competitor: { name: outcome.competitor.name },
          market: { game: { fixture: {
            id: outcome.market.game.fixture.id, name: outcome.market.game.fixture.name,
          } } },
        },
      })),
    } } } };
    assert.deepEqual(await importRecorded(payload), await importRecorded(loadOriginal()));
  });

  it('refuses to claim a complete import if fixture IDs are omitted as in the exact browser query', async () => {
    const payload = loadOriginal();
    for (const item of payload.data.bet.bet.outcomes) delete item.outcome.market.game.fixture.id;
    const result = await importRecorded(payload);
    assert.equal(result.state, 'partial');
    assert.equal(result.code, 'INCOMPLETE_DATA');
    assert.equal(result.ticket, undefined);
  });
});
