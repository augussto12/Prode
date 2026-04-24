import { useState, useEffect } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  ArrowRightLeft,
  BarChart3,
  Calendar,
} from "lucide-react";
import api from "../services/api";
import { tCountry } from "../utils/translations";

const TABS = [
  { id: "stats", label: "Estadísticas", icon: BarChart3 },
  { id: "trophies", label: "Trofeos", icon: Trophy },
  { id: "transfers", label: "Transferencias", icon: ArrowRightLeft },
];

export default function PlayerProfile() {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const source = searchParams.get("source");
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("stats");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayer();
  }, [id, source]);

  const loadPlayer = async () => {
    try {
      setLoading(true);
      const url = source ? `/explorer/players/${id}?source=${source}` : `/explorer/players/${id}`;
      const { data: result } = await api.get(url);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [tabData, setTabData] = useState({
    trophies: null,
    transfers: null,
  });
  const [loadingTab, setLoadingTab] = useState(false);

  useEffect(() => {
    const fetchTab = async () => {
      try {
        if (tab === "trophies" && !tabData.trophies) {
          setLoadingTab(true);
          const url = source ? `/explorer/players/${id}/trophies?source=${source}` : `/explorer/players/${id}/trophies`;
          const { data: res } = await api.get(url);
          setTabData(prev => ({ ...prev, trophies: res }));
        } else if (tab === "transfers" && !tabData.transfers) {
          setLoadingTab(true);
          const url = source ? `/explorer/players/${id}/transfers?source=${source}` : `/explorer/players/${id}/transfers`;
          const { data: res } = await api.get(url);
          setTabData(prev => ({ ...prev, transfers: res }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTab(false);
      }
    };
    fetchTab();
  }, [tab, id, source]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.stats) {
    return (
      <div className="text-center py-10 text-white/60">
        Jugador no encontrado
      </div>
    );
  }

  const player = data.stats.player;
  const allStats = data.stats.statistics || [];
  const trophies = tabData.trophies || [];
  const transfers = tabData.transfers || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white cursor-pointer bg-transparent border-none transition-all"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      {/* Player Header */}
      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-r from-indigo-600 to-purple-600" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 w-full">
          {player?.photo ? (
            <img
              src={player.photo}
              alt={player.name}
              width={112}
              height={112}
              className="w-28 h-28 rounded-2xl object-cover bg-white/10 border-2 border-white/20"
              loading="lazy"
              decoding="async"

              onError={(e) => {
                e.target.src = "/placeholder-team.svg";
              }}
            />
          ) : (
            <div className="w-28 h-28 rounded-2xl bg-white/10 flex items-center justify-center text-4xl font-bold text-white/50">
              {player?.name?.charAt(0)}
            </div>
          )}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-black text-white">
              {player?.firstname} {player?.lastname}
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
              <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary-light border border-primary/30">
                {player.detailedPosition || player.position || "Jugador"}
              </span>
              <span className="text-sm text-white/70">
                {tCountry(player.nationality)}
              </span>
              {player.age && (
                <span className="text-sm text-white/50">{player.age} años</span>
              )}
              {player.height && (
                <span className="text-sm text-white/50">{player.height}</span>
              )}
              {player.weight && (
                <span className="text-sm text-white/50">{player.weight}</span>
              )}
            </div>
            {player.birth?.date && (
              <div className="flex items-center justify-center md:justify-start gap-1.5 mt-3 text-xs text-white/60">
                <Calendar size={12} className="text-accent" />
                Nacido el{" "}
                {new Date(player.birth.date).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {player.birth.place &&
                  ` en ${player.birth.place}, ${player.birth.country}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full sm:w-fit overflow-x-auto hide-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border-none whitespace-nowrap shrink-0 flex-1 sm:flex-none ${tab === t.id
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/50 hover:text-white/70 bg-transparent"
              }`}
          >
            <t.icon size={14} className="sm:w-4 sm:h-4" />{" "}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className="space-y-4">
          {allStats.map((s, i) => (
            <m.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-2xl p-5"
            >
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                {s.team?.logo && (
                  <img
                    src={s.team.logo}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain"
                    loading="lazy"
                    decoding="async"

                    onError={(e) => {
                      e.target.src = "/placeholder-team.svg";
                    }}
                  />
                )}
                <div>
                  <div className="text-sm font-semibold text-white">
                    {s.team?.name}
                  </div>
                  <div className="text-xs text-white/60">
                    {s.league?.name} — {s.league?.season}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {[
                  { label: "Partidos", value: s.games?.appearences },
                  { label: "Titular", value: s.games?.lineups },
                  { label: "Minutos", value: s.games?.minutes },
                  {
                    label: "Goles",
                    value: s.goals?.total,
                    color: "text-emerald-400",
                  },
                  {
                    label: "Asistencias",
                    value: s.goals?.assists,
                    color: "text-blue-400",
                  },
                  { label: "Tiros al arco", value: s.shots?.on },
                  { label: "Regates", value: s.dribbles?.success },
                  { label: "Pases totales", value: s.passes?.total },
                  { label: "Pases clave", value: s.passes?.key, color: "text-accent" },
                  { label: "Duelos int.", value: s.duels?.total },
                  { label: "Duelos ganados", value: s.duels?.won, color: "text-primary" },
                  { label: "Entradas", value: s.tackles?.total },
                  { label: "Intercepciones", value: s.tackles?.interceptions },
                  { label: "Bloqueos", value: s.tackles?.blocks },
                  { label: "Faltas recibidas", value: s.fouls?.drawn, color: "text-emerald-400/80" },
                  { label: "Faltas cometidas", value: s.fouls?.committed, color: "text-red-400/80" },
                  {
                    label: "Amarillas",
                    value: s.cards?.yellow,
                    color: "text-yellow-400",
                  },
                  {
                    label: "Rojas",
                    value: s.cards?.red,
                    color: "text-red-500",
                  },
                ]
                  .filter((x) => x.value != null && x.value !== 0)
                  .map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-white/[0.03] rounded-xl p-3 text-center"
                    >
                      <div
                        className={`text-lg font-bold ${stat.color || "text-white"}`}
                      >
                        {stat.value}
                      </div>
                      <div className="text-[10px] text-white/60 mt-0.5">
                        {stat.label}
                      </div>
                    </div>
                  ))}
              </div>
            </m.div>
          ))}
        </div>
      )}

      {/* Trophies Tab */}
      {tab === "trophies" && (
        <div className="glass-card rounded-2xl p-5">
          {loadingTab && !tabData.trophies ? (
            <div className="w-full h-40 bg-white/5 rounded-2xl animate-pulse" />
          ) : trophies.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              Sin trofeos registrados
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {trophies.map((t, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.place === "Winner"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-white/5 text-white/40"
                      }`}
                  >
                    <Trophy size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {t.league}
                    </div>
                    <div className="text-xs text-white/60">
                      {t.country} — {t.season}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.place === "Winner"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-white/10 text-white/50"
                      }`}
                  >
                    {t.place === "Winner" ? "🏆 Campeón" : t.place}
                  </span>
                </m.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transfers Tab */}
      {tab === "transfers" && (
        <div className="glass-card rounded-2xl p-5">
          {loadingTab && !tabData.transfers ? (
            <div className="w-full h-80 bg-white/5 rounded-2xl animate-pulse" />
          ) : transfers.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              Sin transferencias registradas
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((t, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex flex-col gap-2.5 p-3 sm:p-4 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] sm:text-xs font-mono text-white/60 uppercase tracking-widest">
                      {t.date
                        ? new Date(t.date).toLocaleDateString("es-AR", {
                          month: "short",
                          year: "numeric",
                        })
                        : "Fecha Desc."}
                    </span>
                    <span
                      className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${t.type === "Free"
                          ? "text-green-400 bg-green-500/10 border border-green-500/20"
                          : t.type === "Loan"
                            ? "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                            : "text-white/60 bg-white/5 border border-white/10"
                        }`}
                    >
                      {t.type === "Free"
                        ? "Libre"
                        : t.type === "Loan"
                          ? "Préstamo"
                          : t.type || "Fichaje"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0 bg-white/5 p-2 rounded-lg border border-white/5">
                      {t.teams?.out?.logo ? (
                        <img
                          src={t.teams.out.logo}
                          alt=""
                          width={20}
                          height={20}
                          className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                          loading="lazy"
                          decoding="async"

                          onError={(e) => {
                            e.target.src = "/placeholder-team.svg";
                          }}
                        />
                      ) : (
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/10" />
                      )}
                      <span className="text-[10px] sm:text-xs text-white/60 truncate font-semibold">
                        {t.teams?.out?.name || "Desconocido"}
                      </span>
                    </div>
                    <ArrowRightLeft
                      size={14}
                      className="text-white/40 shrink-0"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0 bg-white/5 p-2 rounded-lg border border-white/5">
                      {t.teams?.in?.logo ? (
                        <img
                          src={t.teams.in.logo}
                          alt=""
                          width={20}
                          height={20}
                          className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                          loading="lazy"
                          decoding="async"

                          onError={(e) => {
                            e.target.src = "/placeholder-team.svg";
                          }}
                        />
                      ) : (
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/10" />
                      )}
                      <span className="text-[10px] sm:text-xs text-white truncate font-bold">
                        {t.teams?.in?.name || "Desconocido"}
                      </span>
                    </div>
                  </div>
                </m.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
