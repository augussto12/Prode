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

function normalizePhase(round) {
  if (!round) return null;
  const r = round.toLowerCase();
  if (r.includes("round of 32")) return "Round of 32";
  if (r.includes("round of 16") || r.includes("1/8")) return "Round of 16";
  if (r.includes("quarter") || r.includes("1/4")) return "Quarter-finals";
  if (r.includes("semi") || r.includes("1/2")) return "Semi-finals";
  if (r.includes("3rd place")) return "3rd Place Final";
  if (r === "final") return "Final";
  if (r.includes("play-off") || r.includes("play off") || r.includes("playoff"))
    return "Play-offs";
  return null;
}

// Group fixtures into matchups (ida/vuelta by team pairing)
function groupMatchups(fixtures) {
  const map = {};
  fixtures.forEach((f) => {
    const homeId = f.teams.home.id;
    const awayId = f.teams.away.id;
    const key = [Math.min(homeId, awayId), Math.max(homeId, awayId)].join("-");
    if (!map[key]) map[key] = [];
    map[key].push(f);
  });

  return Object.values(map).map((legs) => {
    legs.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    const leg1 = legs[0];
    const leg2 = legs[1] || null;
    const teamA = { ...leg1.teams.home, logo: leg1.teams.home.logo };
    const teamB = { ...leg1.teams.away, logo: leg1.teams.away.logo };

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
      const { data: fixtures } = await api.get(
        `/explorer/leagues/${leagueId}/fixtures?season=${season}`,
      );

      // Group fixtures by normalized phase
      const phaseMap = {};
      fixtures.forEach((f) => {
        const round = f.league?.round || "";
        const phase = normalizePhase(round);
        if (phase) {
          if (!phaseMap[phase]) phaseMap[phase] = [];
          phaseMap[phase].push(f);
        }
      });

      // Filter 3rd place out of main bracket chain (rendered separately)
      const mainPhases = PHASE_ORDER.filter((p) => p !== "3rd Place Final");
      const orderedPhases = mainPhases.filter((p) => phaseMap[p]);
      const thirdPlace = phaseMap["3rd Place Final"]
        ? {
            phase: "3rd Place Final",
            matchups: groupMatchups(phaseMap["3rd Place Final"]),
          }
        : null;

      // Build bracket columns
      const columns = orderedPhases.map((phase, colIndex) => ({
        phase,
        colIndex,
        matchups: groupMatchups(phaseMap[phase]),
      }));

      // ─── Connect rounds by team ID matching + reorder ───
      // Work backwards from the last round to the first so that
      // reordering propagates correctly through the whole bracket.
      for (let i = columns.length - 2; i >= 0; i--) {
        const currentCol = columns[i];
        const nextCol = columns[i + 1];

        // For each matchup in current round, find which next-round matchup
        // contains either of its teams (i.e. the advancing team)
        currentCol.matchups.forEach((matchup) => {
          const tAid = matchup.teamA.id;
          const tBid = matchup.teamB.id;

          const nextIdx = nextCol.matchups.findIndex(
            (nm) =>
              nm.teamA.id === tAid ||
              nm.teamA.id === tBid ||
              nm.teamB.id === tAid ||
              nm.teamB.id === tBid,
          );

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
        currentCol.matchups.forEach((matchup) => {
          const tAid = matchup.teamA.id;
          const tBid = matchup.teamB.id;
          const nextIdx = nextCol.matchups.findIndex(
            (nm) =>
              nm.teamA.id === tAid ||
              nm.teamA.id === tBid ||
              nm.teamB.id === tAid ||
              nm.teamB.id === tBid,
          );
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
        sfCol.matchups.forEach((m, mi) => {
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
