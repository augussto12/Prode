import { StakeArgentinaImporter } from './stake-argentina.importer.js';

/**
 * @typedef {Object} ImportedSelection
 * @property {number} sourceIndex Original position in the provider response.
 * @property {string} player
 * @property {string} market Provider market key; no speculative translation.
 * @property {'over'|'under'} direction
 * @property {string} line Decimal string.
 * @property {'unknown'} resultStatus
 *
 * @typedef {Object} ImportedBetGroup
 * @property {string} eventId
 * @property {string} event
 * @property {string} groupOdds Decimal string; not an individual selection price.
 * @property {ImportedSelection[]} selections
 *
 * @typedef {Object} ImportedBet
 * @property {string} provider
 * @property {string} host
 * @property {string} ticketUuid External identity, independent of the post's author.
 * @property {string} iid
 * @property {string} originalUrl Canonical shared URL without tracking parameters.
 * @property {string} sourceType
 * @property {string} sourceTicketType
 * @property {string} originalOdds Decimal string.
 * @property {string} betAcceptanceStatus Original provider status, not a settlement verdict.
 * @property {'unknown'} settlementStatus
 * @property {number} groupsCount
 * @property {number} selectionCount
 * @property {ImportedBetGroup[]} groups
 *
 * @typedef {{state:'ready', httpStatus:number, ticket:ImportedBet}|{state:'failed'|'partial'|'not_accessible'|'not_supported', code:string, message:string, httpStatus?:number}} ImportResult
 *
 * @typedef {Object} BetImporter
 * @property {string} providerId
 * @property {(url: string) => boolean} canHandle
 * @property {(url: string) => Promise<ImportResult>} import
 * All adapters return {state:'ready', ticket} or {state, code, message}.
 * Ticket identity is independent of posts/groups; amounts and accounts are omitted.
 * Unimplemented providers must not claim an enriched ticket.
 */
export function createBetImportService(importers = [new StakeArgentinaImporter()]) {
  return {
    async import(url) {
      const importer = importers.find((candidate) => candidate.canHandle(url));
      if (!importer) return { state: 'not_supported', code: 'UNSUPPORTED_PROVIDER', message: 'No hay un importador disponible para este enlace.' };
      return importer.import(url);
    },
  };
}
