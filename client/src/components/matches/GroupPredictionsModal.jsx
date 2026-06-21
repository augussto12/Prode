import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Users, X } from "lucide-react";
import api from "../../services/api";
import { tTeamName } from "../../utils/translations";

function getMatchId(match) {
  return match?.externalId || match?.id;
}

function getTeamLogo(match, side) {
  return match?.[`${side}TeamLogo`] || match?.[`${side}Logo`] || null;
}

function getUserInitial(user) {
  return String(user?.displayName || user?.username || "?").charAt(0).toUpperCase();
}

function getPredictionBadge(prediction, match) {
  if (!prediction) {
    return { label: "SIN PRONOSTICO", color: "text-white/50" };
  }

  if (!prediction.isCalculated) {
    return { label: "PENDIENTE", color: "text-amber-400/70" };
  }

  const predictedHome = Number(prediction.homeGoals);
  const predictedAway = Number(prediction.awayGoals);
  const matchHome = Number(match?.homeGoals);
  const matchAway = Number(match?.awayGoals);

  const isExact = predictedHome === matchHome && predictedAway === matchAway;
  const predictedResult =
    predictedHome > predictedAway ? "HOME" : predictedHome < predictedAway ? "AWAY" : "DRAW";
  const actualResult =
    matchHome > matchAway ? "HOME" : matchHome < matchAway ? "AWAY" : "DRAW";

  if (isExact) {
    return { label: "EXACTO", color: "text-emerald-400" };
  }

  if (predictedResult === actualResult) {
    return { label: "GANADOR", color: "text-blue-400" };
  }

  return { label: "FALLO", color: "text-red-400" };
}

export default function GroupPredictionsModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  groups = [],
  match,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupIndex, setGroupIndex] = useState(0);

  const modalGroups = useMemo(() => {
    const validGroups = Array.isArray(groups)
      ? groups.filter((group) => group?.id)
      : [];

    if (validGroups.length > 0) return validGroups;
    if (!groupId) return [];

    return [
      {
        id: groupId,
        name: groupName || "Predicciones del grupo",
      },
    ];
  }, [groupId, groupName, groups]);

  const groupsKey = modalGroups.map((group) => group.id).join("|");
  const currentGroup = modalGroups[groupIndex] || null;
  const matchId = getMatchId(match);

  useEffect(() => {
    if (!isOpen) return;

    const requestedIndex = groupId
      ? modalGroups.findIndex((group) => Number(group.id) === Number(groupId))
      : 0;

    setGroupIndex(requestedIndex >= 0 ? requestedIndex : 0);
  }, [groupId, groupsKey, isOpen, modalGroups]);

  useEffect(() => {
    if (groupIndex < modalGroups.length) return;
    setGroupIndex(Math.max(0, modalGroups.length - 1));
  }, [groupIndex, modalGroups.length]);

  useEffect(() => {
    if (!isOpen || !currentGroup?.id || !matchId) return;

    let ignore = false;
    setLoading(true);
    setData([]);

    api
      .get(`/groups/${currentGroup.id}/matches/${matchId}/predictions`)
      .then((res) => {
        if (!ignore) setData(res.data || []);
      })
      .catch((err) => {
        console.error("Error loading group predictions", err);
        if (!ignore) setData([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [currentGroup?.id, isOpen, matchId]);

  const moveGroup = (direction) => {
    setGroupIndex((prev) => {
      const next = prev + direction;
      return Math.min(Math.max(next, 0), modalGroups.length - 1);
    });
  };

  if (!isOpen) return null;

  const homeLogo = getTeamLogo(match, "home");
  const awayLogo = getTeamLogo(match, "away");
  const canGoPrevious = groupIndex > 0;
  const canGoNext = groupIndex < modalGroups.length - 1;

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-2.5 sm:p-4"
        onClick={(event) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <m.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="glass-card rounded-xl sm:rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[88vh] border border-white/10"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="p-3 sm:p-4 border-b border-white/10 bg-white/5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-0 top-0 z-10 h-8 w-8 grid place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>

              <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-1 pr-8">
                {modalGroups.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Grupo anterior"
                    onClick={() => moveGroup(-1)}
                    disabled={!canGoPrevious}
                    className="h-8 w-8 grid place-items-center rounded-full border border-white/10 bg-black/15 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-black/15 cursor-pointer disabled:cursor-default"
                  >
                    <ChevronLeft size={16} />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}

                <div className="min-w-0 text-center">
                  <h3 className="flex items-center justify-center gap-1.5 text-[13px] sm:text-sm font-bold leading-tight text-white">
                    <Users size={15} className="text-indigo-400 shrink-0" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {currentGroup?.name || "Predicciones del grupo"}
                    </span>
                  </h3>
                  {modalGroups.length > 1 && (
                    <div className="mt-0.5 text-[10px] font-bold text-white/40">
                      {groupIndex + 1}/{modalGroups.length}
                    </div>
                  )}
                </div>

                {modalGroups.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Grupo siguiente"
                    onClick={() => moveGroup(1)}
                    disabled={!canGoNext}
                    className="h-8 w-8 grid place-items-center rounded-full border border-white/10 bg-black/15 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-black/15 cursor-pointer disabled:cursor-default"
                  >
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>

              {match && (
                <div className="mt-3 rounded-xl border border-white/8 bg-black/15 px-2 py-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <div className="flex min-w-0 flex-col items-center gap-1">
                      {homeLogo && (
                        <img
                          src={homeLogo}
                          alt=""
                          className="h-4 w-5 object-contain"
                          loading="lazy"
                          decoding="async"
                          width={20}
                          height={16}
                          onError={(event) => {
                            event.currentTarget.src = "/placeholder-team.svg";
                          }}
                        />
                      )}
                      <span className="max-w-full text-center text-[10px] sm:text-xs font-semibold leading-tight text-white/80 [overflow-wrap:anywhere]">
                        {tTeamName(match.homeTeam)}
                      </span>
                    </div>

                    {match.status === "FINISHED" ||
                    match.status === "LIVE" ||
                    typeof match.homeGoals === "number" ? (
                      <span className="min-w-[48px] rounded-lg bg-white/10 px-2 py-1 text-center text-sm font-black text-white shadow-sm">
                        {match.homeGoals} - {match.awayGoals}
                      </span>
                    ) : (
                      <span className="min-w-[34px] text-center text-[10px] font-bold text-white/45">
                        vs
                      </span>
                    )}

                    <div className="flex min-w-0 flex-col items-center gap-1">
                      {awayLogo && (
                        <img
                          src={awayLogo}
                          alt=""
                          className="h-4 w-5 object-contain"
                          loading="lazy"
                          decoding="async"
                          width={20}
                          height={16}
                          onError={(event) => {
                            event.currentTarget.src = "/placeholder-team.svg";
                          }}
                        />
                      )}
                      <span className="max-w-full text-center text-[10px] sm:text-xs font-semibold leading-tight text-white/80 [overflow-wrap:anywhere]">
                        {tTeamName(match.awayTeam)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-2.5 sm:p-4 overflow-y-auto flex-1 space-y-2">
            {modalGroups.length === 0 ? (
              <div className="text-center p-6 text-white/60 text-sm">
                No hay grupos para este partido.
              </div>
            ) : loading ? (
              <div className="flex justify-center p-10">
                <Loader2 size={24} className="animate-spin text-white/60" />
              </div>
            ) : data.length === 0 ? (
              <div className="text-center p-6 text-white/60 text-sm">
                Nadie cargo pronostico en este partido.
              </div>
            ) : (
              data.map((item, idx) => {
                const { user, prediction } = item;
                const predictedHome =
                  prediction && prediction.homeGoals !== null
                    ? Number(prediction.homeGoals)
                    : null;
                const predictedAway =
                  prediction && prediction.awayGoals !== null
                    ? Number(prediction.awayGoals)
                    : null;
                const badge = getPredictionBadge(prediction, match);

                return (
                  <div
                    key={`${currentGroup?.id || "group"}-${user?.displayName || idx}-${idx}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover bg-white/10 shrink-0"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {getUserInitial(user)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-white truncate">
                          {user?.displayName || "Usuario"}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] sm:text-[10px] font-bold ${badge.color}`}>
                            {badge.label}
                          </span>
                          {prediction && prediction.pointsEarned > 0 && (
                            <span className="text-[9px] text-white/50">
                              +{prediction.pointsEarned}pts
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {prediction ? (
                        <div className="px-2 py-1 bg-black/30 rounded-lg text-xs sm:text-sm font-bold text-white border border-white/10 text-center min-w-[58px] shadow-inner inline-block">
                          {predictedHome} - {predictedAway}
                          {prediction.isJoker && (
                            <span className="ml-1 text-[9px] text-amber-400">x2</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-white/40 italic">-</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </m.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
