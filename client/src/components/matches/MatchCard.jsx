import { useState, useEffect, useRef, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { Star, Check, Lock } from "lucide-react";
import api from "../../services/api";
import useAuthStore from "../../store/authStore";
import useToastStore from "../../store/toastStore";

export default memo(function MatchCard({
  match,
  isFavorite,
  existingPrediction: existingProp,
  onPredictionSaved,
  hideStage = false,
  priority = false,
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
  const isSavingRef = useRef(false);

  const matchDate = new Date(match.matchDate);
  const isPast = matchDate <= new Date() || match.status !== "SCHEDULED";
  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FINISHED";

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

  const hasChanges = useMemo(() => {
    if (!existingPrediction) {
      return prediction.homeGoals !== "" || prediction.awayGoals !== "";
    }

    return (
      String(prediction.homeGoals) !== String(existingPrediction.homeGoals ?? "") ||
      String(prediction.awayGoals) !== String(existingPrediction.awayGoals ?? "") ||
      (prediction.isJoker || false) !== (existingPrediction.isJoker || false)
    );
  }, [prediction, existingPrediction]);

  const handleSave = async () => {
    if (isSavingRef.current) return;
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

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-xl sm:rounded-2xl overflow-hidden transition-all hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-secondary)_20%,transparent)] ${isFavorite ? "ring-1 ring-amber-400/30" : ""}`}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {!hideStage && match.stage && (
              <span className="text-[10px] sm:text-xs text-white/60 font-medium truncate">
                {match.stage
                  .replace(/Regular Season - /i, "Fecha ")
                  .replace(/Reg /i, "Fecha ")}
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
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user && (
              <button
                type="button"
                onClick={() =>
                  !isPast &&
                  setPrediction((prev) => ({ ...prev, isJoker: !prev.isJoker }))
                }
                disabled={isPast}
                className={`flex items-center justify-center px-1.5 py-0.5 rounded cursor-pointer transition-all border text-xs ${
                  prediction.isJoker
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title="Comodin x2: maximo 3 partidos por competencia"
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
            onClick={() => match.homeTeamId && navigate(`/equipo/${match.homeTeamId}`)}
          >
            {match.homeTeamLogo ? (
              <img
                src={match.homeTeamLogo}
                alt={match.homeTeam}
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
              {match.homeTeam}
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
                onClick={() => {
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
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={prediction.homeGoals}
                  onChange={(e) => setPrediction({ ...prediction, homeGoals: e.target.value })}
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
                  disabled={isPast}
                  placeholder="-"
                  className="w-7 h-8 sm:w-9 sm:h-9 text-center bg-white/10 border border-white/20 rounded-lg text-white font-bold text-sm sm:text-base focus:outline-none focus:border-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}
          </div>

          <div
            className={`flex-1 text-center min-w-0 ${match.awayTeamId ? "cursor-pointer group" : ""}`}
            onClick={() => match.awayTeamId && navigate(`/equipo/${match.awayTeamId}`)}
          >
            {match.awayTeamLogo ? (
              <img
                src={match.awayTeamLogo}
                alt={match.awayTeam}
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
              {match.awayTeam}
            </div>
          </div>
        </div>

        {existingPrediction && (
          <div className="mt-1.5 sm:mt-2 text-center">
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
      </div>

      {user && !isPast && hasChanges && (
        <div className="px-3 sm:px-4 pb-2.5 sm:pb-3">
          <m.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleSave}
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
    </m.div>
  );
});
