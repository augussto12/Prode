import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Loader2, Trophy, Users } from "lucide-react";
import api from "../../services/api";
import GroupPredictionsModal from "./GroupPredictionsModal";
import { tRound, tTeamName } from "../../utils/translations";
import {
  canViewGroupPredictions,
  getGroupPredictionsAvailabilityLabel,
} from "../../utils/groupPredictionVisibility";

function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateFromKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDayTitle(dateKey) {
  const date = getDateFromKey(dateKey);
  if (!date) return "Selecciona un dia";

  const todayKey = getLocalDateKey();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const label = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (dateKey === todayKey) return `Hoy, ${label}`;
  if (dateKey === getLocalDateKey(tomorrow)) return `Manana, ${label}`;
  if (dateKey === getLocalDateKey(yesterday)) return `Ayer, ${label}`;
  return label;
}

function getNeighborDate(dateKeys, selectedDateKey, direction) {
  if (direction < 0) {
    for (let i = dateKeys.length - 1; i >= 0; i -= 1) {
      if (dateKeys[i] < selectedDateKey) return dateKeys[i];
    }
    return null;
  }

  for (let i = 0; i < dateKeys.length; i += 1) {
    if (dateKeys[i] > selectedDateKey) return dateKeys[i];
  }
  return null;
}

export default function GroupMatches({ groupId, groupName, competitionId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    if (competitionId) {
      setSelectedDateKey(getLocalDateKey());
      loadMatches();
    }
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

      normalized.sort((a, b) => new Date(a.date) - new Date(b.date));
      setMatches(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const formatMatchTime = (dateStr) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isFinished = (match) => match.status === "FINISHED";
  const isLive = (match) => match.status === "LIVE";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    );
  }

  const availableDateKeys = Array.from(
    new Set(matches.map((match) => getLocalDateKey(match.date)).filter(Boolean)),
  ).sort();
  const selectedDayMatches = matches.filter(
    (match) => getLocalDateKey(match.date) === selectedDateKey,
  );
  const previousDateKey = getNeighborDate(availableDateKeys, selectedDateKey, -1);
  const nextDateKey = getNeighborDate(availableDateKeys, selectedDateKey, 1);
  const selectedDayLabel = formatDayTitle(selectedDateKey);

  const goToDate = (dateKey) => {
    if (dateKey) setSelectedDateKey(dateKey);
  };

  const goToToday = () => {
    setSelectedDateKey(getLocalDateKey());
  };

  const renderMatchButton = (match) => {
    const canViewPredictions = canViewGroupPredictions(match);
    const availabilityLabel = getGroupPredictionsAvailabilityLabel(match);
    const matchTime = formatMatchTime(match.date);

    return (
      <button
        key={match.id}
        onClick={() => canViewPredictions && setSelectedMatch(match)}
        disabled={!canViewPredictions}
        className={`w-full text-left glass-card rounded-xl p-3 sm:p-4 max-[250px]:p-2.5 transition-all border border-white/5 ${
          canViewPredictions
            ? "hover:bg-white/[0.08] hover:border-white/15 cursor-pointer"
            : "opacity-70 cursor-not-allowed"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[10px] font-semibold text-white/45">
            {tRound(match.round)}
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 max-[250px]:grid-cols-1 max-[250px]:gap-2">
          <div className="flex items-center gap-2 min-w-0 max-[250px]:rounded-lg max-[250px]:bg-white/[0.03] max-[250px]:px-2 max-[250px]:py-1.5">
            <img
              src={match.homeLogo || "/placeholder-team.svg"}
              alt=""
              className="w-6 h-6 sm:w-8 sm:h-8 max-[250px]:w-5 max-[250px]:h-5 object-contain shrink-0"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.src = "/placeholder-team.svg";
              }}
            />
            <span className="text-sm font-semibold text-white truncate">
              {tTeamName(match.homeTeam)}
            </span>
          </div>

          <div className="shrink-0 text-center px-2 max-[250px]:px-0 max-[250px]:order-3">
            {isFinished(match) || isLive(match) ? (
              <div className="text-base font-bold text-white sm:text-lg max-[360px]:text-sm max-[250px]:text-xs">
                {match.homeGoals ?? 0} - {match.awayGoals ?? 0}
              </div>
            ) : (
              <div className="inline-flex items-center justify-center rounded-lg bg-white/[0.045] px-1.5 py-1 text-[11px] font-bold text-white/55 sm:px-2 sm:text-xs max-[360px]:text-[10px] max-[250px]:text-[11px]">
                {matchTime || formatDate(match.date).split(", ")[1]}
              </div>
            )}
            {isLive(match) && (
              <div className="text-[10px] text-red-400 font-bold animate-pulse">
                {match.elapsed}'
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 justify-end max-[250px]:justify-start max-[250px]:rounded-lg max-[250px]:bg-white/[0.03] max-[250px]:px-2 max-[250px]:py-1.5">
            <span className="text-sm font-semibold text-white truncate max-[250px]:order-2">
              {tTeamName(match.awayTeam)}
            </span>
            <img
              src={match.awayLogo || "/placeholder-team.svg"}
              alt=""
              className="w-6 h-6 sm:w-8 sm:h-8 max-[250px]:w-5 max-[250px]:h-5 object-contain shrink-0 max-[250px]:order-1"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.src = "/placeholder-team.svg";
              }}
            />
          </div>
        </div>

        <div className="mt-2 flex min-w-0 items-center justify-end border-t border-white/5 pt-2 max-[250px]:justify-start">
          <span
            className={`inline-flex min-w-0 items-center gap-1 text-[10px] ${
              canViewPredictions ? "text-indigo-400" : "text-white/25"
            }`}
          >
            <Users size={10} className="shrink-0" />
            <span className="truncate">{availabilityLabel}</span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl border border-white/5 p-2.5 sm:p-3 max-[250px]:p-2">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 max-[250px]:grid-cols-[2rem_minmax(0,1fr)_2rem] max-[250px]:gap-1">
          <button
            type="button"
            onClick={() => goToDate(previousDateKey)}
            disabled={!previousDateKey}
            aria-label="Dia anterior con partidos"
            className="h-9 w-9 max-[250px]:h-8 max-[250px]:w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-white/5 cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft size={17} />
          </button>

          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs max-[250px]:text-[10px] font-bold uppercase tracking-wider text-white/45">
              <Calendar size={13} className="max-[250px]:hidden" />
              <span className="max-[250px]:hidden">Partidos por dia</span>
              <span className="hidden max-[250px]:inline">Dia</span>
            </div>
            <div className="mt-0.5 truncate text-sm sm:text-base max-[250px]:text-[13px] font-bold text-white">
              {selectedDayLabel}
            </div>
            <div className="mt-0.5 text-[10px] sm:text-xs text-white/45">
              {selectedDayMatches.length} partido{selectedDayMatches.length !== 1 ? "s" : ""}
            </div>
          </div>

          <button
            type="button"
            onClick={() => goToDate(nextDateKey)}
            disabled={!nextDateKey}
            aria-label="Dia siguiente con partidos"
            className="h-9 w-9 max-[250px]:h-8 max-[250px]:w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-white/5 cursor-pointer disabled:cursor-default"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 max-[250px]:grid max-[250px]:grid-cols-1">
          <input
            type="date"
            value={selectedDateKey}
            onChange={(event) => setSelectedDateKey(event.target.value)}
            className="min-w-0 rounded-lg border border-white/10 bg-black/15 px-2.5 py-1.5 text-xs text-white/75 focus:border-indigo-500 focus:outline-none max-[250px]:w-full"
          />
          <button
            type="button"
            onClick={goToToday}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer max-[250px]:w-full ${
              selectedDateKey === getLocalDateKey()
                ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            Hoy
          </button>
        </div>
      </div>

      {selectedDayMatches.length > 0 ? (
        <div className="space-y-2">
          {selectedDayMatches.map(renderMatchButton)}
        </div>
      ) : matches.length > 0 ? (
        <div className="text-center py-10 text-white/45 glass-card rounded-xl border border-white/5">
          <Calendar size={30} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-semibold text-white/65">
            No hay partidos este dia
          </p>
          <p className="mt-1 text-xs text-white/40">
            Usa las flechas para ir al dia con partidos mas cercano.
          </p>
        </div>
      ) : (
        <div className="text-center py-12 text-white/40">
          <Trophy size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay partidos programados</p>
        </div>
      )}

      <GroupPredictionsModal
        isOpen={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
        groupId={groupId}
        groupName={groupName}
        match={selectedMatch}
      />
    </div>
  );
}

