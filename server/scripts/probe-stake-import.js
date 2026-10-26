import { createBetImportService } from '../src/services/bet-imports/index.js';

// Explicit CLI only: no .env, cookies, account tokens, browser or database access.
const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith('--'));
if (!url || args.some((arg) => arg.startsWith('--') && !['--expect-sample', '--json'].includes(arg))) {
  console.error('Uso: node scripts/probe-stake-import.js <enlace> [--expect-sample] [--json]');
  process.exitCode = 1;
} else {
  const result = await createBetImportService().import(url);
  if (result.state === 'ready') {
    const { ticket } = result;
    const expectedSample = ticket.iid === 'sport:899911' &&
      ticket.ticketUuid === 'e3351002-10aa-43bd-812f-751e71d2f637' &&
      ticket.selectionCount === 8 && ticket.groupsCount === 4 && ticket.originalOdds === '27.078583';
    if (args.includes('--expect-sample') && !expectedSample) {
      console.log(JSON.stringify({ state: 'failed', code: 'SAMPLE_MISMATCH', httpStatus: result.httpStatus }));
      process.exitCode = 2;
    } else {
      console.log(JSON.stringify(args.includes('--json') ? result : {
        state: result.state, httpStatus: result.httpStatus,
        groupsCount: ticket.groupsCount, selectionCount: ticket.selectionCount,
        originalOdds: ticket.originalOdds, betAcceptanceStatus: ticket.betAcceptanceStatus,
        settlementStatus: ticket.settlementStatus,
      }, null, 2));
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 2;
  }
}
