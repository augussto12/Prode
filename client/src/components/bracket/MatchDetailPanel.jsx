import { m, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

/**
 * Side drawer panel showing match details with leg toggle for stats.
 * Auto-selects the last played leg and allows toggling between ida/vuelta.
 */
export default function MatchDetailPanel({ matchup, onClose }) {
  const navigate = useNavigate();
  const [statsMap, setStatsMap] = useState({}); // fixtureId → stats data
  const [loadingId, setLoadingId] = useState(null);
  const [activeLegIdx, setActiveLegIdx] = useState(-1);

  const {
    teamA,
    teamB,
    aggA,
    aggB,
    legs,
    winnerId,
    isFinished,
    isLive,
    isAggregate,
  } = matchup || {};

  // Find the last played leg index
  const lastPlayedIdx = useMemo(() => {
    if (!legs?.length) return 0;
    for (let i = legs.length - 1; i >= 0; i--) {
      const s = legs[i].fixture.status?.short;
      if (["FT", "AET", "PEN"].includes(s)) return i;
    }
    return legs.length - 1;
  }, [legs]);

  // Auto-select last played leg when matchup changes
  useEffect(() => {
    if (!matchup) return;
    setActiveLegIdx(lastPlayedIdx);
  }, [matchup, lastPlayedIdx]);

  // Fetch stats for the active leg
  useEffect(() => {
    if (!matchup || !legs?.length || activeLegIdx < 0) return;
    const leg = legs[activeLegIdx];
    if (!leg) return;
    const fid = leg.fixture.id;

    // Already cached?
    if (statsMap[fid]) return;

    setLoadingId(fid);
    api
      .get(`/explorer/fixtures/${fid}`)
      .then(({ data }) => setStatsMap((prev) => ({ ...prev, [fid]: data })))
      .catch(() => setStatsMap((prev) => ({ ...prev, [fid]: null })))
      .finally(() => setLoadingId(null));
  }, [matchup, legs, activeLegIdx, statsMap]);

  // Current leg stats
  const activeLeg = legs?.[activeLegIdx];
  const activeFixtureId = activeLeg?.fixture?.id;
  const currentStats = activeFixtureId ? statsMap[activeFixtureId] : null;
  const isLoading = loadingId === activeFixtureId;

  const homeStats = currentStats?.statistics?.[0]?.statistics || [];
  const awayStats = currentStats?.statistics?.[1]?.statistics || [];

  const statRows = [
    { label: "Posesión", key: "Ball Possession" },
    { label: "Tiros al arco", key: "Shots on Goal" },
    { label: "Tiros totales", key: "Total Shots" },
    { label: "Córners", key: "Corner Kicks" },
    { label: "Faltas", key: "Fouls" },
    { label: "Amarillas", key: "Yellow Cards" },
    { label: "Rojas", key: "Red Cards" },
    { label: "Pases", key: "Total passes" },
    { label: "% Pases", key: "Passes %" },
  ];

  function getStatValue(statsArr, key) {
    const found = statsArr.find((s) => s.type === key);
    return found?.value ?? "-";
  }

  // Reset stats cache when matchup changes
  useEffect(() => {
    if (!matchup) {
      setStatsMap({});
      setActiveLegIdx(-1);
    }
  }, [matchup]);

  return (
    <AnimatePresence>
      {matchup && (
        <>
          {/* Backdrop */}
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />

          {/* Panel */}
          <m.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 z-50 overflow-y-auto"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white/60 hover:text-white transition-all cursor-pointer border-none z-10"
            >
              <X size={18} />
            </button>

            <div className="p-5 pt-8 space-y-5">
              {/* Status */}
              <div className="text-center">
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
                    isLive
                      ? "bg-red-500/20 text-red-400"
                      : isFinished
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-700/50 text-slate-400"
                  }`}
                >
                  {isLive ? "● EN VIVO" : isFinished ? "FINALIZADO" : "PRÓXIMO"}
                </span>
              </div>

              {/* Global scoreboard */}
              <div className="flex items-center justify-center gap-3">
                <div
                  className="flex flex-col items-center gap-1.5 cursor-pointer group flex-1"
                  onClick={() => navigate(`/equipo/${teamA.id}`)}
                >
                  <img                     src={teamA.logo}
                    alt=""
                    className="w-14 h-14 object-contain group-hover:scale-110 transition-transform"
                    loading="lazy"
                    decoding="async"
                    width={56} height={56}
  onError={(e) => {
                      e.target.src = "/placeholder-team.svg";
                    }}
                  />
                  <span
                    className={`text-xs font-bold text-center ${winnerId === teamA.id ? "text-emerald-300" : "text-white"}`}
                  >
                    {teamA.name}
                  </span>
                </div>

                <div className="text-center px-3">
                  <div className="text-3xl font-black text-white tracking-wider font-mono">
                    {aggA ?? "-"} <span className="text-slate-600">:</span>{" "}
                    {aggB ?? "-"}
                  </div>
                  {isAggregate && (
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                      Global
                    </span>
                  )}
                </div>

                <div
                  className="flex flex-col items-center gap-1.5 cursor-pointer group flex-1"
                  onClick={() => navigate(`/equipo/${teamB.id}`)}
                >
                  <img                     src={teamB.logo}
                    alt=""
                    className="w-14 h-14 object-contain group-hover:scale-110 transition-transform"
                    loading="lazy"
                    decoding="async"
                    width={56} height={56}
  onError={(e) => {
                      e.target.src = "/placeholder-team.svg";
                    }}
                  />
                  <span
                    className={`text-xs font-bold text-center ${winnerId === teamB.id ? "text-emerald-300" : "text-white"}`}
                  >
                    {teamB.name}
                  </span>
                </div>
              </div>

              {/* Leg selector toggle (ida / vuelta) */}
              {legs?.length > 1 && (
                <div className="flex justify-center gap-2">
                  {legs.map((leg, li) => {
                    const isActive = activeLegIdx === li;
                    const legStatus = leg.fixture.status?.short;
                    const isPlayed = ["FT", "AET", "PEN"].includes(legStatus);

                    return (
                      <button
                        key={leg.fixture.id}
                        onClick={() => setActiveLegIdx(li)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          isActive
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10"
                            : "bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600"
                        }`}
                      >
                        <span className="text-slate-500 mr-1">
                          {li === 0 ? "Ida" : "Vuelta"}
                        </span>
                        {isPlayed
                          ? `${leg.goals?.home ?? "?"} - ${leg.goals?.away ?? "?"}`
                          : "— : —"}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Single leg: show its score if different from global */}
              {legs?.length === 1 && (
                <div className="flex justify-center">
                  <span className="px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-[10px] text-slate-500 font-medium">
                    Partido único
                  </span>
                </div>
              )}

              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

              {/* Statistics for active leg */}
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : homeStats.length > 0 ? (
                <div className="space-y-0.5">
                  <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2 text-center">
                    Estadísticas —{" "}
                    {activeLegIdx === 0
                      ? "Ida"
                      : legs?.length > 1
                        ? "Vuelta"
                        : "Partido"}
                  </h3>
                  {statRows.map(({ label, key }) => {
                    const homeVal = getStatValue(homeStats, key);
                    const awayVal = getStatValue(awayStats, key);
                    if (homeVal === "-" && awayVal === "-") return null;

                    const homeNum =
                      parseFloat(String(homeVal).replace("%", "")) || 0;
                    const awayNum =
                      parseFloat(String(awayVal).replace("%", "")) || 0;
                    const total = homeNum + awayNum || 1;
                    const homePct = (homeNum / total) * 100;
                    const awayPct = (awayNum / total) * 100;

                    return (
                      <div key={key} className="py-1.5">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span
                            className={`font-mono text-[11px] font-bold ${homeNum > awayNum ? "text-emerald-400" : homeNum < awayNum ? "text-white/60" : "text-white/80"}`}
                          >
                            {homeVal}
                          </span>
                          <span className="text-slate-500 text-[9px] uppercase tracking-wider">
                            {label}
                          </span>
                          <span
                            className={`font-mono text-[11px] font-bold ${awayNum > homeNum ? "text-emerald-400" : awayNum < homeNum ? "text-white/60" : "text-white/80"}`}
                          >
                            {awayVal}
                          </span>
                        </div>
                        <div className="flex gap-1 h-1.5">
                          <div className="rounded-full flex-1 flex justify-end overflow-hidden bg-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${homePct}%`,
                                background:
                                  homeNum > awayNum
                                    ? "rgb(52, 211, 153)"
                                    : homeNum === awayNum
                                      ? "rgba(255,255,255,0.25)"
                                      : "rgba(255,255,255,0.1)",
                              }}
                            />
                          </div>
                          <div className="rounded-full flex-1 overflow-hidden bg-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${awayPct}%`,
                                background:
                                  awayNum > homeNum
                                    ? "rgb(52, 211, 153)"
                                    : awayNum === homeNum
                                      ? "rgba(255,255,255,0.25)"
                                      : "rgba(255,255,255,0.1)",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-slate-600 text-xs py-3">
                  Estadísticas no disponibles
                </p>
              )}

              {/* Navigate to full match */}
              {activeLeg && (
                <button
                  onClick={() => navigate(`/partido/${activeLeg.fixture.id}`)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white border-none cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                  }}
                >
                  Ver partido completo →
                </button>
              )}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
