import { useState, useEffect } from "react";
import api from "../../services/api";

export default function AggregateScore({
  homeId,
  awayId,
  leagueId,
  round,
  homeGoalsToday,
  awayGoalsToday,
}) {
  const [aggregate, setAggregate] = useState(null);

  useEffect(() => {
    if (!homeId || !awayId || !leagueId) return;

    // Si tenemos indicios de que es un partido que podría tener vuelta
    const isKnockout = /quarter|semi|final|round of|8th|16th|leg/i.test(
      round || "",
    );
    if (!isKnockout) return;

    fetchFirstLeg();
  }, [homeId, awayId, leagueId, round]);

  const fetchFirstLeg = async () => {
    try {
      const { data: h2hData } = await api.get(
        `/explorer/h2h/${homeId}/${awayId}?last=5`,
      );
      const matches = h2hData || [];

      // In the first leg, teams are inverted
      const firstLegMatch = matches.find((m) => {
        const r = m.league?.round || "";
        const sameLeague = m.league?.id === leagueId;
        const isFinished = ["FT", "AET", "PEN"].includes(
          m.fixture?.status?.short,
        );

        // El partido de ida tiene la misma ronda (Ej: 'Quarter-finals') o especifica '1st Leg'
        const isSameRoundDesc =
          r === round || r.includes(round) || /1st\s*Leg/i.test(r);

        // Chequear que los equipos estén invertidos (local de hoy era visitante de ayer)
        const isInverted =
          m.teams?.home?.id === awayId && m.teams?.away?.id === homeId;

        return isSameRoundDesc && sameLeague && isFinished && isInverted;
      });

      if (firstLegMatch) {
        // En primera ida: local de hoy era visitante. Visitante de hoy era local.
        const awayGoalsEnIda = firstLegMatch.goals?.away ?? 0; // Goles de homeId
        const homeGoalsEnIda = firstLegMatch.goals?.home ?? 0; // Goles de awayId

        const totalHome = (homeGoalsToday || 0) + awayGoalsEnIda;
        const totalAway = (awayGoalsToday || 0) + homeGoalsEnIda;

        setAggregate({ totalHome, totalAway });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!aggregate) return null;

  return (
    <div
      className="text-center mt-1"
      title={`Global: ${aggregate.totalHome} - ${aggregate.totalAway}`}
    >
      <span className="text-[10px] text-white/35 font-medium">
        Global: {aggregate.totalHome} - {aggregate.totalAway}
      </span>
    </div>
  );
}
