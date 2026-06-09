import { Router } from 'express';
import prisma from '../config/database.js';
import * as footballApi from '../services/football-api.service.js';
import { cachedApiCall } from '../services/cache.service.js';
import { computePredictionWindows } from '../services/phase-window.service.js';

const router = Router();

const FRIENDLIES_LEAGUE_ID = 10;
const FRIENDLIES_NAME = 'Amistosos Internacionales';
const FRIENDLIES_WINDOW_DAYS_BACK = 14;
const FRIENDLIES_WINDOW_DAYS_FORWARD = 120;

const STATUS_MAP = {
  NS: 'SCHEDULED',
  TBD: 'SCHEDULED',
  '1H': 'LIVE',
  '2H': 'LIVE',
  HT: 'LIVE',
  ET: 'LIVE',
  P: 'LIVE',
  BT: 'LIVE',
  LIVE: 'LIVE',
  FT: 'FINISHED',
  AET: 'FINISHED',
  PEN: 'FINISHED',
  PST: 'POSTPONED',
  SUSP: 'POSTPONED',
  INT: 'POSTPONED',
  CANC: 'CANCELLED',
  ABD: 'CANCELLED',
  AWD: 'CANCELLED',
  WO: 'CANCELLED',
};

function currentSeason() {
  return new Date().getFullYear();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isInFriendliesWindow(fixture) {
  const rawDate = fixture?.fixture?.date;
  if (!rawDate) return false;

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date >= addDays(now, -FRIENDLIES_WINDOW_DAYS_BACK) &&
    date <= addDays(now, FRIENDLIES_WINDOW_DAYS_FORWARD)
  );
}

async function getFixturesForCompetition(competition) {
  return cachedApiCall(
    `api-football:matches:competition:${competition.externalId}:${competition.season}`,
    60,
    async () => {
      const result = await footballApi.fetchFixtures(
        Number(competition.externalId),
        Number(competition.season),
      );
      return result.response || [];
    },
  );
}

async function ensureFriendliesCompetition() {
  const season = currentSeason();
  return prisma.competition.upsert({
    where: {
      externalId_season: {
        externalId: FRIENDLIES_LEAGUE_ID,
        season,
      },
    },
    update: { name: FRIENDLIES_NAME },
    create: {
      externalId: FRIENDLIES_LEAGUE_ID,
      name: FRIENDLIES_NAME,
      season,
      logo: null,
    },
  });
}

function mapFixture(fixture, competition, predictionWindows = {}) {
  const fix = fixture.fixture || {};
  const league = fixture.league || {};
  const teams = fixture.teams || {};
  const goals = fixture.goals || {};
  const home = teams.home || {};
  const away = teams.away || {};
  const statusShort = fix.status?.short;

  return {
    id: fix.id,
    externalId: fix.id,
    competitionId: competition.id,
    competitionExternalId: competition.externalId,
    competitionName: competition.name,
    homeTeam: home.name,
    awayTeam: away.name,
    homeTeamLogo: home.logo,
    awayTeamLogo: away.logo,
    homeTeamId: home.id,
    awayTeamId: away.id,
    matchDate: fix.date,
    status: STATUS_MAP[statusShort] || 'SCHEDULED',
    statusShort,
    elapsed: fix.status?.elapsed,
    homeGoals: goals.home,
    awayGoals: goals.away,
    stage: league.round || league.name || competition.name,
    round: league.round || '',
    leagueName: league.name || competition.name,
    leagueLogo: league.logo || competition.logo,
    venue: fix.venue?.name
      ? [fix.venue.name, fix.venue.city].filter(Boolean).join(', ')
      : null,
    predictionWindow: predictionWindows[String(fix.id)] || null,
  };
}

async function getRequestedCompetitions(req) {
  const competitionId = Number(req.query.competitionId);
  if (!competitionId) return [];

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
  });
  if (!competition) return [];

  const competitions = [competition];
  const includeFriendlies =
    req.query.includeFriendlies !== 'false' &&
    Number(competition.externalId) === 1;

  if (includeFriendlies) {
    const friendlies = await ensureFriendliesCompetition();
    if (friendlies.id !== competition.id) competitions.push(friendlies);
  }

  return competitions;
}

router.get('/', async (req, res, next) => {
  try {
    const competitions = await getRequestedCompetitions(req);
    if (competitions.length === 0) return res.json([]);

    const chunks = await Promise.all(
      competitions.map(async (competition) => {
        let fixtures = await getFixturesForCompetition(competition);
        if (Number(competition.externalId) === FRIENDLIES_LEAGUE_ID) {
          fixtures = fixtures.filter(isInFriendliesWindow);
        }

        const windows = computePredictionWindows(fixtures).fixtureWindows;
        return fixtures.map((fixture) => mapFixture(fixture, competition, windows));
      }),
    );

    res.json(
      chunks
        .flat()
        .filter((match) => match.id && match.homeTeam && match.awayTeam)
        .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate)),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/teams', async (req, res, next) => {
  try {
    const competitions = await getRequestedCompetitions(req);
    const fixturesByCompetition = await Promise.all(
      competitions.map(async (competition) => {
        let fixtures = await getFixturesForCompetition(competition);
        if (Number(competition.externalId) === FRIENDLIES_LEAGUE_ID) {
          fixtures = fixtures.filter(isInFriendliesWindow);
        }
        return fixtures;
      }),
    );

    const teams = new Map();
    for (const fixture of fixturesByCompetition.flat()) {
      for (const team of [fixture.teams?.home, fixture.teams?.away]) {
        if (!team?.id) continue;
        teams.set(team.id, {
          id: team.id,
          name: team.name,
          logo: team.logo,
          flag: '',
        });
      }
    }

    res.json(
      Array.from(teams.values()).sort((a, b) =>
        String(a.name).localeCompare(String(b.name), 'es'),
      ),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
