import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Trophy,
  Users,
  AlertCircle,
  CalendarDays,
  Activity,
  BarChart3,
} from "lucide-react";
import useSportmonksStore from "../../store/useSportmonksStore";
import TeamStatsView from "./TeamStatsView";

const TROPHY_MAP = {
  384: "Serie A",
  636: "Liga Profesional",
  642: "Copa Argentina",
  1122: "Copa Libertadores",
  1116: "Copa Sudamericana",
  1452: "Supercopa Argentina",
  1457: "Copa de la Liga Profesional",
  1658: "Trofeo de Campeones",
};

const TABS = [
  { id: "info", label: "Información", icon: Activity },
  { id: "stats", label: "Estadísticas", icon: BarChart3 },
  { id: "squad", label: "Plantel", icon: Users },
  { id: "matches", label: "Partidos", icon: CalendarDays },
  { id: "sidelined", label: "Enfermería", icon: AlertCircle },
];

export default function TeamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    selectedTeam: team,
    loading,
    error,
    fetchTeam,
    clearSelectedTeam,
  } = useSportmonksStore();
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    fetchTeam(id);
    return () => clearSelectedTeam();
  }, [id, fetchTeam, clearSelectedTeam]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-48 bg-white/5 rounded-3xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-12 bg-white/5 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="text-center py-20">
        <p className="text-white/60 mb-4">{error || "Equipo no encontrado"}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-indigo-400 hover:text-indigo-300"
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* HEADER DINÁMICO */}
      <div className="relative rounded-b-3xl md:rounded-3xl overflow-hidden mb-6 border-b md:border border-white/10 shadow-2xl" style={{ background: 'color-mix(in srgb, var(--bg-start-color, #0b101e) 90%, white)' }}>
        {/* Background Blur */}
        <div
          className="absolute inset-0 opacity-20 blur-3xl scale-125"
          style={{
            backgroundImage: `url(${team.image_path})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b101e] via-[#0b101e]/80 to-transparent" />

        <div className="relative p-6 md:p-10 pt-16 md:pt-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          <button
            onClick={() => navigate(-1)}
            aria-label="Volver atrás"
            className="absolute top-4 left-4 p-2 text-white/50 hover:text-white bg-black/20 rounded-full backdrop-blur-md transition-colors border-none cursor-pointer"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>

          <img
            src={team.image_path}
            alt={team.name}
            className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl"
            loading="lazy" decoding="async" width={128} height={128}
          />

          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight">
              {team.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4 text-xs md:text-sm text-white/60 font-medium">
              {team.country?.name && (
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  <img src={team.country.image_path}
                    alt={team.country.name}
                    className="w-4 h-4 rounded-full object-cover"
                    loading="lazy" decoding="async" width={16} height={16} />
                  {team.country.name}
                </span>
              )}
              {team.founded && (
                <span className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  Fundado en {team.founded}
                </span>
              )}
              {team.short_code && (
                <span className="bg-white/5 px-3 py-1 rounded-full border border-white/5 uppercase">
                  {team.short_code}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVEGACIÓN */}
      <div className="px-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap outline-none focus:outline-none ring-0 border-none cursor-pointer ${active
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="px-4">
        <AnimatePresence mode="wait">
          {/* TAB: INFO */}
          {activeTab === "info" && (
            <m.div
              key="info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid md:grid-cols-2 gap-6">
                {/* Estadio */}
                {team.venue && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
                    <img src={team.venue.image_path || team.image_path}
                      alt={team.venue.name}
                      className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700"
                      loading="lazy" decoding="async" />
                    <div className="relative z-20 p-6 h-full flex flex-col justify-end min-h-[220px]">
                      <div className="flex items-center gap-2 text-indigo-400 mb-1">
                        <MapPin size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                          Estadio Local
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1 shadow-black drop-shadow-md">
                        {team.venue.name}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-xs text-white/70">
                        {team.venue.capacity > 0 && (
                          <span className="bg-black/50 px-2 py-1 rounded backdrop-blur max-w-fit">
                            {team.venue.capacity.toLocaleString()} Espectadores
                          </span>
                        )}
                        {team.venue.city_name && (
                          <span className="bg-black/50 px-2 py-1 rounded backdrop-blur max-w-fit">
                            {team.venue.city_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Títulos */}
                {team.trophies && team.trophies.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-amber-400 mb-4">
                      <Trophy size={18} />
                      <h3 className="font-bold uppercase tracking-wider text-sm">
                        Palmarés Destacado
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(
                        team.trophies.reduce((acc, t) => {
                          const name =
                            TROPHY_MAP[t.league_id] || t.league?.name || `Torneo ${t.league_id}`;
                          if (!acc[name]) acc[name] = { count: 0, years: [] };
                          acc[name].count++;
                          const seasonName = t.season?.name
                            || team.seasons?.find((s) => s.id === t.season_id)?.name
                            || "N/A";
                          acc[name].years.push(seasonName);
                          return acc;
                        }, {}),
                      )
                        .sort((a, b) => b[1].count - a[1].count)
                        .slice(0, 8)
                        .map(([name, data], i) => (
                          <div
                            key={i}
                            className="flex flex-col bg-white/5 px-4 py-3 rounded-xl border border-white/5"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-bold text-white tracking-wide">
                                {name}
                              </span>
                              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 w-7 h-7 flex items-center justify-center rounded-full font-black text-xs shadow-md">
                                {data.count}
                              </span>
                            </div>
                            {data.years.length > 0 && (
                              <span className="text-[10px] text-white/60 leading-snug break-words">
                                {data.years
                                  .slice()
                                  .sort()
                                  .reverse()
                                  .join(" • ")}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </m.div>
          )}

          {/* TAB: ESTADÍSTICAS */}
          {activeTab === "stats" && (
            <m.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <TeamStatsView team={team} />
            </m.div>
          )}

          {/* TAB: PLANTEL */}
          {activeTab === "squad" && (
            <m.div
              key="squad"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {team.players?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {team.players.map((p) => {
                    const pl = p.player;
                    if (!pl) return null;
                    return (
                      <div
                        key={p.id}
                        className="bg-white/5 border border-white/5 flex flex-col items-center p-4 rounded-2xl hover:bg-white/10 transition-colors"
                      >
                        <div className="relative w-16 h-16 mb-3">
                          <img src={pl.image_path}
                            alt={pl.name}
                            className="w-full h-full rounded-full object-cover bg-slate-800"
                            loading="lazy" decoding="async" />
                          {p.jersey_number && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#121827]">
                              {p.jersey_number}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-white text-center leading-tight mb-1">
                          {pl.name}
                        </span>
                        <span className="text-[10px] text-white/60 uppercase tracking-widest">
                          {pl.date_of_birth
                            ? new Date().getFullYear() -
                            new Date(pl.date_of_birth).getFullYear() +
                            " años"
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-white/60 py-10">
                  Plantel no disponible.
                </p>
              )}
            </m.div>
          )}

          {/* TAB: PARTIDOS */}
          {activeTab === "matches" && (
            <m.div
              key="matches"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3 ml-1">
                  Últimos Resultados
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {team.latest?.length > 0 ? (
                    team.latest.map((match) => {
                      const isHome = match.meta?.location === "home";
                      const isLive = [2, 3, 4, 7, 9, 22].includes(
                        match.state_id,
                      ); // Estados vivos según Sportmonks

                      const scores = match.scores || [];
                      const homeG = scores.find(
                        (s) =>
                          (s.description === "CURRENT" ||
                            s.description === "FT") &&
                          s.score?.participant === "home",
                      )?.score?.goals;
                      const awayG = scores.find(
                        (s) =>
                          (s.description === "CURRENT" ||
                            s.description === "FT") &&
                          s.score?.participant === "away",
                      )?.score?.goals;
                      const resultText =
                        (homeG ?? "-") + " - " + (awayG ?? "-");

                      let resultBadge = "bg-white/10 text-white";
                      let badgeText = "—";

                      if (isLive) {
                        resultBadge =
                          "bg-red-500/20 text-red-500 border border-red-500/30 animate-pulse";
                        badgeText = "LIVE";
                      } else if (homeG !== undefined && awayG !== undefined) {
                        const teamG = isHome ? homeG : awayG;
                        const oppG = isHome ? awayG : homeG;
                        if (teamG > oppG) {
                          resultBadge =
                            "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                          badgeText = "V";
                        } else if (teamG < oppG) {
                          resultBadge =
                            "bg-red-500/20 text-red-400 border border-red-500/30";
                          badgeText = "D";
                        } else {
                          resultBadge =
                            "bg-amber-500/20 text-amber-400 border border-amber-500/30";
                          badgeText = "E";
                        }
                      }

                      return (
                        <div
                          key={match.id}
                          className="flex flex-col p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition"
                          onClick={() => navigate(`/sm-partido/${match.id}`)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] items-center flex gap-2 text-white/60">
                              {new Date(match.starting_at).toLocaleDateString(
                                "es-AR",
                                { day: "2-digit", month: "short" },
                              )}
                              {isLive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              )}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-black tracking-widest ${resultBadge}`}
                            >
                              {badgeText}
                            </span>
                          </div>
                          <div className="flex items-center justify-between font-bold text-sm">
                            <span className="truncate flex-1">
                              {match.name.split(" vs ")[0]}
                            </span>
                            <span className="mx-3 text-lg">{resultText}</span>
                            <span className="truncate flex-1 text-right">
                              {match.name.split(" vs ")[1]}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-white/50 p-4">
                      No hay resultados recientes.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3 ml-1">
                  Próximos Partidos
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {team.upcoming?.length > 0 ? (
                    team.upcoming.map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition"
                        onClick={() => navigate(`/sm-partido/${match.id}`)}
                      >
                        <div className="flex flex-col justify-center items-center mr-4 pr-4 border-r border-white/10 min-w-[70px]">
                          <span className="text-xs text-white/50">
                            {new Date(match.starting_at)
                              .toLocaleDateString("es-AR", { month: "short" })
                              .toUpperCase()}
                          </span>
                          <span className="text-xl font-black">
                            {new Date(match.starting_at).getDate()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <span className="block text-sm font-bold truncate">
                            {match.name}
                          </span>
                          <span className="text-xs text-white/60">
                            {new Date(match.starting_at).toLocaleTimeString(
                              "es-AR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}{" "}
                            hs
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/50 p-4">
                      No hay partidos próximos agendados.
                    </p>
                  )}
                </div>
              </div>
            </m.div>
          )}

          {/* TAB: ENFERMERÍA */}
          {activeTab === "sidelined" && (
            <m.div
              key="sidelined"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {team.sidelined?.filter((s) => !s.completed).length > 0 ? (
                <div className="space-y-3">
                  {team.sidelined
                    .filter((s) => !s.completed)
                    .map((s) => {
                      const pl = s.player;
                      if (!pl) return null;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-4 bg-red-950/20 border border-red-900/30 p-4 rounded-2xl"
                        >
                          <img src={pl.image_path}
                            alt={pl.name}
                            className="w-12 h-12 rounded-full object-cover bg-black/50"
                            loading="lazy" decoding="async" width={48} height={48} />
                          <div className="flex-1">
                            <h4 className="font-bold text-sm text-white">
                              {pl.name}
                            </h4>
                            <p className="text-xs text-red-400 capitalize">
                              {s.category}{" "}
                              {s.games_missed > 0
                                ? `(${s.games_missed} partidos fuera)`
                                : ""}
                            </p>
                          </div>
                          <div className="text-right text-[10px] text-white/60">
                            <span className="block border-b border-white/10 pb-1 mb-1">
                              Desde: {s.start_date}
                            </span>
                            <span className="block">
                              {s.end_date
                                ? `Hasta: ${s.end_date}`
                                : "Sin fecha de alta"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-20 bg-white/5 border border-white/5 rounded-3xl">
                  <AlertCircle
                    size={32}
                    className="mx-auto mb-3 text-emerald-400 opacity-50"
                  />
                  <p className="text-emerald-400 font-medium">
                    Plantel sano. No hay bajas reportadas.
                  </p>
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
