import { useState, useEffect, useRef, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { Star, Check, Lock, Clock, Users } from "lucide-react";
import api from "../../services/api";
import useAuthStore from "../../store/authStore";
import useToastStore from "../../store/toastStore";
import GroupPredictionsModal from "./GroupPredictionsModal";
import { tRound, tTeamName } from "../../utils/translations";
import { canViewGroupPredictions } from "../../utils/groupPredictionVisibility";

const LOCKOUT_MINUTES = 5;

export default memo(function MatchCard({
  match,
  isFavorite,
  existingPrediction: existingProp,
  onPredictionSaved,
  hideStage = false,
  priority = false,
  jokerRemaining = 0,
  jokerLimit = 3,
  jokerScopeLabel = "esta competencia",
  groupPredictionGroups = [],
}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  const [prediction, setPrediction] = useState({
    homeGoals: "",
    awayGoals: "",
    isJoker: false,
  });
  const [saving, setSaving] = useState(false);
  const [existingPrediction, setExistingPrediction] = useState(existingProp || null);
  const [showGroupPredictions, setShowGroupPredictions] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isSavingRef = useRef(false);

  const matchDate = new Date(match.matchDate);
  const lockoutDate = new Date(matchDate);
  lockoutDate.setMinutes(lockoutDate.getMinutes() - LOCKOUT_MINUTES);
  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);
  const minutesUntilLockout = Math.floor((lockoutDate - nowDate) / 60000);
  const hasPhaseRule = Boolean(match.predictionWindow?.phaseRule);
  const phaseLocked = hasPhaseRule && match.predictionWindow?.canPredict === false;
  const isPast =
    match.status !== "SCHEDULED" ||
    phaseLocked ||
    (!hasPhaseRule && nowDate >= lockoutDate);
  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FINISHED";
  const detailFixtureId = match.externalId || match.id;
  const canOpenMatchDetail = Boolean(detailFixtureId && (isLive || isFinished));
  const availableGroupPredictionGroups = useMemo(() => {
    if (!Array.isArray(groupPredictionGroups)) return [];

    return groupPredictionGroups.filter((group) => {
      if (!group?.id) return false;
      if (Number(group.id) === 1) return false;
      if (!group.competitionId || !match.competitionId) return true;
      return Number(group.competitionId) === Number(match.competitionId);
    });
  }, [groupPredictionGroups, match.competitionId]);
  const canOpenGroupPredictions =
    Boolean(user) &&
    availableGroupPredictionGroups.length > 0 &&
    canViewGroupPredictions(match, nowDate);
  const canToggleJoker =
    !isPast &&
    (prediction.isJoker || existingPrediction?.isJoker || jokerRemaining > 0);
  const needsPrediction =
    user && !existingPrediction && !isPast && !isLive && !isFinished && !phaseLocked;
  const hasCompleteScore =
    prediction.homeGoals !== "" && prediction.awayGoals !== "";

  useEffect(() => {
    if (existingProp) {
      setExistingPrediction(existingProp);
      setPrediction({
        homeGoals: existingProp.homeGoals ?? "",
        awayGoals: existingProp.awayGoals ?? "",
        isJoker: existingProp.isJoker || false,
      });
    }
  }, [existingProp]);

  useEffect(() => {
    if (isFinished || isLive || !match.matchDate) return undefined;

    const lockAt = new Date(match.matchDate).getTime() - LOCKOUT_MINUTES * 60 * 1000;
    if (Number.isNaN(lockAt)) return undefined;

    const msUntilLock = lockAt - Date.now();
    const timeoutId = window.setTimeout(
      () => setNowMs(Date.now()),
      Math.max(0, msUntilLock + 250),
    );

    let intervalId = null;
    if (msUntilLock <= 24 * 60 * 60 * 1000) {
      intervalId = window.setInterval(() => setNowMs(Date.now()), 30000);
    }

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isFinished, isLive, match.matchDate]);

  const hasChanges = useMemo(() => {
    if (!existingPrediction) {
      return hasCompleteScore;
    }

    return (
      hasCompleteScore &&
      (
        String(prediction.homeGoals) !== String(existingPrediction.homeGoals ?? "") ||
        String(prediction.awayGoals) !== String(existingPrediction.awayGoals ?? "") ||
        (prediction.isJoker || false) !== (existingPrediction.isJoker || false)
      )
    );
  }, [prediction, existingPrediction, hasCompleteScore]);

  const handleSave = async () => {
    if (isSavingRef.current) return;
    if (isPast) {
      addToast({
        type: "warning",
        message: match.predictionWindow?.reason || "Las predicciones de este partido estan cerradas",
      });
      return;
    }
    if (!hasCompleteScore) {
      addToast({ type: "warning", message: "Carga los goles de los dos equipos" });
      return;
    }
    isSavingRef.current = true;
    setSaving(true);

    const payload = {
      homeGoals: prediction.homeGoals !== "" ? Number(prediction.homeGoals) : null,
      awayGoals: prediction.awayGoals !== "" ? Number(prediction.awayGoals) : null,
      isJoker: prediction.isJoker || false,
    };

    try {
      await api.post("/predictions", {
        externalFixtureId: match.externalId,
        competitionId: match.competitionId,
        ...payload,
      });

      setExistingPrediction(payload);
      addToast({ type: "success", message: "Prediccion guardada" });
      if (onPredictionSaved) onPredictionSaved();
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.error || "Error al guardar la prediccion.",
      });
      if (err.response?.data?.error?.toLowerCase().includes("comodines")) {
        setPrediction((prev) => ({ ...prev, isJoker: false }));
      }
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const statusBadge = () => {
    if (isFinished) {
      return (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
          Finalizado
        </span>
      );
    }

    if (isLive) {
      const ss = match.statusShort;
      let liveLabel = "EN VIVO";
      if (ss === "HT") liveLabel = "Entretiempo";
      else if (ss === "ET") liveLabel = "Tiempo Extra";
      else if (ss === "P" || ss === "PEN") liveLabel = "Penales";
      else if (ss === "BT") liveLabel = "Descanso TE";
      else if (match.elapsed) liveLabel = `${match.elapsed}'`;

      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          {liveLabel}
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 bg-white/10 text-white/50 rounded-full text-[11px] sm:text-xs">
        {matchDate
          .toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          .toLowerCase()}
      </span>
    );
  };

  const teamLogoFallback = (e) => {
    e.target.src = "/placeholder-team.svg";
  };

  const openMatchDetail = () => {
    if (canOpenMatchDetail) {
      navigate(`/partido/${detailFixtureId}`);
    }
  };

  const handleCardKeyDown = (event) => {
    if (!canOpenMatchDetail) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMatchDetail();
    }
  };

  const handleTeamClick = (event, teamId) => {
    event.stopPropagation();
    if (teamId) navigate(`/equipo/${teamId}`);
  };

  const handleTeamKeyDown = (event, teamId) => {
    if (!teamId) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      navigate(`/equipo/${teamId}`);
    }
  };

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={canOpenMatchDetail ? openMatchDetail : undefined}
      onKeyDown={handleCardKeyDown}
      role={canOpenMatchDetail ? "button" : undefined}
      tabIndex={canOpenMatchDetail ? 0 : undefined}
      aria-label={
        canOpenMatchDetail
          ? `Ver detalle de ${tTeamName(match.homeTeam)} vs ${tTeamName(match.awayTeam)}`
          : undefined
      }
      className={`glass-card rounded-xl sm:rounded-2xl overflow-hidden transition-all hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-secondary)_20%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400/70 ${canOpenMatchDetail ? "cursor-pointer" : ""} ${isFavorite ? "ring-1 ring-amber-400/30" : ""}`}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {!hideStage && match.stage && (
              <span className="text-[10px] sm:text-xs text-white/60 font-medium truncate">
                {tRound(match.stage)}
              </span>
            )}
            {match.round && /2nd\s*Leg/i.test(match.round) && (
              <span className="px-1 sm:px-1.5 py-0.5 bg-indigo-500/15 text-indigo-400 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider border border-indigo-500/20 shrink-0">
                Vuelta
              </span>
            )}
            {match.round && /1st\s*Leg/i.test(match.round) && (
              <span className="px-1 sm:px-1.5 py-0.5 bg-white/5 text-white/60 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider border border-white/10 shrink-0">
                Ida
              </span>
            )}
            {needsPrediction && (
              <span className="inline-flex items-center gap-1 text-[9px] text-amber-400/60 font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                Sin cargar
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user && !isPast && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!canToggleJoker) {
                    addToast({
                      type: "info",
                      message: `Ya usaste los ${jokerLimit} comodines x2 de ${jokerScopeLabel}`,
                    });
                    return;
                  }
                  setPrediction((prev) => ({ ...prev, isJoker: !prev.isJoker }));
                }}
                disabled={isPast}
                className={`flex items-center justify-center px-1.5 py-0.5 rounded cursor-pointer transition-all border text-xs ${
                  prediction.isJoker
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                    : canToggleJoker
                      ? "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                      : "bg-white/[0.02] border-white/5 text-white/25"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={`Comodin x2: maximo ${jokerLimit} partidos en ${jokerScopeLabel}`}
              >
                x2
              </button>
            )}
            {isFavorite && <Star size={12} className="text-amber-400 fill-amber-400" />}
            {statusBadge()}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div
            className={`flex-1 text-center min-w-0 ${match.homeTeamId ? "cursor-pointer group" : ""}`}
            onClick={(event) => handleTeamClick(event, match.homeTeamId)}
            onKeyDown={(event) => handleTeamKeyDown(event, match.homeTeamId)}
            role={match.homeTeamId ? "button" : undefined}
            tabIndex={match.homeTeamId ? 0 : undefined}
            aria-label={match.homeTeamId ? `Ver detalle de ${tTeamName(match.homeTeam)}` : undefined}
          >
            {match.homeTeamLogo ? (
              <img
                src={match.homeTeamLogo}
                alt={tTeamName(match.homeTeam)}
                width={32}
                height={32}
                className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain ${match.homeTeamId ? "group-hover:scale-110 transition-transform" : ""}`}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                decoding="async"
                onError={teamLogoFallback}
              />
            ) : (
              <div className="text-xl sm:text-2xl mb-1">{match.homeFlag || ""}</div>
            )}
            <div
              className={`text-[11px] sm:text-sm font-semibold text-white truncate px-0.5 ${match.homeTeamId ? "group-hover:text-indigo-300 transition-colors" : ""}`}
            >
              {tTeamName(match.homeTeam)}
            </div>
          </div>

          <div className="px-2 sm:px-4 text-center">
            {isFinished || isLive ? (
              <div className="text-lg sm:text-2xl font-bold text-white">
                {match.homeGoals} <span className="text-white/50">-</span>{" "}
                {match.awayGoals}
              </div>
            ) : !user ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  addToast({
                    type: "warning",
                    message: "Inicia sesion para hacer predicciones",
                  });
                  navigate("/login");
                }}
                className="flex flex-col items-center justify-center mx-auto text-white/50 hover:text-white/90 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all border border-white/10 cursor-pointer shadow-none"
              >
                <Lock size={14} className="mb-1" />
                <span className="text-[10px] uppercase font-bold leading-none">
                  Predecir
                </span>
              </button>
            ) : phaseLocked ? (
              <div
                className="flex flex-col items-center justify-center mx-auto text-white/45 bg-white/5 rounded-lg px-3 py-1.5 border border-white/10"
                title={match.predictionWindow?.reason || "Prediccion bloqueada"}
              >
                <Lock size={14} className="mb-1" />
                <span className="text-[10px] uppercase font-bold leading-none">
                  Bloqueado
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={prediction.homeGoals}
                  onChange={(e) => setPrediction({ ...prediction, homeGoals: e.target.value })}
                  onClick={(event) => event.stopPropagation()}
                  disabled={isPast}
                  placeholder="-"
                  className="w-7 h-8 sm:w-9 sm:h-9 text-center bg-white/10 border border-white/20 rounded-lg text-white font-bold text-sm sm:text-base focus:outline-none focus:border-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-white/50 font-bold mx-[-2px]">-</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={prediction.awayGoals}
                  onChange={(e) => setPrediction({ ...prediction, awayGoals: e.target.value })}
                  onClick={(event) => event.stopPropagation()}
                  disabled={isPast}
                  placeholder="-"
                  className="w-7 h-8 sm:w-9 sm:h-9 text-center bg-white/10 border border-white/20 rounded-lg text-white font-bold text-sm sm:text-base focus:outline-none focus:border-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}
          </div>

          <div
            className={`flex-1 text-center min-w-0 ${match.awayTeamId ? "cursor-pointer group" : ""}`}
            onClick={(event) => handleTeamClick(event, match.awayTeamId)}
            onKeyDown={(event) => handleTeamKeyDown(event, match.awayTeamId)}
            role={match.awayTeamId ? "button" : undefined}
            tabIndex={match.awayTeamId ? 0 : undefined}
            aria-label={match.awayTeamId ? `Ver detalle de ${tTeamName(match.awayTeam)}` : undefined}
          >
            {match.awayTeamLogo ? (
              <img
                src={match.awayTeamLogo}
                alt={tTeamName(match.awayTeam)}
                width={32}
                height={32}
                className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain ${match.awayTeamId ? "group-hover:scale-110 transition-transform" : ""}`}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                decoding="async"
                onError={teamLogoFallback}
              />
            ) : (
              <div className="text-xl sm:text-2xl mb-1">{match.awayFlag || ""}</div>
            )}
            <div
              className={`text-[11px] sm:text-sm font-semibold text-white truncate px-0.5 ${match.awayTeamId ? "group-hover:text-indigo-300 transition-colors" : ""}`}
            >
              {tTeamName(match.awayTeam)}
            </div>
          </div>
        </div>

        {/* Deadline indicator — solo casos relevantes */}
        {user && !isLive && !isFinished && !phaseLocked && (
          <>
            {isPast && (
              <div className="mt-1.5 sm:mt-2 text-center">
                <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
                  <Lock size={9} /> Predicciones cerradas
                </span>
              </div>
            )}
            {!isPast && minutesUntilLockout <= 60 && (
              <div className="mt-1.5 sm:mt-2 text-center">
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/80">
                  <Clock size={9} /> Cierra en {minutesUntilLockout} min
                </span>
              </div>
            )}
          </>
        )}

        {existingPrediction && (
          <div className="mt-1 sm:mt-1.5 text-center">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-green-400/70">
              <Check size={10} /> Guardado ({existingPrediction.homeGoals ?? "?"}-
              {existingPrediction.awayGoals ?? "?"})
              {existingPrediction.isJoker && (
                <span className="ml-1 text-amber-400">x2</span>
              )}
              {existingPrediction.pointsEarned > 0 && (
                <span className="ml-1 text-amber-400">
                  +{existingPrediction.pointsEarned} pts
                </span>
              )}
            </span>
          </div>
        )}

        {canOpenGroupPredictions && (
          <div className="mt-3 pt-3 border-t border-white/5 flex justify-center">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowGroupPredictions(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 cursor-pointer"
            >
              <Users size={12} /> Ver predicciones de grupos
            </button>
          </div>
        )}

        {user && phaseLocked && match.predictionWindow?.reason && (
          <div className="mt-2 rounded-lg border border-sky-400/15 bg-sky-400/10 px-2.5 py-2 text-center text-[10px] sm:text-xs text-sky-100/75">
            {match.predictionWindow.reason}
          </div>
        )}
      </div>

      {user && !isPast && hasChanges && (
        <div className="px-3 sm:px-4 pb-2.5 sm:pb-3">
          <m.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(event) => {
              event.stopPropagation();
              handleSave();
            }}
            disabled={saving}
            className="w-full py-1.5 sm:py-2 rounded-xl text-white font-medium text-[11px] sm:text-xs transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer border-none"
            style={{
              background: saving
                ? "#6366f1"
                : "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
            }}
          >
            {saving ? "Guardando..." : "Guardar resultado"}
          </m.button>
        </div>
      )}

      <GroupPredictionsModal
        isOpen={showGroupPredictions}
        onClose={() => setShowGroupPredictions(false)}
        groups={availableGroupPredictionGroups}
        match={match}
      />
    </m.div>
  );
});
