import { useState } from "react";
import { m } from "framer-motion";
import {
  BarChart3,
  Crosshair,
  Flag,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import GroupPredictionsModal from "./GroupPredictionsModal";

export default function PredictionHistory({
  predictions,
  matches,
  groupId,
  groupSettings = null,
}) {
  const [predFilter, setPredFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest"); // 'newest' | 'oldest'
  const [selectedMatchModal, setSelectedMatchModal] = useState(null);
  const [expandedMatches, setExpandedMatches] = useState({});

  const toggleMatch = (id) => {
    setExpandedMatches((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const predsWithMatch = predictions
    .map((p) => {
      const match = matches.find((m) => m.id === p.externalFixtureId);
      return { ...p, match };
    })
    .filter((p) => p.match);

  // Helper to determine if prediction is a main hit (exact or winner correct)
  const isMainHit = (p) => {
    const matchObj = p.match;
    if (matchObj.status !== "FINISHED") return false;
    const pH = Number(p.homeGoals),
      pA = Number(p.awayGoals);
    const mH = Number(matchObj.homeGoals),
      mA = Number(matchObj.awayGoals);
    if (pH === mH && pA === mA) return true; // exact
    // Winner check
    const predResult = pH > pA ? "HOME" : pH < pA ? "AWAY" : "DRAW";
    const actualResult = mH > mA ? "HOME" : mH < mA ? "AWAY" : "DRAW";
    return predResult === actualResult;
  };

  const correctPreds = predsWithMatch.filter((p) => isMainHit(p));
  const wrongPreds = predsWithMatch.filter(
    (p) => p.match.status === "FINISHED" && !isMainHit(p),
  );
  const pendingPreds = predsWithMatch.filter(
    (p) => p.match.status !== "FINISHED",
  );
  const totalPoints = predsWithMatch.reduce(
    (s, p) => s + (p.pointsEarned || 0),
    0,
  );
  const finishedCount = predsWithMatch.filter(
    (p) => p.match.status === "FINISHED",
  ).length;
  const accuracy =
    finishedCount > 0
      ? Math.round((correctPreds.length / finishedCount) * 100)
      : 0;

  const filteredPreds = (
    predFilter === "correct"
      ? correctPreds
      : predFilter === "wrong"
        ? wrongPreds
        : predFilter === "pending"
          ? pendingPreds
          : predsWithMatch
  ).sort((a, b) => {
    const dateA = new Date(a.match.matchDate);
    const dateB = new Date(b.match.matchDate);
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-white">
            {totalPoints}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
            Puntos Totales
          </div>
        </div>
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-emerald-400">
            {accuracy}%
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
            Efectividad
          </div>
        </div>
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-emerald-400">
            {correctPreds.length}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
            Acertadas
          </div>
        </div>
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-red-400">
            {wrongPreds.length}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
            Falladas
          </div>
        </div>
      </div>

      {/* Sort Order Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-0.5 -mx-1 px-1">
          {[
            { id: "all", label: "Todas", count: predsWithMatch.length },
            {
              id: "correct",
              label: "Acertadas",
              count: correctPreds.length,
              color: "text-emerald-400",
            },
            {
              id: "wrong",
              label: "Falladas",
              count: wrongPreds.length,
              color: "text-red-400",
            },
            {
              id: "pending",
              label: "Pendientes",
              count: pendingPreds.length,
              color: "text-amber-400",
            },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setPredFilter(f.id)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
                predFilter === f.id
                  ? "bg-white/10 text-white"
                  : "bg-transparent text-white/60 hover:text-white/60"
              }`}
            >
              {f.label}{" "}
              <span className={f.color || "text-white/50"}>({f.count})</span>
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
          }
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium text-white/60 hover:text-white/60 bg-white/5 hover:bg-white/10 transition-all border-none cursor-pointer shrink-0"
        >
          <ArrowUpDown size={12} />
          {sortOrder === "newest" ? "Más nuevos" : "Más viejos"}
        </button>
      </div>

      {/* Predictions List */}
      <div className="space-y-2">
        {filteredPreds.length === 0 ? (
          <div className="text-center py-10 sm:py-12 text-white/60">
            <BarChart3 size={40} className="mx-auto mb-3 sm:mb-4 opacity-30" />
            <p className="text-sm">No hay predicciones para mostrar</p>
          </div>
        ) : (
          filteredPreds.map((pred) => {
            const matchObj = pred.match;
            if (!matchObj) return null;
            const isFinished = matchObj.status === "FINISHED";
            const hasExtras =
              pred.moreShots ||
              pred.moreCorners ||
              pred.morePossession ||
              pred.moreFouls ||
              pred.moreCards ||
              pred.moreOffsides ||
              pred.moreSaves;

            // Determine result label by comparing actual scores, NOT points
            const pH = Number(pred.homeGoals),
              pA = Number(pred.awayGoals);
            const mH = Number(matchObj.homeGoals),
              mA = Number(matchObj.awayGoals);
            const isExact = isFinished && pH === mH && pA === mA;

            // Check if predicted the correct winner/draw
            const predResult = pH > pA ? "HOME" : pH < pA ? "AWAY" : "DRAW";
            const actualResult = mH > mA ? "HOME" : mH < mA ? "AWAY" : "DRAW";
            const isWinnerCorrect =
              isFinished && !isExact && predResult === actualResult;

            // For border: green if exact or winner correct, red if missed main prediction
            const mainHit = isExact || isWinnerCorrect;

            return (
              <m.div
                key={pred.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-xl p-3 sm:p-4 border-l-[3px] ${
                  !isFinished
                    ? "border-l-amber-500/50"
                    : mainHit
                      ? "border-l-emerald-500"
                      : pred.pointsEarned > 0
                        ? "border-l-blue-500/50"
                        : "border-l-red-500/50"
                }`}
              >
                {/* Top row: Match info + Score Prediction + Result */}
                <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:justify-between">
                  {/* Match Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/50 mb-1 sm:mb-1.5">
                      <span className="truncate">{matchObj.stage}</span>
                      <span>•</span>
                      <span className="shrink-0">
                        {new Date(matchObj.matchDate).toLocaleDateString(
                          "es-AR",
                          { day: "numeric", month: "short" },
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {matchObj.homeTeamLogo && (
                        <img                           src={matchObj.homeTeamLogo}
                          alt=""
                          className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                          loading="lazy"
                          decoding="async"
                          width={16} height={16}
  onError={(e) => {
                            e.target.src = "/placeholder-team.svg";
                          }}
                        />
                      )}
                      <span className="text-xs sm:text-sm font-medium text-white truncate">
                        {matchObj.homeTeam}
                      </span>
                      <span className="text-[10px] sm:text-xs text-white/50 shrink-0">
                        vs
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-white truncate">
                        {matchObj.awayTeam}
                      </span>
                      {matchObj.awayTeamLogo && (
                        <img                           src={matchObj.awayTeamLogo}
                          alt=""
                          className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                          loading="lazy"
                          decoding="async"
                          width={16} height={16}
  onError={(e) => {
                            e.target.src = "/placeholder-team.svg";
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Prediction + Result row */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-1 sm:pt-0 border-t border-white/5 sm:border-none">
                    {/* Prediction */}
                    <div className="text-center shrink-0">
                      <div className="text-[9px] sm:text-[10px] text-white/60 uppercase tracking-wider mb-0.5 sm:mb-1">
                        Pronóstico
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-lg text-xs sm:text-sm font-bold text-white border border-white/10">
                        {pred.homeGoals} - {pred.awayGoals}
                        {pred.isJoker && (
                          <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                            x2
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Result */}
                    <div className="text-center shrink-0 min-w-[60px] sm:w-20">
                      {isFinished ? (
                        <>
                          <div className="text-[9px] sm:text-[10px] text-white/60 uppercase tracking-wider mb-0.5 sm:mb-1">
                            Resultado
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-white mb-1">
                            {matchObj.homeGoals} - {matchObj.awayGoals}
                          </div>
                          <div
                            className={`text-[9px] sm:text-[10px] font-bold ${
                              isExact
                                ? "text-emerald-400"
                                : isWinnerCorrect
                                  ? "text-blue-400"
                                  : pred.pointsEarned > 0
                                    ? "text-violet-400"
                                    : "text-red-400"
                            }`}
                          >
                            {isExact
                              ? "EXACTO"
                              : isWinnerCorrect
                                ? "GANADOR"
                                : pred.pointsEarned > 0
                                  ? "BONUS"
                                  : "FALLÓ"}
                            <span className="ml-1 opacity-70">
                              +{pred.pointsEarned}pts
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] sm:text-xs text-white/50 italic">
                          {matchObj.status === "SCHEDULED"
                            ? "Por jugar"
                            : "En vivo"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {hasExtras && (
                  <>
                    <button
                      onClick={() => toggleMatch(pred.id)}
                      className="w-full flex items-center justify-center gap-1 mt-3 pt-2 pb-1 text-[10px] sm:text-xs text-white/60 hover:text-white/60 bg-transparent border-t border-white/5 cursor-pointer transition-all"
                    >
                      {expandedMatches[pred.id] ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                      {expandedMatches[pred.id]
                        ? "Ocultar Opciones Extra"
                        : "Ver Opciones Extra"}
                    </button>
                    {expandedMatches[pred.id] && (
                      <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2 pt-2 mt-1 border-t border-white/5"
                      >
                        {[
                          {
                            configKey: "allowMoreShots",
                            key: "moreShots",
                            label: "Más Remates al Arco",
                            icon: (
                              <Crosshair
                                size={13}
                                className="text-violet-400/60"
                              />
                            ),
                            colorClass:
                              "text-violet-300 bg-violet-500/10 border-violet-500/20",
                          },
                          {
                            configKey: "allowMoreCorners",
                            key: "moreCorners",
                            label: "Más Córners",
                            icon: (
                              <Flag size={13} className="text-amber-400/60" />
                            ),
                            colorClass:
                              "text-amber-300 bg-amber-500/10 border-amber-500/20",
                          },
                          {
                            configKey: "allowMorePossession",
                            key: "morePossession",
                            label: "Más Posesión",
                            icon: (
                              <span className="text-emerald-400/60 text-[13px]">
                                ⚽
                              </span>
                            ),
                            colorClass:
                              "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
                          },
                          {
                            configKey: "allowMoreFouls",
                            key: "moreFouls",
                            label: "Más Faltas",
                            icon: (
                              <span className="text-blue-400/60 text-[13px]">
                                🦵
                              </span>
                            ),
                            colorClass:
                              "text-blue-300 bg-blue-500/10 border-blue-500/20",
                          },
                          {
                            configKey: "allowMoreCards",
                            key: "moreCards",
                            label: "Más Tarjetas",
                            icon: (
                              <span className="text-yellow-400/60 text-[13px]">
                                🟨
                              </span>
                            ),
                            colorClass:
                              "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
                          },
                          {
                            configKey: "allowMoreOffsides",
                            key: "moreOffsides",
                            label: "Más Offsides",
                            icon: (
                              <span className="text-violet-400/60 text-[13px]">
                                🏁
                              </span>
                            ),
                            colorClass:
                              "text-violet-300 bg-violet-500/10 border-violet-500/20",
                          },
                          {
                            configKey: "allowMoreSaves",
                            key: "moreSaves",
                            label: "Más Atajadas",
                            icon: (
                              <span className="text-emerald-400/60 text-[13px]">
                                🧤
                              </span>
                            ),
                            colorClass:
                              "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
                          },
                        ].map(
                          (market) =>
                            pred[market.key] && (
                              <div
                                key={market.key}
                                className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3"
                              >
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  {market.icon}
                                  <span className="text-[10px] sm:text-xs text-white/60">
                                    {market.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded border ${market.colorClass}`}
                                  >
                                    {pred[market.key] === "HOME"
                                      ? matchObj.homeTeam
                                      : pred[market.key] === "AWAY"
                                        ? matchObj.awayTeam
                                        : "Igual"}
                                  </span>
                                  {isFinished && (
                                    <span
                                      className={`text-[10px] font-bold ${pred[`${market.key}Hit`] === true ? "text-emerald-400" : "text-red-400"}`}
                                    >
                                      {pred[`${market.key}Hit`] === true
                                        ? "✓"
                                        : "✗"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ),
                        )}
                      </m.div>
                    )}
                  </>
                )}

                {/* Botón predicciones grupales */}
                {groupId && isFinished && (
                  <div className="mt-3 pt-3 flex justify-end border-t border-white/5">
                    <button
                      onClick={() => setSelectedMatchModal(matchObj)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 cursor-pointer"
                    >
                      <Users size={12} /> Ver de todos
                    </button>
                  </div>
                )}
              </m.div>
            );
          })
        )}
      </div>

      {groupId && (
        <GroupPredictionsModal
          isOpen={!!selectedMatchModal}
          onClose={() => setSelectedMatchModal(null)}
          groupId={groupId}
          match={selectedMatchModal}
          groupSettings={groupSettings}
        />
      )}
    </div>
  );
}
