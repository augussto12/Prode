import { useState, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Calendar, ChevronDown, Star, BarChart3, List } from "lucide-react";
import api from "../../services/api";
import MatchCard from "./MatchCard";
import PredictionHistory from "./PredictionHistory";
import useAuthStore from "../../store/authStore";
import { tRound, tTeamName } from "../../utils/translations";

const JOKER_LIMIT = 3;

export default function ProdeMatches({
  competitionId,
  groupId,
  groupSettings,
  initialTab = "matches",
  showSubTabs = true,
}) {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [filter, setFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("upcoming"); // 'upcoming', 'past', 'all'
  const [showFavPicker, setShowFavPicker] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // 'matches', 'history'
  const [scoringConfig, setScoringConfig] = useState(null);
  const [phaseWindows, setPhaseWindows] = useState(null);
  const user = useAuthStore((state) => state.user);

  // Sincronizar tab cuando Competition cambia entre tabs matches/predictions
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (competitionId) {
      loadData();
    }
  }, [competitionId]);

  useEffect(() => {
    api
      .get("/predictions/scoring-config")
      .then(({ data }) => setScoringConfig(data))
      .catch(() => setScoringConfig(null));
  }, []);

  const loadData = async () => {
    try {
      const compParam = `?competitionId=${competitionId}`;

      const [matchesRes, favRes, predRes, windowsRes] = await Promise.all([
        api.get(`/matches${compParam}`),
        api.get("/auth/me/favorites").catch(() => ({ data: [] })),
        api.get("/predictions/my").catch(() => ({ data: [] })),
        api.get(`/predictions/phase-windows${compParam}`).catch(() => ({ data: null })),
      ]);

      const matches = matchesRes.data || [];
      const userPreds = predRes.data || [];
      // Mapear predictions por externalFixtureId (convertir a Number para match con fix.id numérico)
      const predMap = new Map(userPreds.map((p) => [Number(p.externalFixtureId), p]));

      const extractedTeams = new Map();

      const normalizedMatches = matches.map((match) => {
        if (match.homeTeamId && !extractedTeams.has(match.homeTeamId)) {
          extractedTeams.set(match.homeTeamId, {
            id: match.homeTeamId,
            name: match.homeTeam,
            logo: match.homeTeamLogo,
          });
        }
        if (match.awayTeamId && !extractedTeams.has(match.awayTeamId)) {
          extractedTeams.set(match.awayTeamId, {
            id: match.awayTeamId,
            name: match.awayTeam,
            logo: match.awayTeamLogo,
          });
        }

        const rawStage = match.round || match.stage || "";
        return {
          ...match,
          stage: tRound(rawStage.replace(/ - \d+$/, "")),
          prediction: predMap.get(Number(match.externalId)) || null,
        };
      });

      setMatches(normalizedMatches);
      setTeams(
        Array.from(extractedTeams.values()).sort((a, b) =>
          tTeamName(a.name).localeCompare(tTeamName(b.name), "es"),
        ),
      );
      setFavorites(favRes.data?.map((f) => f.teamName) || []);
      setPredictions(userPreds);
      setPhaseWindows(windowsRes.data || null);
    } catch (err) {
      console.error("Error loading matches/predictions:", err);
    } finally {
      setLoading(false);
    }
  };

  const stages = [...new Set(matches.map((m) => m.stage))];
  const lockedPhaseMessages = Object.values(phaseWindows?.phaseWindows || {})
    .filter((phase) => phase.phaseRule && !phase.canPredict && phase.reason)
    .slice(0, 2);
  const predictionsMap = new Map(
    predictions.map((p) => [Number(p.externalFixtureId), p]),
  );
  const usedJokers = predictions.filter(
    (p) => p.isJoker && Number(p.competitionId) === Number(competitionId),
  ).length;
  const remainingJokers = Math.max(0, JOKER_LIMIT - usedJokers);

  const toggleFavorite = async (teamName) => {
    const updated = favorites.includes(teamName)
      ? favorites.filter((t) => t !== teamName)
      : [...favorites, teamName];
    setFavorites(updated);
    await api.put("/auth/me/favorites", { teams: updated });
  };

  const filteredMatches = matches.filter((m) => {
    // 1. Team/Favorite Filter
    if (filter === "favorites") {
      if (!favorites.includes(m.homeTeam) && !favorites.includes(m.awayTeam))
        return false;
    } else if (filter !== "all") {
      if (m.stage !== filter) return false;
    }

    // 2. Time/Status Filter
    if (timeFilter === "upcoming") {
      // Hide finished matches
      if (["FINISHED", "AET", "PEN", "FT"].includes(m.status)) return false;
    } else if (timeFilter === "past") {
      // Show ONLY finished/past matches
      if (
        !["FINISHED", "AET", "PEN", "FT"].includes(m.status) &&
        new Date(m.matchDate) > new Date()
      )
        return false;
    }

    return true;
  });

  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const aIsFav =
      favorites.includes(a.homeTeam) || favorites.includes(a.awayTeam);
    const bIsFav =
      favorites.includes(b.homeTeam) || favorites.includes(b.awayTeam);
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;

    if (timeFilter === "past") {
      return new Date(b.matchDate) - new Date(a.matchDate);
    }
    return new Date(a.matchDate) - new Date(b.matchDate);
  });

  const groupedMatches = {};
  sortedMatches.forEach((m) => {
    const dateKey = new Date(m.matchDate).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!groupedMatches[dateKey]) groupedMatches[dateKey] = [];
    groupedMatches[dateKey].push(m);
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {user && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-amber-200">Comodines x2</div>
              <div className="text-xs text-amber-100/70">
                Tenés 3 partidos por competencia. Podés moverlos hasta 5 minutos antes del inicio.
              </div>
            </div>
            <div className="shrink-0 rounded-lg bg-black/20 border border-amber-500/20 px-3 py-1.5 text-sm font-black text-amber-200">
              {remainingJokers}/{JOKER_LIMIT} disponibles
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/45 shrink-0">
                  Puntaje por partido
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-white/70">
                  <span className="rounded-md bg-white/10 px-2 py-1">
                    Exacto: <strong className="text-white">{scoringConfig?.exactScore ?? "-"} pts</strong>
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-1">
                    Ganador/empate: <strong className="text-white">{scoringConfig?.correctWinner ?? "-"} pts</strong>
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-1">
                    Sin acierto: <strong className="text-white">0 pts</strong>
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/45 shrink-0">
                  Predicciones finales
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-white/70">
                  <span className="rounded-md bg-white/10 px-2 py-1">
                    Campeon: <strong className="text-white">{scoringConfig?.champion ?? "-"} pts</strong>
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-1">
                    Subcampeon: <strong className="text-white">{scoringConfig?.runnerUp ?? "-"} pts</strong>
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-1">
                    Goleador: <strong className="text-white">{scoringConfig?.topScorer ?? "-"} pts</strong>
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-1">
                    Guante de oro: <strong className="text-white">{scoringConfig?.goldenGlove ?? "-"} pts</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {lockedPhaseMessages.length > 0 && (
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-xs text-sky-100/80">
              <div className="font-bold text-sky-100 mb-1">
                Ventanas de eliminatorias
              </div>
              <div className="space-y-1">
                {lockedPhaseMessages.map((phase) => (
                  <div key={phase.phaseKey}>
                    {phase.label}: {phase.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showSubTabs && <div className="flex bg-white/5 p-1 rounded-xl w-full sm:w-fit">
        <button
          onClick={() => setActiveTab("matches")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border-none cursor-pointer ${
            activeTab === "matches"
              ? "bg-white/10 text-white shadow-sm"
              : "bg-transparent text-white/60 hover:text-white/60"
          }`}
        >
          <List size={14} /> Partidos
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border-none cursor-pointer ${
            activeTab === "history"
              ? "bg-white/10 text-white shadow-sm"
              : "bg-transparent text-white/60 hover:text-white/60"
          }`}
        >
          <BarChart3 size={14} /> Historial
        </button>
      </div>}

      {activeTab === "history" ? (
        <PredictionHistory
          predictions={predictions}
          matches={matches}
          groupId={groupId}
          groupSettings={groupSettings}
        />
      ) : (
        <>
          {/* Filters Header */}
          <div className="flex flex-col gap-3 sm:gap-4 mb-2">
            {/* Time Segmented Control */}
            <div className="flex p-1 rounded-xl border border-white/5 w-full overflow-x-auto scrollbar-hide" style={{ background: 'color-mix(in srgb, var(--bg-start-color, #000) 20%, transparent)' }}>
              {[
                { id: "upcoming", label: "Próximos" },
                { id: "past", label: "Terminados" },
                { id: "all", label: "Todos" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTimeFilter(t.id)}
                  className={`flex-1 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all border-none cursor-pointer whitespace-nowrap ${
                    timeFilter === t.id
                      ? "bg-indigo-500 text-white shadow-md"
                      : "bg-transparent text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Other Filters (Favorites, Stage) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFavPicker(!showFavPicker)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer border-none shrink-0"
                style={{
                  background: showFavPicker
                    ? "var(--color-accent)"
                    : "rgba(255,255,255,0.05)",
                  color: showFavPicker ? "#000" : "rgba(255,255,255,0.7)",
                }}
              >
                <Star size={14} />{" "}
                <span className="hidden xs:inline">Favoritos</span>
                <span className="xs:hidden">⭐</span>
              </button>
              <div className="relative flex-1 min-w-0">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full appearance-none bg-white/5 border border-white/10 text-white/70 text-xs sm:text-sm px-3 sm:px-4 py-2 pr-7 sm:pr-8 rounded-xl cursor-pointer focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Todas las Fases</option>
                  <option value="favorites">⭐ Mis Favoritos</option>
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {tRound(s)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none"
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showFavPicker && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <p className="text-white/60 text-xs sm:text-sm mb-3">
                    Seleccioná tus equipos favoritos:
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {teams.map((team) => (
                      <button
                        key={team.name}
                        onClick={() => toggleFavorite(team.name)}
                        className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm transition-all border cursor-pointer ${
                          favorites.includes(team.name)
                            ? "border-amber-400/50 text-amber-300 bg-amber-400/10"
                            : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/30"
                        }`}
                      >
                        {team.logo ? (
                          <img                             src={team.logo}
                            alt=""
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain"
                            loading="lazy"
                            decoding="async"
                            width={12} height={12}
  onError={(e) => {
                              e.target.src = "/placeholder-team.svg";
                            }}
                          />
                        ) : (
                          <span>⚽</span>
                        )}
                        <span className="truncate max-w-[60px] sm:max-w-none">
                          {tTeamName(team.name)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {Object.entries(groupedMatches).map(([date, dateMatches]) => {
            const byStage = {};
            dateMatches.forEach((m) => {
              const stage = m.stage || "Sin fase";
              if (!byStage[stage]) byStage[stage] = [];
              byStage[stage].push(m);
            });

            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Calendar size={14} className="text-white/60 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-semibold text-white/50 uppercase tracking-wider truncate">
                    {date}
                  </h2>
                </div>
                {Object.entries(byStage).map(([stage, stageMatches]) => (
                  <div key={stage} className="mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 mb-2 ml-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: "var(--color-primary)" }}
                      />
                      <span className="text-[10px] sm:text-xs font-medium text-white/50">
                        {tRound(stage)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {stageMatches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isFavorite={
                            favorites.includes(match.homeTeam) ||
                            favorites.includes(match.awayTeam)
                          }
                          existingPrediction={predictionsMap.get(match.id)}
                          onPredictionSaved={loadData}
                          hideStage={true}
                          groupSettings={groupSettings}
                          jokerRemaining={remainingJokers}
                          jokerLimit={JOKER_LIMIT}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {sortedMatches.length === 0 && (
            <div className="text-center py-12 sm:py-16 text-white/60 glass-card rounded-xl">
              <Calendar size={40} className="mx-auto mb-3 sm:mb-4 opacity-30" />
              <p className="text-sm sm:text-lg">No hay partidos para mostrar</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
