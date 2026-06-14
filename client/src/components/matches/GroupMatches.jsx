import { useState, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Calendar, Trophy, Users, Loader2, X } from "lucide-react";
import api from "../../services/api";
import { tRound, tTeamName } from "../../utils/translations";

const LOCKOUT_MINUTES = 5;
const NOT_STARTED_STATUS_SHORTS = new Set(["NS", "TBD", "PST"]);

function getMatchTimestamp(match) {
  const raw = match?.matchDate || match?.date;
  if (!raw) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isMatchStarted(match, now = new Date()) {
  const status = String(match?.status || "").toUpperCase();
  if (status === "LIVE" || status === "FINISHED") return true;

  const statusShort = String(match?.statusShort || "").toUpperCase();
  if (statusShort && !NOT_STARTED_STATUS_SHORTS.has(statusShort)) return true;

  const timestamp = getMatchTimestamp(match);
  return timestamp !== null && now.getTime() >= timestamp;
}

function getPredictionVisibilityCutoff(match) {
  const window = match?.predictionWindow;
  if (window?.phaseRule && window.closesAt) {
    const timestamp = new Date(window.closesAt).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const timestamp = getMatchTimestamp(match);
  if (timestamp === null) return null;
  return timestamp - LOCKOUT_MINUTES * 60 * 1000;
}

function canViewGroupPredictions(match, now = new Date()) {
  if (!match) return false;
  if (isMatchStarted(match, now)) return true;

  const cutoff = getPredictionVisibilityCutoff(match);
  if (cutoff === null || now.getTime() < cutoff) return false;

  const window = match.predictionWindow;
  if (window?.phaseRule) {
    if (window.previousFinished === false) return false;
    if (window.canPredict === false && !window.closesAt) return false;
  }

  return true;
}

function getGroupPredictionsAvailabilityLabel(match, now = new Date()) {
  if (!canViewGroupPredictions(match, now)) {
    return "Disponible al empezar";
  }

  if (String(match?.status || "").toUpperCase() === "FINISHED") {
    return "Ver resultados del grupo";
  }

  if (isMatchStarted(match, now)) {
    return "Ver predicciones en vivo";
  }

  return "Predicciones cerradas";
}

export default function GroupMatches({ groupId, competitionId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loadingPreds, setLoadingPreds] = useState(false);

  useEffect(() => {
    if (competitionId) loadMatches();
  }, [competitionId]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const { data: fixtures } = await api.get(
        `/matches?competitionId=${competitionId}`,
      );

      const normalized = fixtures.map((match) => ({
        id: match.externalId || match.id,
        externalId: match.externalId || match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeLogo: match.homeTeamLogo,
        awayLogo: match.awayTeamLogo,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        status: match.status,
        statusShort: match.statusShort,
        elapsed: match.elapsed,
        date: match.matchDate,
        matchDate: match.matchDate,
        round: match.round || match.stage || "",
        venue: match.venue || "",
        predictionWindow: match.predictionWindow,
      }));

      // Ordenar por fecha
      normalized.sort((a, b) => new Date(a.date) - new Date(b.date));
      setMatches(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPredictions = async (match) => {
    setSelectedMatch(match);
    setLoadingPreds(true);
    try {
      const { data } = await api.get(
        `/groups/${groupId}/matches/${match.id}/predictions`
      );
      setPredictions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreds(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isFinished = (m) => m.status === "FINISHED";
  const isLive = (m) => m.status === "LIVE";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    );
  }

  // Agrupar por fecha
  const byDate = {};
  matches.forEach((m) => {
    const dateKey = new Date(m.date).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(m);
  });

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, dateMatches]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-white/40" />
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
              {date}
            </span>
          </div>
          <div className="space-y-2">
              {dateMatches.map((match) => {
                const finished = isFinished(match);
                const canViewPredictions = canViewGroupPredictions(match);
                const availabilityLabel =
                  getGroupPredictionsAvailabilityLabel(match);
                return (
              <button
                key={match.id}
                onClick={() => canViewPredictions && loadPredictions(match)}
                disabled={!canViewPredictions}
                className={`w-full text-left glass-card rounded-xl p-3 sm:p-4 transition-all border border-white/5 ${
                  canViewPredictions
                    ? "hover:bg-white/[0.08] hover:border-white/15 cursor-pointer"
                    : "opacity-70 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Home */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <img
                      src={match.homeLogo || "/placeholder-team.svg"}
                      alt=""
                      className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0"
                      loading="lazy"
                    />
                    <span className="text-sm font-semibold text-white truncate">
                      {tTeamName(match.homeTeam)}
                    </span>
                  </div>

                  {/* Score/Time */}
                  <div className="shrink-0 text-center px-2">
                    {finished || isLive(match) ? (
                      <div className="text-lg font-bold text-white">
                        {match.homeGoals ?? 0} - {match.awayGoals ?? 0}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-white/50">
                        {formatDate(match.date).split(", ")[1]}
                      </div>
                    )}
                    {isLive(match) && (
                      <div className="text-[10px] text-red-400 font-bold animate-pulse">
                        {match.elapsed}'
                      </div>
                    )}
                  </div>

                  {/* Away */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-sm font-semibold text-white truncate">
                      {tTeamName(match.awayTeam)}
                    </span>
                    <img
                      src={match.awayLogo || "/placeholder-team.svg"}
                      alt=""
                      className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Round + Predictions indicator */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-white/40">
                    {tRound(match.round)}
                  </span>
                  <div className={`flex items-center gap-1 text-[10px] ${canViewPredictions ? "text-indigo-400" : "text-white/25"}`}>
                    <Users size={10} />
                    {availabilityLabel}
                  </div>
                </div>
              </button>
            );
            })}
          </div>
        </div>
      ))}

      {matches.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <Trophy size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay partidos programados</p>
        </div>
      )}

      {/* Modal de predicciones del grupo */}
      <AnimatePresence>
        {selectedMatch && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMatch(null)}
          >
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto border border-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">
                  Predicciones del grupo
                </h3>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="text-white/50 hover:text-white bg-transparent border-none cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Match info */}
              <div className="flex items-center justify-between gap-3 mb-5 p-3 rounded-xl bg-white/5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img
                    src={selectedMatch.homeLogo}
                    className="w-6 h-6 object-contain"
                    alt=""
                  />
                  <span className="text-sm font-semibold text-white truncate">
                    {tTeamName(selectedMatch.homeTeam)}
                  </span>
                </div>
                <div className="text-lg font-bold text-white px-2">
                  {isFinished(selectedMatch) || isLive(selectedMatch)
                    ? `${selectedMatch.homeGoals ?? 0} - ${selectedMatch.awayGoals ?? 0}`
                    : "vs"}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-semibold text-white truncate">
                    {tTeamName(selectedMatch.awayTeam)}
                  </span>
                  <img
                    src={selectedMatch.awayLogo}
                    className="w-6 h-6 object-contain"
                    alt=""
                  />
                </div>
              </div>

              {loadingPreds ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="text-white/30 animate-spin" />
                </div>
              ) : predictions.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-4">
                  Nadie hizo predicciones todavía
                </p>
              ) : (
                <div className="space-y-2">
                  {predictions.map((entry) => (
                    <div
                      key={entry.user.displayName}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70">
                          {entry.user.displayName.charAt(0)}
                        </div>
                        <span className="text-sm text-white/80">
                          {entry.user.displayName}
                        </span>
                      </div>
                      <div className="text-right">
                        {entry.prediction ? (
                          <div className="inline-flex items-center justify-end gap-1.5 text-sm font-bold text-white">
                            <span>
                              {entry.prediction.homeGoals ?? "-"} -{" "}
                              {entry.prediction.awayGoals ?? "-"}
                            </span>
                            {entry.prediction.isJoker && (
                              <span className="rounded border border-amber-500/30 bg-amber-500/15 px-1 py-0.5 text-[9px] font-black leading-none text-amber-300">
                                x2
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-white/30">
                            Sin predicción
                          </span>
                        )}
                        {entry.prediction?.pointsEarned > 0 && (
                          <div className="text-[10px] text-amber-400">
                            +{entry.prediction.pointsEarned} pts
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
