import prisma from '../config/database.js';
import { cachedApiCall, invalidateCacheByPrefix } from './cache.service.js';
import * as footballApi from './football-api.service.js';

const FIXTURE_CACHE_TTL_SECONDS = 60;

const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const NON_PLAYED_STATUSES = new Set(['CANC', 'ABD']);

export const PHASE_LABELS = {
  group: 'Fase de grupos',
  round32: '16avos de final',
  round16: 'Octavos de final',
  quarter: 'Cuartos de final',
  semi: 'Semifinales',
  thirdPlace: 'Tercer puesto',
  final: 'Final',
};

export function normalizePhase(round) {
  const value = String(round || '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('group stage') || /^group\s+[a-z0-9]+/i.test(String(round))) return 'group';
  if (value.includes('round of 32') || value.includes('16avos')) return 'round32';
  if (value.includes('round of 16') || value.includes('octavos') || value.includes('1/8')) return 'round16';
  if (value.includes('quarter')) return 'quarter';
  if (value.includes('semi')) return 'semi';
  if (value.includes('3rd place') || value.includes('third place') || value.includes('tercer puesto')) return 'thirdPlace';
  if (value === 'final' || /^final\s*-?\s*\d*$/i.test(String(round).trim())) return 'final';
  return null;
}

export function isKnockoutPhase(phaseKey) {
  return ['round32', 'round16', 'quarter', 'semi', 'thirdPlace', 'final'].includes(phaseKey);
}

function getFixtureDate(fixture) {
  const raw = fixture?.fixture?.date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getFixtureStatus(fixture) {
  return fixture?.fixture?.status?.short || null;
}

function isFinalFixture(fixture) {
  return FINAL_STATUSES.has(getFixtureStatus(fixture));
}

function isRelevantFixture(fixture) {
  return !NON_PLAYED_STATUSES.has(getFixtureStatus(fixture));
}

function hasDefinedTeams(fixture) {
  const home = fixture?.teams?.home;
  const away = fixture?.teams?.away;
  if (!home?.id || !away?.id) return false;

  const names = `${home.name || ''} ${away.name || ''}`.toLowerCase();
  return !/(^|\s)(tbd|winner|runner|loser)(\s|$)/i.test(names);
}

function sortByDate(a, b) {
  return (getFixtureDate(a)?.getTime() || 0) - (getFixtureDate(b)?.getTime() || 0);
}

function fixturesByPhase(fixtures) {
  const map = new Map();
  for (const fixture of fixtures || []) {
    const phaseKey = normalizePhase(fixture?.league?.round);
    if (!phaseKey) continue;
    if (!map.has(phaseKey)) map.set(phaseKey, []);
    map.get(phaseKey).push(fixture);
  }
  for (const phaseFixtures of map.values()) {
    phaseFixtures.sort(sortByDate);
  }
  return map;
}

function getPreviousPhaseKey(phaseKey, byPhase) {
  if (phaseKey === 'round32') return 'group';
  if (phaseKey === 'round16') return byPhase.has('round32') ? 'round32' : 'group';
  if (phaseKey === 'quarter') {
    if (byPhase.has('round16')) return 'round16';
    if (byPhase.has('round32')) return 'round32';
    return 'group';
  }
  if (phaseKey === 'semi') return 'quarter';
  if (phaseKey === 'thirdPlace' || phaseKey === 'final') return 'semi';
  return null;
}

function isPhaseFinished(phaseFixtures = []) {
  const relevant = phaseFixtures.filter(isRelevantFixture);
  return relevant.length > 0 && relevant.every(isFinalFixture);
}

function phaseFirstStart(phaseFixtures = []) {
  const dated = phaseFixtures
    .filter(hasDefinedTeams)
    .map(getFixtureDate)
    .filter(Boolean)
    .sort((a, b) => a - b);
  return dated[0] || null;
}

function buildWindowForPhase(phaseKey, byPhase, now = new Date()) {
  const phaseFixtures = byPhase.get(phaseKey) || [];
  const label = PHASE_LABELS[phaseKey] || phaseKey;
  const firstStart = phaseFirstStart(phaseFixtures);

  if (!isKnockoutPhase(phaseKey)) {
    return {
      phaseKey,
      label,
      phaseRule: false,
      canPredict: true,
      opensAt: null,
      closesAt: null,
      reason: null,
    };
  }

  const previousPhaseKey = getPreviousPhaseKey(phaseKey, byPhase);
  const previousFixtures = previousPhaseKey ? byPhase.get(previousPhaseKey) || [] : [];
  const previousFinished = isPhaseFinished(previousFixtures);
  const previousLabel = PHASE_LABELS[previousPhaseKey] || 'la fase anterior';

  if (!firstStart) {
    return {
      phaseKey,
      label,
      phaseRule: true,
      canPredict: false,
      opensAt: null,
      closesAt: null,
      previousPhaseKey,
      previousFinished,
      reason: 'API-Football todavia no publico los cruces con equipos definidos.',
    };
  }

  if (!previousFinished) {
    return {
      phaseKey,
      label,
      phaseRule: true,
      canPredict: false,
      opensAt: null,
      closesAt: firstStart.toISOString(),
      previousPhaseKey,
      previousFinished,
      reason: `Se habilita cuando termine ${previousLabel}.`,
    };
  }

  if (now >= firstStart) {
    return {
      phaseKey,
      label,
      phaseRule: true,
      canPredict: false,
      opensAt: null,
      closesAt: firstStart.toISOString(),
      previousPhaseKey,
      previousFinished,
      reason: `${label} ya empezo.`,
    };
  }

  return {
    phaseKey,
    label,
    phaseRule: true,
    canPredict: true,
    opensAt: null,
    closesAt: firstStart.toISOString(),
    previousPhaseKey,
    previousFinished,
    reason: null,
  };
}

export function computePredictionWindows(fixtures, now = new Date()) {
  const byPhase = fixturesByPhase(fixtures);
  const phaseWindows = {};
  const fixtureWindows = {};

  for (const phaseKey of byPhase.keys()) {
    phaseWindows[phaseKey] = buildWindowForPhase(phaseKey, byPhase, now);
  }

  for (const fixture of fixtures || []) {
    const phaseKey = normalizePhase(fixture?.league?.round);
    if (!phaseKey) continue;

    const window = phaseWindows[phaseKey] || buildWindowForPhase(phaseKey, byPhase, now);
    const fixtureId = String(fixture?.fixture?.id || '');
    if (!fixtureId) continue;

    if (window.phaseRule && !hasDefinedTeams(fixture)) {
      fixtureWindows[fixtureId] = {
        ...window,
        canPredict: false,
        reason: 'Este cruce todavia no tiene equipos definidos.',
      };
    } else {
      fixtureWindows[fixtureId] = window;
    }
  }

  return {
    phaseWindows,
    fixtureWindows,
    generatedAt: now.toISOString(),
  };
}

export async function getCompetitionFixtures(competition, { fresh = false } = {}) {
  const fetchFixtures = async () => {
    const result = await footballApi.fetchFixtures(Number(competition.externalId), Number(competition.season));
    return result.response || [];
  };

  if (fresh) return fetchFixtures();

  return cachedApiCall(
    `api-football:fixtures:competition:${competition.externalId}:${competition.season}`,
    FIXTURE_CACHE_TTL_SECONDS,
    fetchFixtures,
  );
}

export async function getCompetitionPredictionWindows(competitionId, { fresh = false } = {}) {
  const competition = await prisma.competition.findUnique({
    where: { id: Number(competitionId) },
  });
  if (!competition) return null;

  const fixtures = await getCompetitionFixtures(competition, { fresh });
  return computePredictionWindows(fixtures);
}

export async function getFixturePredictionWindow(competition, fixture) {
  const phaseKey = normalizePhase(fixture?.league?.round);
  if (!isKnockoutPhase(phaseKey)) {
    return {
      phaseKey,
      label: PHASE_LABELS[phaseKey] || null,
      phaseRule: false,
      canPredict: true,
      reason: null,
    };
  }

  const fixtures = await getCompetitionFixtures(competition);
  const windows = computePredictionWindows(fixtures);
  const fixtureId = String(fixture?.fixture?.id || '');
  return windows.fixtureWindows[fixtureId] || buildWindowForPhase(phaseKey, fixturesByPhase(fixtures));
}

export async function isFinalMatchFinished(competitionId) {
  const competition = await prisma.competition.findUnique({
    where: { id: Number(competitionId) },
  });
  if (!competition) return false;

  const fixtures = await getCompetitionFixtures(competition, { fresh: true });
  return fixtures.some((fixture) => normalizePhase(fixture?.league?.round) === 'final' && isFinalFixture(fixture));
}

export function invalidateCompetitionFixtureWindows() {
  invalidateCacheByPrefix('api-football:fixtures:competition:');
}
