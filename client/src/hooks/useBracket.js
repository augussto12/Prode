import { useState, useEffect, useCallback } from "react";
import api from "../services/api.js";

// Knockout round normalization — same logic as TournamentBracket.jsx
const PHASE_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "3rd Place Final",
  "Final",
];
const MAIN_PHASES = PHASE_ORDER.filter((p) => p !== "3rd Place Final");
const WORLD_CUP_2026_PHASE_MATCHUPS = {
  "Round of 32": 16,
  "Round of 16": 8,
  "Quarter-finals": 4,
  "Semi-finals": 2,
  Final: 1,
};
const WORLD_CUP_2026_DATE_ORDER_MATCH_NUMBERS = {
  "Round of 32": [73, 76, 74, 75, 78, 77, 79, 80, 82, 81, 84, 83, 85, 88, 86, 87],
  "Round of 16": [90, 89, 91, 92, 93, 94, 95, 96],
  "Quarter-finals": [97, 98, 99, 100],
  "Semi-finals": [101, 102],
  "3rd Place Final": [103],
  Final: [104],
};
const WORLD_CUP_2026_BRACKET_ORDER = {
  "Round of 32": [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  "Round of 16": [89, 90, 93, 94, 91, 92, 95, 96],
  "Quarter-finals": [97, 98, 99, 100],
  "Semi-finals": [101, 102],
  Final: [104],
};
const WORLD_CUP_2026_MATCH_FEEDS = {
  73: 90,
  75: 90,
  74: 89,
  77: 89,
  83: 93,
  84: 93,
  81: 94,
  82: 94,
  76: 91,
  78: 91,
  79: 92,
  80: 92,
  86: 95,
  88: 95,
  85: 96,
  87: 96,
  89: 97,
  90: 97,
  93: 98,
  94: 98,
  91: 99,
  92: 99,
  95: 100,
  96: 100,
  97: 101,
  98: 101,
  99: 102,
  100: 102,
  101: 104,
  102: 104,
};
const WORLD_CUP_2026_MATCH_SIDES = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [86, 88],
  96: [85, 87],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 98],
  102: [99, 100],
  103: [101, 102],
  104: [101, 102],
};

function normalizePhase(round) {
  if (!round) return null;
  const r = round.toLowerCase();
  if (
    r.includes("round of 32") ||
    r.includes("1/16") ||
    r.includes("16-finals") ||
    r.includes("16avos")
  )
    return "Round of 32";
  if (r.includes("round of 16") || r.includes("1/8")) return "Round of 16";
  if (r.includes("quarter") || r.includes("1/4")) return "Quarter-finals";
  if (r.includes("semi") || r.includes("1/2")) return "Semi-finals";
  if (r.includes("3rd place")) return "3rd Place Final";
  if (r === "final") return "Final";
  if (r.includes("play-off") || r.includes("play off") || r.includes("playoff"))
    return "Play-offs";
  return null;
}

function buildPhaseMap(fixtures) {
  const phaseMap = {};
  fixtures.forEach((f) => {
    const round = f.league?.round || "";
    const phase = normalizePhase(round);
    if (phase) {
      if (!phaseMap[phase]) phaseMap[phase] = [];
      phaseMap[phase].push(f);
    }
  });
  return phaseMap;
}

function mergeFixturesById(...fixtureLists) {
  const merged = new Map();
  fixtureLists.flat().forEach((fixture) => {
    const id = fixture?.fixture?.id;
    if (id == null) return;
    merged.set(id, fixture);
  });
  return [...merged.values()].sort(
    (a, b) => new Date(a.fixture.date) - new Date(b.fixture.date),
  );
}

function placeholderTeam(phase, matchupIndex, side) {
  const phaseIndex = MAIN_PHASES.indexOf(phase) + 1;
  const numericId = phaseIndex * 1000 + matchupIndex * 2 + side;
  return {
    id: -numericId,
    name: "Por definir",
    logo: "",
  };
}

function worldCupPlaceholderTeam(matchNumber, sideIndex) {
  const feederNumber = WORLD_CUP_2026_MATCH_SIDES[matchNumber]?.[sideIndex];
  return {
    id: -Number(`${matchNumber}${sideIndex + 1}`),
    name: feederNumber ? `Ganador M${feederNumber}` : "Por definir",
    logo: "",
  };
}

function makePlaceholderMatchup(phase, matchupIndex, matchNumber = null) {
  return {
    id: matchNumber
      ? `placeholder-${phase}-${matchNumber}`
      : `placeholder-${phase}-${matchupIndex}`,
    matchNumber,
    teamA: matchNumber
      ? worldCupPlaceholderTeam(matchNumber, 0)
      : placeholderTeam(phase, matchupIndex, 1),
    teamB: matchNumber
      ? worldCupPlaceholderTeam(matchNumber, 1)
      : placeholderTeam(phase, matchupIndex, 2),
    aggA: null,
    aggB: null,
    legs: [],
    winnerId: null,
    isFinished: false,
    isLive: false,
    isAggregate: false,
    startTime: null,
    _nextMatchIndex: -1,
    nextMatchId: null,
    nextMatchNumber: matchNumber ? WORLD_CUP_2026_MATCH_FEEDS[matchNumber] || null : null,
  };
}

function getMatchupWinner(matchup) {
  if (!matchup?.winnerId) return null;
  if (matchup.winnerId === matchup.teamA?.id) return matchup.teamA;
  if (matchup.winnerId === matchup.teamB?.id) return matchup.teamB;
  return null;
}

function isUnresolvedTeam(team) {
  const teamId = Number(team?.id);
  const teamName = String(team?.name || "").trim();

  if (!Number.isFinite(teamId) || teamId <= 0 || !teamName) return true;

  return /^(por definir|tbd|to be decided|winner|ganador)\b/i.test(teamName);
}

function shouldUseFeederWinner(currentTeam, winnerTeam) {
  if (!winnerTeam) return false;
  return isUnresolvedTeam(currentTeam) || currentTeam?.id === winnerTeam.id;
}

function assignWorldCup2026MatchNumbers(columns) {
  return columns.map((column) => {
    const dateOrderNumbers = WORLD_CUP_2026_DATE_ORDER_MATCH_NUMBERS[column.phase] || [];
    const matchups = [...column.matchups]
      .sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0))
      .map((matchup, index) => {
        const matchNumber = matchup.matchNumber || dateOrderNumbers[index] || null;
        return {
          ...matchup,
          matchNumber,
          nextMatchNumber: matchNumber
            ? WORLD_CUP_2026_MATCH_FEEDS[matchNumber] || null
            : matchup.nextMatchNumber || null,
        };
      });

    return { ...column, matchups };
  });
}

function completeWorldCup2026Bracket(columns) {
  const byPhase = new Map(columns.map((column) => [column.phase, column]));
  const firstPhaseIndex = MAIN_PHASES.findIndex((phase) => byPhase.has(phase));
  if (firstPhaseIndex === -1) return columns;

  return MAIN_PHASES.slice(firstPhaseIndex).map((phase, colIndex) => {
    const existingMatchups = byPhase.get(phase)?.matchups || [];
    const expectedCount =
      WORLD_CUP_2026_PHASE_MATCHUPS[phase] || existingMatchups.length;
    const bracketOrder = WORLD_CUP_2026_BRACKET_ORDER[phase] || [];
    const byMatchNumber = new Map(
      existingMatchups
        .filter((matchup) => matchup.matchNumber)
        .map((matchup) => [matchup.matchNumber, matchup]),
    );
    const matchups = bracketOrder.length
      ? bracketOrder.map((matchNumber, matchupIndex) =>
          byMatchNumber.get(matchNumber) ||
          makePlaceholderMatchup(phase, matchupIndex, matchNumber),
        )
      : [...existingMatchups];

    while (matchups.length < expectedCount) {
      matchups.push(makePlaceholderMatchup(phase, matchups.length));
    }

    return { phase, colIndex, matchups };
  });
}

function propagateWorldCup2026Winners(columns) {
  const byMatchNumber = new Map();

  columns.forEach((column) => {
    column.matchups.forEach((matchup) => {
      if (matchup.matchNumber) byMatchNumber.set(matchup.matchNumber, matchup);
    });
  });

  return columns.map((column) => ({
    ...column,
    matchups: column.matchups.map((matchup) => {
      const feeders = WORLD_CUP_2026_MATCH_SIDES[matchup.matchNumber];
      if (!feeders) return matchup;

      const feederA = getMatchupWinner(byMatchNumber.get(feeders[0]));
      const feederB = getMatchupWinner(byMatchNumber.get(feeders[1]));
      const nextMatchup = { ...matchup };

      if (shouldUseFeederWinner(matchup.teamA, feederA)) {
        nextMatchup.teamA = { ...feederA };
      }

      if (shouldUseFeederWinner(matchup.teamB, feederB)) {
        nextMatchup.teamB = { ...feederB };
      }

      return nextMatchup;
    }),
  }));
}

function findNextMatchIndex(matchup, matchupIndex, nextCol) {
  if (matchup.nextMatchNumber) {
    const matchNumberIndex = nextCol.matchups.findIndex(
      (nm) => nm.matchNumber === matchup.nextMatchNumber,
    );
    if (matchNumberIndex !== -1) return matchNumberIndex;
  }

  const tAid = matchup.teamA.id;
  const tBid = matchup.teamB.id;

  const teamMatchIndex = nextCol.matchups.findIndex(
    (nm) =>
      nm.teamA.id === tAid ||
      nm.teamA.id === tBid ||
      nm.teamB.id === tAid ||
      nm.teamB.id === tBid,
  );

  if (teamMatchIndex !== -1) return teamMatchIndex;
  if (!nextCol.matchups.length) return -1;
  return Math.min(Math.floor(matchupIndex / 2), nextCol.matchups.length - 1);
}

// Group fixtures into matchups (ida/vuelta by team pairing)
function groupMatchups(fixtures) {
  const map = {};
  fixtures.forEach((f) => {
    const homeId = f.teams.home.id;
    const awayId = f.teams.away.id;
    const hasTeamPair = Number(homeId) > 0 && Number(awayId) > 0;
    const key = hasTeamPair
      ? [Math.min(homeId, awayId), Math.max(homeId, awayId)].join("-")
      : `fixture-${f.fixture.id}`;
    if (!map[key]) map[key] = [];
    map[key].push(f);
  });

  return Object.values(map).map((legs) => {
    legs.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    const leg1 = legs[0];
    const leg2 = legs[1] || null;
    const teamA = {
      ...leg1.teams.home,
      id: leg1.teams.home.id ?? -Number(`${leg1.fixture.id}1`),
      name: leg1.teams.home.name || "Por definir",
      logo: leg1.teams.home.logo,
    };
    const teamB = {
      ...leg1.teams.away,
      id: leg1.teams.away.id ?? -Number(`${leg1.fixture.id}2`),
      name: leg1.teams.away.name || "Por definir",
      logo: leg1.teams.away.logo,
    };

    let aggA = leg1.goals?.home ?? null;
    let aggB = leg1.goals?.away ?? null;

    if (leg2) {
      if (leg2.teams.home.id === teamA.id) {
        aggA = (aggA ?? 0) + (leg2.goals?.home ?? 0);
        aggB = (aggB ?? 0) + (leg2.goals?.away ?? 0);
      } else {
        aggA = (aggA ?? 0) + (leg2.goals?.away ?? 0);
        aggB = (aggB ?? 0) + (leg2.goals?.home ?? 0);
      }
    }

    let winnerId = null;
    const isFinished = legs.every((l) =>
      ["FT", "AET", "PEN"].includes(l.fixture.status?.short),
    );
    const isLive = legs.some((l) =>
      ["1H", "2H", "HT", "ET", "BT", "P"].includes(l.fixture.status?.short),
    );

    if (isFinished) {
      if (aggA > aggB) winnerId = teamA.id;
      else if (aggB > aggA) winnerId = teamB.id;
      else {
        const lastLeg = leg2 || leg1;
        if (lastLeg.score?.penalty?.home != null) {
          const penHome = lastLeg.score.penalty.home;
          const penAway = lastLeg.score.penalty.away;
          if (lastLeg.teams.home.id === teamA.id) {
            winnerId = penHome > penAway ? teamA.id : teamB.id;
          } else {
            winnerId = penAway > penHome ? teamA.id : teamB.id;
          }
        }
      }
    }

    return {
      id: `${leg1.fixture.id}`,
      teamA,
      teamB,
      aggA,
      aggB,
      legs,
      winnerId,
      isFinished,
      isLive,
      isAggregate: legs.length > 1,
      startTime: leg1.fixture.date,
    };
  });
}

/**
 * Hook to fetch and organize bracket data from API-Football fixtures.
 * @param {number|string} leagueId - League ID (from API-Football)
 * @param {number} season - Season year
 * @returns {{ bracket, loading, error, refetch }}
 */
export function useBracket(leagueId, season) {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBracket = useCallback(async () => {
    if (!leagueId || !season) return;
    setLoading(true);
    setError(null);

    try {
      const { data: seasonFixtures = [] } = await api.get(
        `/explorer/leagues/${leagueId}/fixtures?season=${season}`,
      );

      let fixtures = Array.isArray(seasonFixtures) ? seasonFixtures : [];

      try {
        const { data: roundsData } = await api.get(
          `/explorer/leagues/${leagueId}/rounds?season=${season}`,
        );
        const knockoutRounds = [
          ...new Set(
            (roundsData?.rounds || []).filter((round) =>
              PHASE_ORDER.includes(normalizePhase(round)),
            ),
          ),
        ];

        const roundFixtures = await Promise.all(
          knockoutRounds.map((round) =>
            api
              .get(`/explorer/leagues/${leagueId}/fixtures`, {
                params: { season, round },
              })
              .then((response) => response.data || [])
              .catch((roundErr) => {
                console.warn(`Error fetching bracket round ${round}:`, roundErr);
                return [];
              }),
          ),
        );

        fixtures = mergeFixturesById(fixtures, ...roundFixtures);
      } catch (roundsErr) {
        console.warn("Error fetching bracket rounds:", roundsErr);
      }

      // Group fixtures by normalized phase
      const phaseMap = buildPhaseMap(fixtures);

      // Filter 3rd place out of main bracket chain (rendered separately)
      const orderedPhases = MAIN_PHASES.filter((p) => phaseMap[p]);
      const thirdPlace = phaseMap["3rd Place Final"]
        ? {
            phase: "3rd Place Final",
            matchups: groupMatchups(phaseMap["3rd Place Final"]),
          }
        : null;

      // Build bracket columns
      let columns = orderedPhases.map((phase, colIndex) => ({
        phase,
        colIndex,
        matchups: groupMatchups(phaseMap[phase]),
      }));

      if (Number(leagueId) === 1 && Number(season) === 2026) {
        columns = assignWorldCup2026MatchNumbers(columns);
        columns = completeWorldCup2026Bracket(columns);
        columns = propagateWorldCup2026Winners(columns);
      }

      // ─── Connect rounds by team ID matching + reorder ───
      // Work backwards from the last round to the first so that
      // reordering propagates correctly through the whole bracket.
      for (let i = columns.length - 2; i >= 0; i--) {
        const currentCol = columns[i];
        const nextCol = columns[i + 1];

        // For each matchup in current round, find which next-round matchup
        // contains either of its teams (i.e. the advancing team)
        currentCol.matchups.forEach((matchup, matchupIndex) => {
          const nextIdx = findNextMatchIndex(matchup, matchupIndex, nextCol);

          if (nextIdx !== -1) {
            matchup.nextMatchId = nextCol.matchups[nextIdx].id;
            matchup._nextMatchIndex = nextIdx;
          } else {
            matchup.nextMatchId = null;
            matchup._nextMatchIndex = -1;
          }
        });

        // Reorder current round matchups so that pairs feeding the same
        // next-round match are adjacent, in order of the next round's sequence.
        const reordered = [];
        const used = new Set();

        for (let ni = 0; ni < nextCol.matchups.length; ni++) {
          // Find all current-round matchups feeding into next match ni
          const feeders = currentCol.matchups
            .map((m, idx) => ({ m, idx }))
            .filter(({ m }) => m._nextMatchIndex === ni);

          feeders.forEach(({ m, idx }) => {
            if (!used.has(idx)) {
              reordered.push(m);
              used.add(idx);
            }
          });
        }

        // Append any matchups not connected (shouldn't happen in clean data)
        currentCol.matchups.forEach((m, idx) => {
          if (!used.has(idx)) reordered.push(m);
        });

        currentCol.matchups = reordered;

        // Recalculate _nextMatchIndex after reorder
        currentCol.matchups.forEach((matchup, matchupIndex) => {
          const nextIdx = findNextMatchIndex(matchup, matchupIndex, nextCol);
          matchup._nextMatchIndex = nextIdx;
        });
      }

      // ─── Ensure a Final column exists for the mirrored bracket ───
      // If Semi-finals exist but Final doesn't, add a placeholder
      const hasSF = columns.some((c) => c.phase === "Semi-finals");
      const hasFinal = columns.some((c) => c.phase === "Final");
      if (hasSF && !hasFinal) {
        const sfCol = columns.find((c) => c.phase === "Semi-finals");
        // Try to determine finalists from SF winners
        const finalist1 = sfCol.matchups[0]?.winnerId
          ? sfCol.matchups[0].winnerId === sfCol.matchups[0].teamA.id
            ? sfCol.matchups[0].teamA
            : sfCol.matchups[0].teamB
          : { id: -1, name: "—", logo: "" };
        const finalist2 = sfCol.matchups[1]?.winnerId
          ? sfCol.matchups[1].winnerId === sfCol.matchups[1].teamA.id
            ? sfCol.matchups[1].teamA
            : sfCol.matchups[1].teamB
          : { id: -2, name: "—", logo: "" };

        const finalPlaceholder = {
          id: "final-placeholder",
          teamA: finalist1,
          teamB: finalist2,
          aggA: null,
          aggB: null,
          legs: [],
          winnerId: null,
          isFinished: false,
          isLive: false,
          isAggregate: false,
          startTime: null,
          _nextMatchIndex: -1,
          nextMatchId: null,
        };

        columns.push({
          phase: "Final",
          colIndex: columns.length,
          matchups: [finalPlaceholder],
        });

        // Connect SF matchups to the Final placeholder
        sfCol.matchups.forEach((m) => {
          m._nextMatchIndex = 0;
          m.nextMatchId = "final-placeholder";
        });
      }

      setBracket({
        columns,
        thirdPlace,
        totalFixtures: fixtures.length,
        hasKnockout: columns.length > 0,
      });
    } catch (err) {
      console.error("Error fetching bracket:", err);
      setError(err.message || "Error al cargar las llaves");
    } finally {
      setLoading(false);
    }
  }, [leagueId, season]);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  return { bracket, loading, error, refetch: fetchBracket };
}

export { normalizePhase, PHASE_ORDER };
