import { STAKE_BET_LOOKUP_QUERY } from './stake-query.js';

export const STAKE_HOST = 'pba.stake.bet.ar';
const ENDPOINT = `https://${STAKE_HOST}/_api/graphql`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BetImportError extends Error {
  constructor(code, message, state = 'failed', httpStatus) {
    super(message);
    this.code = code;
    this.state = state;
    this.httpStatus = httpStatus;
  }
}

function fail(code, message, state, httpStatus) {
  throw new BetImportError(code, message, state, httpStatus);
}

export function parseStakeUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) {
    fail('INVALID_URL', 'El enlace no es válido.');
  }
  let url;
  try { url = new URL(value); } catch { fail('INVALID_URL', 'El enlace no es válido.'); }
  if (url.protocol !== 'https:' || url.hostname !== STAKE_HOST || url.port ||
      url.username || url.password || url.hash || !/^\/sports(?:\/|$)/.test(url.pathname)) {
    fail('INVALID_URL', 'Se requiere un enlace deportivo HTTPS de Stake PBA.');
  }
  const ids = url.searchParams.getAll('betId');
  const iids = url.searchParams.getAll('iid');
  if (ids.length !== 1 || iids.length !== 1 || !UUID.test(ids[0]) ||
      !/^sport:[0-9]{1,20}$/.test(iids[0])) {
    fail('INVALID_ID', 'El enlace debe contener un betId y un iid deportivo válidos, sin duplicados.');
  }
  const ticketUuid = ids[0].toLowerCase();
  const iid = iids[0];
  // Discard arbitrary parameters and tracking information from stored/displayed links.
  const canonical = new URL(`https://${STAKE_HOST}/sports/home`);
  canonical.search = new URLSearchParams({ betId: ticketUuid, modal: 'bet', iid }).toString();
  return { ticketUuid, iid, originalUrl: canonical.href };
}

function requiredText(value, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {
    fail('INCOMPLETE_DATA', 'El ticket contiene campos faltantes o inválidos.', 'partial');
  }
  return value;
}

// Decimal strings are the public/storage contract; never multiply selection odds.
function decimal(value, { odds = false } = {}) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^-?\d{1,12}(?:\.\d{1,12})?$/.test(text) ||
      (odds && Number(text) < 1)) {
    fail('INVALID_DECIMAL', 'Una línea o cuota no es válida.', 'partial');
  }
  const [integer, fraction = ''] = text.split('.');
  const normalizedInteger = BigInt(integer).toString();
  const normalizedFraction = fraction.replace(/0+$/, '');
  const sign = text.startsWith('-') && normalizedInteger === '0' && normalizedFraction ? '-' : '';
  return `${sign}${normalizedInteger}${normalizedFraction ? `.${normalizedFraction}` : ''}`;
}

export function normalizeStakeResponse(payload, expected) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('INVALID_RESPONSE', 'La respuesta del proveedor no es válida.');
  }
  // Never accept partial GraphQL data as a complete ticket, nor echo provider messages.
  if (payload.errors !== undefined && (!Array.isArray(payload.errors) || payload.errors.length)) {
    fail('GRAPHQL_ERROR', 'El proveedor no pudo devolver el ticket completo.');
  }
  const envelope = payload.data?.bet;
  if (envelope === null) fail('NOT_FOUND', 'El proveedor no encontró el ticket.', 'not_accessible');
  if (!envelope || typeof envelope.id !== 'string' || envelope.id.toLowerCase() !== expected.ticketUuid || envelope.iid !== expected.iid) {
    fail('IDENTIFIER_MISMATCH', 'Los identificadores de la respuesta no coinciden con el enlace.');
  }
  const bet = envelope.bet;
  if (!bet || typeof bet.__typename !== 'string') fail('INCOMPLETE_DATA', 'Falta el tipo de ticket.', 'partial');
  if (bet.__typename !== 'SwishBet') fail('UNSUPPORTED_TYPE', 'Este tipo de ticket todavía no está soportado.', 'not_supported');
  if (!Array.isArray(bet.outcomes) || bet.outcomes.length === 0 || bet.outcomes.length > 500) {
    fail('INCOMPLETE_DATA', 'El proveedor no devolvió selecciones válidas.', 'partial');
  }
  const originalOdds = decimal(bet.potentialMultiplier, { odds: true });
  const acceptanceStatus = requiredText(bet.status, 64);
  const groups = new Map();
  bet.outcomes.forEach((item, sourceIndex) => {
    const outcome = item?.outcome;
    const event = outcome?.market?.game?.fixture;
    const eventId = requiredText(event?.id, 128);
    const eventName = requiredText(event?.name);
    if (!['over', 'under'].includes(item?.lineType)) {
      fail('UNSUPPORTED_DIRECTION', 'La dirección de una selección todavía no está soportada.', 'not_supported');
    }
    const groupOdds = decimal(item.totalOdds, { odds: true });
    if (!groups.has(eventId)) groups.set(eventId, { eventId, event: eventName, groupOdds, selections: [] });
    const group = groups.get(eventId);
    if (group.groupOdds !== groupOdds || group.event !== eventName) {
      fail('INCONSISTENT_GROUP', 'El proveedor devolvió datos inconsistentes para un mismo partido.', 'partial');
    }
    group.selections.push({
      sourceIndex,
      player: requiredText(outcome?.competitor?.name),
      market: requiredText(outcome?.name, 128),
      direction: item.lineType,
      line: decimal(outcome?.line),
      resultStatus: 'unknown',
    });
  });
  // Explicit allowlist: extra fields (including amount/user) never reach the result.
  return {
    provider: 'stake_pba', host: STAKE_HOST,
    ticketUuid: expected.ticketUuid, iid: expected.iid, originalUrl: expected.originalUrl,
    sourceType: 'stake_graphql', sourceTicketType: 'SwishBet',
    originalOdds, betAcceptanceStatus: acceptanceStatus, settlementStatus: 'unknown',
    groupsCount: groups.size, selectionCount: bet.outcomes.length, groups: [...groups.values()],
  };
}

async function readLimitedJson(response, maxBytes) {
  if (!/^application\/(?:json|graphql-response\+json)(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    fail('INVALID_RESPONSE', 'El proveedor no devolvió JSON.');
  }
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    fail('RESPONSE_TOO_LARGE', 'La respuesta supera el tamaño permitido.');
  }
  if (!response.body) fail('INVALID_RESPONSE', 'El proveedor devolvió una respuesta vacía.');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) fail('RESPONSE_TOO_LARGE', 'La respuesta supera el tamaño permitido.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('INVALID_RESPONSE', 'El proveedor devolvió JSON inválido.'); }
}

/** BetImporter implementation. No database writes or automatic retries. */
export class StakeArgentinaImporter {
  providerId = 'stake_pba';

  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 12000, maxResponseBytes = 1024 * 1024 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
  }

  canHandle(url) {
    try { return new URL(url).hostname === STAKE_HOST; } catch { return false; }
  }

  async import(url) {
    let httpStatus;
    const controller = new AbortController();
    let timer;
    try {
      const expected = parseStakeUrl(url);
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await this.fetchImpl(ENDPOINT, {
        method: 'POST', redirect: 'manual', credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ operationName: 'BetLookup', variables: { iid: expected.iid }, query: STAKE_BET_LOOKUP_QUERY }),
      });
      httpStatus = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        if (httpStatus === 429) fail('RATE_LIMITED', 'El proveedor limitó las consultas; no se reintentó.', 'not_accessible', httpStatus);
        if (httpStatus === 401 || httpStatus === 403) fail('ACCESS_DENIED', 'El proveedor rechazó el acceso sin credenciales.', 'not_accessible', httpStatus);
        if (httpStatus >= 300 && httpStatus < 400) fail('REDIRECT_BLOCKED', 'El proveedor devolvió una redirección; no se siguió.', 'not_accessible', httpStatus);
        fail('PROVIDER_HTTP_ERROR', 'El proveedor devolvió un error HTTP.', 'not_accessible', httpStatus);
      }
      const ticket = normalizeStakeResponse(await readLimitedJson(response, this.maxResponseBytes), expected);
      return { state: 'ready', httpStatus, ticket };
    } catch (error) {
      if (error instanceof BetImportError) {
        return { state: error.state, code: error.code, message: error.message, ...(httpStatus ? { httpStatus } : {}) };
      }
      return {
        state: 'failed', code: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: controller.signal.aborted ? 'La consulta excedió el tiempo permitido.' : 'No se pudo completar la consulta al proveedor.',
        ...(httpStatus ? { httpStatus } : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
