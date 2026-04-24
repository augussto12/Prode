/**
 * SmFixtureDetail — Detalle completo de partido Sportmonks
 * Tabs: Alineación | Estadísticas | Cronología
 * Sub-toggle: Equipo Local / Visitante (muestra formación individual)
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Users,
  BarChart3,
  Timer,
} from "lucide-react";
import useSportmonksStore from "../../store/useSportmonksStore";
import { getSocket } from "../../lib/socket";
import * as smService from "../../services/sportmonks.service";
import LineupPlayer from "./LineupPlayer";

// ═══════ TEAM STAT TYPE IDS ═══════
const TEAM_STAT = {
  POSSESSION: 45,          // BALL_POSSESSION ✅
  SHOTS_TOTAL: 42,          // SHOTS_TOTAL (1677 es solo season-level)
  SHOTS_ON_TARGET: 86,     // ✅
  CORNERS: 34,             // ✅
  FOULS: 56,               // FOULS (era 54 inexistente)
  OFFSIDES: 51,            // ✅
  PASSES: 80,              // ✅
  ACCURATE_PASSES: 81,     // SUCCESSFUL_PASSES (116 es player-level, 81 es team fixture-level)
  DANGEROUS_ATTACKS: 44,   // DANGEROUS_ATTACKS (era 84=YELLOWCARDS!)
  SAVES: 57,               // SAVES (era 52=GOALS!)
  YELLOWS: 84,             // YELLOWCARDS (era 57=SAVES!)
  REDS: 83,                // REDCARDS (era 58=SHOTS_BLOCKED!)
};

// ═══════ EVENT TYPE IDS ═══════
const EV = {
  GOAL: 14,
  OWN_GOAL: 15,
  PEN_SCORED: 16,
  PEN_MISSED: 17,
  SUB: 18,
  YELLOW: 19,
  RED: 20,
  SECOND_YELLOW: 21,
  VAR: 10,
  PEN_SHOOTOUT_MISS: 22,
  PEN_SHOOTOUT_GOAL: 23,
};

const TABS = [
  { id: "lineup", label: "Alineación", shortLabel: "Aline.", icon: Users },
  { id: "stats", label: "Estadísticas", shortLabel: "Stats", icon: BarChart3 },
  { id: "timeline", label: "Cronología", shortLabel: "Crono.", icon: Timer },
  { id: "h2h", label: "H2H", shortLabel: "H2H", icon: MapPin },
];

// ═══════ MAIN ═══════
export default function SmFixtureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    selectedFixture,
    loading,
    error,
    fetchFixture,
    fetchPlayerStats,
    updateFixture,
    clearSelectedFixture,
  } = useSportmonksStore();

  const [activeTab, setActiveTab] = useState("lineup");
  const [activeTeam, setActiveTeam] = useState("home"); // 'home' | 'away'
  const [flash, setFlash] = useState(false);
  const prevScore = useRef(null);

  // Lazy Loaded Data
  const [tabData, setTabData] = useState({
    lineups: null,
    statistics: null,
    events: null,
    h2h: null,
  });
  const [loadingTab, setLoadingTab] = useState(false);

  useEffect(() => {
    fetchFixture(id);
    fetchPlayerStats(id);
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit("join_match", id);
    socket.on("match:update", (data) => {
      if (
        String(data.externalId) === String(id) ||
        String(data.id) === String(id)
      ) {
        updateFixture(data);
        const total = (data.homeScore ?? 0) + (data.awayScore ?? 0);
        if (prevScore.current !== null && total > prevScore.current) {
          setFlash(true);
          setTimeout(() => setFlash(false), 1500);
        }
        prevScore.current = total;
      }
    });
    return () => {
      socket.emit("leave_match", id);
      socket.off("match:update");
      clearSelectedFixture();
    };
  }, [id]);

  useEffect(() => {
    if (selectedFixture) {
      const t =
        (selectedFixture.homeScore ?? 0) + (selectedFixture.awayScore ?? 0);
      if (prevScore.current === null) prevScore.current = t;
    }
  }, [selectedFixture?.homeScore, selectedFixture?.awayScore]);

  // Lazy Loading de Tabs
  useEffect(() => {
    if (!selectedFixture || !id) return;

    const fetchTab = async () => {
      try {
        if (activeTab === "lineup" && !tabData.lineups) {
          setLoadingTab(true);
          const res = await smService.fetchFixtureLineups(id);
          setTabData((prev) => ({ ...prev, lineups: res }));
        } else if (activeTab === "stats" && !tabData.statistics) {
          setLoadingTab(true);
          const res = await smService.fetchFixtureStatistics(id);
          setTabData((prev) => ({ ...prev, statistics: res }));
        } else if (activeTab === "timeline" && !tabData.events) {
          setLoadingTab(true);
          const res = await smService.fetchFixtureEvents(id);
          setTabData((prev) => ({ ...prev, events: res }));
        } else if (activeTab === "h2h" && !tabData.h2h) {
          setLoadingTab(true);
          const res = await smService.fetchFixtureH2H(selectedFixture.homeTeamId, selectedFixture.awayTeamId);
          setTabData((prev) => ({ ...prev, h2h: res }));
        }
      } catch (e) {
        console.error("[LazyLoad] Error fetching tab:", activeTab, e);
      } finally {
        setLoadingTab(false);
      }
    };
    fetchTab();
  }, [activeTab, selectedFixture?.id, selectedFixture?.homeTeamId, selectedFixture?.awayTeamId, id]);

  if (loading) return <Skeleton />;
  if (error || !selectedFixture)
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-white/60">{error || "Partido no encontrado"}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-indigo-400 hover:text-indigo-300 bg-transparent border-none cursor-pointer text-sm"
        >
          ← Volver
        </button>
      </div>
    );

  const fix = selectedFixture;
  const isLive = fix.isLive || fix.status === "live";
  const isFinished = fix.status === "finished";

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10 px-3 md:px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white cursor-pointer bg-transparent border-none transition-all"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      <Header fix={fix} isLive={isLive} isFinished={isFinished} flash={flash} />

      {/* Goal Flash */}
      <AnimatePresence>
        {flash && (
          <m.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="text-6xl md:text-8xl font-black text-emerald-400 drop-shadow-[0_0_60px_rgba(34,197,94,0.5)]">
              ⚽ GOL
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-0.5 sm:gap-1 bg-white/5 rounded-xl p-0.5 sm:p-1 border border-white/5 overflow-x-auto scrollbar-hide">
        {TABS.filter((tab) => {
          // If match hasn't started, only show 'lineup' tab
          if (
            !isLive &&
            !isFinished &&
            (tab.id === "stats" || tab.id === "timeline")
          ) {
            return false;
          }
          return true;
        }).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none whitespace-nowrap min-w-0 ${active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-transparent text-white/60 hover:text-white/60"}`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "lineup" && (
          <m.div
            key="lineup"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {loadingTab && !tabData.lineups ? (
              <div className="w-full h-[500px] md:h-[600px] bg-white/5 rounded-2xl animate-pulse mt-4" />
            ) : (
              <FormationView
                fix={{ ...fix, lineups: tabData.lineups || fix.lineups }}
                activeTeam={activeTeam}
                setActiveTeam={setActiveTeam}
              />
            )}
          </m.div>
        )}
        {activeTab === "stats" && (
          <m.div
            key="stats"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {loadingTab && !tabData.statistics ? (
              <div className="w-full h-[400px] bg-white/5 rounded-2xl animate-pulse mt-4" />
            ) : (
              <TeamStats fix={{ ...fix, statistics: tabData.statistics || fix.statistics }} />
            )}
          </m.div>
        )}
        {activeTab === "timeline" && (
          <m.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {loadingTab && !tabData.events ? (
              <div className="w-full h-[400px] bg-white/5 rounded-2xl animate-pulse mt-4" />
            ) : (
              <EventsTimeline fix={{ ...fix, events: tabData.events || fix.events }} />
            )}
          </m.div>
        )}
        {activeTab === "h2h" && (
          <m.div
            key="h2h"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {loadingTab && !tabData.h2h ? (
              <div className="w-full h-[300px] bg-white/5 rounded-2xl animate-pulse mt-4" />
            ) : (
              <H2hView h2h={tabData.h2h || []} fix={fix} />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════
// H2H VIEW
// ═══════════════════════════════════════
function H2hView({ h2h, fix }) {
  if (!h2h || h2h.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center text-white/60 bg-white/5 border border-white/5 mt-4">
        <MapPin size={24} className="mx-auto mb-3 text-white/40" />
        <p className="text-sm">No hay historial reciente disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4">
      <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-widest pl-2 mb-3">
        Últimos Encuentros
      </h3>
      {h2h.map((h, i) => {
        const hName = h.participants?.find(p => p.meta.location === 'home')?.name || "Local";
        const aName = h.participants?.find(p => p.meta.location === 'away')?.name || "Visitante";
        const hScore = h.scores?.find(s => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals ?? "-";
        const aScore = h.scores?.find(s => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals ?? "-";

        const date = new Date(h.starting_at).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });

        return (
          <m.div
            key={h.id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between p-3 md:p-4 rounded-xl bg-white/5 border border-white/5"
          >
            <div className="text-[10px] text-white/40 w-16 md:w-24 shrink-0 font-medium whitespace-nowrap">
              {date}
            </div>
            <div className="flex-1 flex items-center justify-end gap-2 text-right">
              <span className={`text-xs md:text-sm font-bold truncate max-w-[80px] md:max-w-none ${hScore > aScore ? "text-white" : "text-white/60"}`}>
                {hName}
              </span>
            </div>
            <div className="flex items-center justify-center min-w-[50px] md:min-w-[60px] mx-2 gap-1.5 font-black text-sm bg-black/20 py-1.5 px-3 rounded-lg border border-white/5">
              <span>{hScore}</span>
              <span className="opacity-30">-</span>
              <span>{aScore}</span>
            </div>
            <div className="flex-1 flex items-center justify-start gap-2 text-left">
              <span className={`text-xs md:text-sm font-bold truncate max-w-[80px] md:max-w-none ${aScore > hScore ? "text-white" : "text-white/60"}`}>
                {aName}
              </span>
            </div>
          </m.div>
        );
      })}
    </div>
  );
}// ═══════════════════════════════════════
// HEADER
// ═══════════════════════════════════════
function Header({ fix, isLive, isFinished, flash }) {
  return (
    <div
      className={`rounded-2xl p-5 md:p-6 relative overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/90 backdrop-blur border ${isLive ? "border-red-500/30" : "border-white/10"}`}
    >
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-pulse" />
      )}

      {/* Scoreboard */}
      <div className="flex items-center justify-between">
        <TeamBadge
          name={fix.homeTeamName}
          logo={fix.homeTeamLogo}
          id={fix.homeTeamId}
        />

        <div className="text-center px-4">
          {/* Status badge */}
          <div className="mb-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-[10px] text-red-400 font-bold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{" "}
                {fix.elapsed ? `${fix.elapsed}'` : "EN VIVO"}
              </span>
            ) : isFinished ? (
              <span className="px-3 py-0.5 bg-white/10 text-white/60 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/5">
                Final
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-white/60 text-[10px] border border-white/5">
                <Clock size={10} />
                {fix.startTime
                  ? new Date(fix.startTime).toLocaleString("es-AR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "—"}
              </span>
            )}
          </div>

          {/* Score */}
          <m.div
            animate={flash ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-black text-white tracking-tight"
          >
            {fix.homeScore ?? "-"}
            <span className="text-white/40 mx-2 font-light">-</span>
            {fix.awayScore ?? "-"}
          </m.div>

          {/* League */}
          {fix.leagueName && (
            <div className="mt-2 text-[10px] text-white/50 font-medium">
              {fix.leagueName}
              {fix.round ? ` · ${fix.round}` : ""}
            </div>
          )}
        </div>

        <TeamBadge
          name={fix.awayTeamName}
          logo={fix.awayTeamLogo}
          id={fix.awayTeamId}
        />
      </div>

      {fix.venueName && (
        <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 mt-3">
          <MapPin size={10} /> {fix.venueName}
        </div>
      )}
    </div>
  );
}

function TeamBadge({ name, logo, id }) {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col items-center text-center flex-1 cursor-pointer hover:scale-105 transition-all group"
      onClick={() => id && navigate(`/sm-equipo/${id}`)}
    >
      {logo && (
        <img src={logo}
          alt=""
          className="w-10 h-10 md:w-14 md:h-14 object-contain mb-1.5 drop-shadow-lg"
          loading="lazy" decoding="async" width={40} height={40} />
      )}
      <div className="text-xs md:text-sm font-bold text-white leading-tight max-w-[90px] md:max-w-[140px] group-hover:text-indigo-400 transition-colors">
        {name || "—"}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// FORMATION VIEW (Toggle + Pitch)
// ═══════════════════════════════════════
function FormationView({ fix, activeTeam, setActiveTeam }) {
  const lineups = fix.lineups || [];
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Enrich with ratings from details and cards/goals from events
  const isFinished = fix.status === "finished";
  const enriched = useMemo(
    () =>
      lineups.map((lp) => {
        const ratingDetail = isFinished
          ? (lp.details || []).find((d) => d.type_id === 118)
          : null;

        // Only use event-based enrichment if events are actually loaded
        const hasEvents = fix.events && fix.events.length > 0;
        let safeDetails;

        if (hasEvents) {
          // Extract reliable stats from events (since lineups.details drops them sometimes)
          const pEvs = fix.events.filter(
            (e) => e.player_id === lp.player_id,
          );
          const goals = pEvs.filter((e) => e.type_id === 14).length;
          const yellows = pEvs.filter(
            (e) => e.type_id === 19 || e.type_id === 21,
          ).length;
          const reds = pEvs.filter(
            (e) => e.type_id === 20 || e.type_id === 21,
          ).length;

          // Filter out old unreliable instances directly from details to prevent duplicates
          safeDetails = (lp.details || []).filter(
            (d) => ![52, 84, 83].includes(d.type_id),
          );
          if (goals > 0) safeDetails.push({ type_id: 52, value: goals });
          if (yellows > 0) safeDetails.push({ type_id: 84, value: yellows });
          if (reds > 0) safeDetails.push({ type_id: 83, value: reds });
        } else {
          // No events loaded — keep original details intact
          safeDetails = lp.details || [];
        }

        return {
          playerId: lp.player_id,
          teamId: lp.team_id,
          playerName: lp.player_name,
          jerseyNumber: lp.jersey_number,
          formationField: lp.formation_field,
          typeId: lp.type_id,
          positionId: lp.position_id,
          rating: ratingDetail?.data?.value ?? null,
          imagePath: lp.player?.image_path,
          details: safeDetails, // passed to modal
        };
      }),
    [lineups, isFinished, fix.events],
  );

  const homeId = fix.homeTeamId;
  const awayId = fix.awayTeamId;

  const homePlayers = enriched.filter((p) => p.teamId === homeId);
  const awayPlayers = enriched.filter((p) => p.teamId === awayId);

  const homeStarters = homePlayers.filter((p) => p.formationField);
  const homeSubs = homePlayers.filter((p) => !p.formationField);
  const awayStarters = awayPlayers.filter((p) => p.formationField);
  const awaySubs = awayPlayers.filter((p) => !p.formationField);

  const currentStarters = activeTeam === "home" ? homeStarters : awayStarters;
  const currentSubs = activeTeam === "home" ? homeSubs : awaySubs;
  const currentName =
    activeTeam === "home" ? fix.homeTeamName : fix.awayTeamName;
  const currentLogo =
    activeTeam === "home" ? fix.homeTeamLogo : fix.awayTeamLogo;

  // Detect formation string (e.g. "4-3-3")
  const formationStr = useMemo(() => {
    if (currentStarters.length === 0) return "";
    const rows = {};
    currentStarters.forEach((p) => {
      const row = parseInt(p.formationField?.split(":")[0] || "0");
      if (row > 1) rows[row] = (rows[row] || 0) + 1; // skip GK row
    });
    return Object.keys(rows)
      .sort((a, b) => a - b)
      .map((k) => rows[k])
      .join("-");
  }, [currentStarters]);

  if (lineups.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center text-white/60 bg-white/5 border border-white/5">
        <Users size={24} className="mx-auto mb-3 text-white/40" />
        <p className="text-sm">Alineaciones no disponibles</p>
        <p className="text-xs text-white/40 mt-1">
          Se cargan cuando comienza el partido
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Team Toggle */}
      <div className="flex gap-2">
        <TeamToggleBtn
          active={activeTeam === "home"}
          onClick={() => setActiveTeam("home")}
          name={fix.homeTeamName}
          logo={fix.homeTeamLogo}
        />
        <TeamToggleBtn
          active={activeTeam === "away"}
          onClick={() => setActiveTeam("away")}
          name={fix.awayTeamName}
          logo={fix.awayTeamLogo}
        />
      </div>

      {/* Pitch */}
      <AnimatePresence mode="wait">
        <m.div
          key={activeTeam}
          initial={{ opacity: 0, x: activeTeam === "home" ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: activeTeam === "home" ? 20 : -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Formation title */}
          <div className="flex items-center justify-center gap-2 mb-2">
            {currentLogo && (
              <img src={currentLogo}
                alt=""
                className="w-4 h-4 object-contain"
                loading="lazy" decoding="async" width={16} height={16} />
            )}
            <span className="text-xs font-bold text-white/60">
              {currentName} — Formación {formationStr || "?"}
            </span>
          </div>

          <Pitch
            starters={currentStarters}
            isAway={activeTeam === "away"}
            onPlayerClick={setSelectedPlayer}
          />
        </m.div>
      </AnimatePresence>

      {/* Subs */}
      {currentSubs.length > 0 && (
        <div className="rounded-xl p-3 bg-white/5 border border-white/5">
          <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">
            Suplentes
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {currentSubs.map((p, i) => (
              <div
                key={p.playerId || i}
                className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 text-[10px] cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => {
                  // Extract stats from details (subs who entered HAVE stats)
                  const PLAYER_STAT_TYPES = { 118: "Rating", 52: "Goles", 79: "Asistencias", 119: "Minutos", 84: "Amarillas", 83: "Rojas", 86: "Tiros al arco", 78: "Entradas", 116: "Pases precisos", 57: "Atajadas", 100: "Intercepciones", 106: "Duelos ganados" };
                  let stats = null;
                  if (p.details?.length > 0) {
                    stats = [];
                    for (const d of p.details) {
                      const label = PLAYER_STAT_TYPES[d.type_id];
                      if (!label) continue;
                      let value = d.data?.value ?? d.value;
                      if (value == null) continue;
                      if (typeof value === 'object' && value.total !== undefined) value = value.total;
                      if (typeof value === 'object') continue;
                      if (value === 0 && d.type_id !== 118 && d.type_id !== 119) continue;
                      stats.push({ label, value, typeId: d.type_id });
                    }
                    if (stats.length === 0) stats = null;
                  }
                  setSelectedPlayer({
                    playerId: p.player_id || p.playerId,
                    name: p.playerName,
                    number: p.jerseyNumber,
                    rating: p.rating ? parseFloat(p.rating) : 0,
                    imagePath: p.imagePath,
                    stats,
                    isSub: true,
                  });
                }}
              >
                <span className="text-white/50 font-mono font-bold">
                  {p.jerseyNumber}
                </span>
                <span className="text-white/60 font-medium">
                  {p.playerName}
                </span>
                {p.rating > 0 && (
                  <span
                    className={`font-bold ${p.rating >= 7 ? "text-green-400" : p.rating >= 6 ? "text-amber-400" : "text-red-400"}`}
                  >
                    {parseFloat(p.rating).toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Stats Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <PlayerStatsModal
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TeamToggleBtn({ active, onClick, name, logo }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${active
        ? "bg-indigo-600/20 border-indigo-500/40 text-white shadow-lg shadow-indigo-500/10"
        : "bg-white/5 border-white/5 text-white/60 hover:text-white/60 hover:bg-white/8"
        }`}
    >
      {logo && <img src={logo} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" width={20} height={20} />}
      <span className="truncate max-w-[100px]">{name || "—"}</span>
    </button>
  );
}

// ═══════════════════════════════════════
// PITCH (Single team formation)
// ═══════════════════════════════════════
function Pitch({ starters, isAway, onPlayerClick }) {
  // Group players by row
  const rows = useMemo(() => {
    const map = {};
    starters.forEach((p) => {
      if (!p.formationField) return;
      const [row, col] = p.formationField.split(":").map(Number);
      if (!map[row]) map[row] = [];
      map[row].push({ ...p, _col: col });
    });
    // Sort each row by col
    Object.values(map).forEach((arr) => arr.sort((a, b) => a._col - b._col));
    return map;
  }, [starters]);

  const rowKeys = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);
  // Always render highest row (attackers) at the top, row 1 (GK) at the bottom
  const orderedRows = [...rowKeys].reverse();

  return (
    <div
      className="rounded-2xl overflow-hidden relative w-full aspect-[4/5] sm:aspect-auto"
      style={{
        background:
          "linear-gradient(180deg, #14532d 0%, #166534 20%, #15803d 50%, #166534 80%, #14532d 100%)",
        minHeight: "500px",
      }}
    >
      {/* Pitch markings */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Horizontal stripes */}
        {[20, 40, 60, 80].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 h-px bg-white/6"
            style={{ top: `${pct}%` }}
          />
        ))}
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 md:w-40 md:h-40 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/15" />
        {/* Penalty area top */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-44 md:w-64 h-16 md:h-24 border-b border-l border-r border-white/10 rounded-b-sm" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 md:w-36 h-6 md:h-10 border-b border-l border-r border-white/8 rounded-b-sm" />
        {/* Penalty area bottom */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-44 md:w-64 h-16 md:h-24 border-t border-l border-r border-white/10 rounded-t-sm" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-24 md:w-36 h-6 md:h-10 border-t border-l border-r border-white/8 rounded-t-sm" />
      </div>

      {/* Players grid */}
      <div className="absolute inset-0 flex flex-col justify-between py-6 md:py-10">
        {orderedRows.map((rowKey, ri) => {
          const players = rows[rowKey];
          return (
            <div
              key={rowKey}
              className="flex justify-evenly items-center w-full px-2 md:px-12"
            >
              {players.map((p, pi) => (
                <LineupPlayer
                  key={p.playerId || pi}
                  player={p}
                  index={ri * 4 + pi}
                  onPlayerClick={onPlayerClick}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// TEAM STATISTICS
// ═══════════════════════════════════════
function TeamStats({ fix }) {
  const stats = fix.statistics || [];
  if (stats.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center text-white/60 bg-white/5 border border-white/5">
        <BarChart3 size={24} className="mx-auto mb-3 text-white/40" />
        <p className="text-sm">Estadísticas no disponibles</p>
      </div>
    );
  }

  const statMap = {};
  for (const s of stats) {
    if (!statMap[s.type_id]) statMap[s.type_id] = {};
    statMap[s.type_id][s.location] = s.data?.value ?? 0;
  }
  const g = (id, side) => statMap[id]?.[side] ?? 0;

  const ROWS = [
    { label: "Posesión", id: TEAM_STAT.POSSESSION, suffix: "%", isPct: true },
    { label: "Tiros al arco", id: TEAM_STAT.SHOTS_ON_TARGET },
    { label: "Tiros totales", id: TEAM_STAT.SHOTS_TOTAL },
    { label: "Pases", id: TEAM_STAT.PASSES },
    { label: "Pases precisos", id: TEAM_STAT.ACCURATE_PASSES },
    { label: "Córners", id: TEAM_STAT.CORNERS },
    { label: "Faltas", id: TEAM_STAT.FOULS },
    { label: "Offsides", id: TEAM_STAT.OFFSIDES },
    { label: "Atajadas", id: TEAM_STAT.SAVES },
    { label: "Ataques peligrosos", id: TEAM_STAT.DANGEROUS_ATTACKS },
    { label: "Amarillas", id: TEAM_STAT.YELLOWS },
    { label: "Rojas", id: TEAM_STAT.REDS },
  ].filter((r) => statMap[r.id]);

  return (
    <div className="rounded-2xl p-4 bg-white/5 border border-white/5 space-y-0.5">
      <div className="flex justify-between items-center text-[10px] font-bold text-white/60 uppercase tracking-widest pb-2 border-b border-white/5">
        <span className="w-14 text-center">
          {fix.homeTeamName?.split(" ").pop()}
        </span>
        <span className="flex-1 text-center">Estadísticas</span>
        <span className="w-14 text-center">
          {fix.awayTeamName?.split(" ").pop()}
        </span>
      </div>
      {ROWS.map((r, i) => {
        const h = g(r.id, "home"),
          a = g(r.id, "away");
        const tot = h + a || 1;
        const hp = r.isPct ? h : (h / tot) * 100;
        const ap = r.isPct ? a : (a / tot) * 100;
        const hWins = hp > ap;
        return (
          <m.div
            key={r.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="py-1.5"
          >
            <div className="flex justify-between items-center mb-1">
              <span
                className={`text-xs font-bold w-8 text-left ${hWins ? "text-indigo-400" : "text-white/50"}`}
              >
                {h}
                {r.suffix || ""}
              </span>
              <span className="text-[9px] text-white/35 uppercase tracking-wider font-medium flex-1 text-center">
                {r.label}
              </span>
              <span
                className={`text-xs font-bold w-8 text-right ${!hWins ? "text-indigo-400" : "text-white/50"}`}
              >
                {a}
                {r.suffix || ""}
              </span>
            </div>
            <div className="flex gap-0.5 h-1.5">
              <div className="flex-1 bg-white/8 rounded-full overflow-hidden flex justify-end">
                <m.div
                  initial={{ width: 0 }}
                  animate={{ width: `${hp}%` }}
                  transition={{ duration: 0.5, delay: i * 0.02 }}
                  className={`h-full rounded-full ${hWins ? "bg-indigo-500" : "bg-white/15"}`}
                />
              </div>
              <div className="flex-1 bg-white/8 rounded-full overflow-hidden">
                <m.div
                  initial={{ width: 0 }}
                  animate={{ width: `${ap}%` }}
                  transition={{ duration: 0.5, delay: i * 0.02 }}
                  className={`h-full rounded-full ${!hWins ? "bg-indigo-500" : "bg-white/15"}`}
                />
              </div>
            </div>
          </m.div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// EVENTS TIMELINE
// ═══════════════════════════════════════
function EventsTimeline({ fix }) {
  const events = fix.events || [];
  if (events.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center text-white/60 bg-white/5 border border-white/5">
        <Timer size={24} className="mx-auto mb-3 text-white/40" />
        <p className="text-sm">Sin eventos registrados</p>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => (a.minute || 0) - (b.minute || 0));

  return (
    <div className="rounded-2xl p-4 bg-white/5 border border-white/5">
      <div className="space-y-0.5">
        {sorted.map((ev, i) => {
          const isHome =
            ev.teamId === fix.homeTeamId ||
            ev.participant_id === fix.homeTeamId;
          const icon = evIcon(ev.type_id || ev.type);
          const detail = evLabel(ev);

          return (
            <m.div
              key={ev.id || i}
              initial={{ opacity: 0, x: isHome ? -15 : 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.025 }}
              className={`flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-white/5 transition-colors ${isHome ? "" : "flex-row-reverse text-right"}`}
            >
              <span className="text-[10px] font-mono font-bold text-white/60 bg-white/5 px-1.5 py-0.5 rounded shrink-0 w-10 text-center">
                {ev.minute}'
                {ev.extra_minute || ev.extraMinute
                  ? `+${ev.extra_minute || ev.extraMinute}`
                  : ""}
              </span>
              <span className="text-base shrink-0">{icon}</span>
              <div className={`flex-1 min-w-0 ${isHome ? "" : "text-right"}`}>
                <div className="text-[11px] font-bold text-white truncate">
                  {ev.playerName || ev.player_name || "—"}
                </div>
                {detail && (
                  <div className="text-[9px] text-white/35 truncate">
                    {detail}
                  </div>
                )}
                {(ev.assistName || ev.related_player_name) && (
                  <div className="text-[9px] text-white/40 truncate">
                    Asist: {ev.assistName || ev.related_player_name}
                  </div>
                )}
              </div>
            </m.div>
          );
        })}
      </div>
    </div>
  );
}

function evIcon(t) {
  if (typeof t === "number") {
    if (t === EV.GOAL || t === EV.PEN_SCORED) return "⚽";
    if (t === EV.OWN_GOAL) return "⚽";
    if (t === EV.PEN_MISSED) return "❌";
    if (t === EV.YELLOW) return "🟨";
    if (t === EV.SECOND_YELLOW) return "🟨🟥";
    if (t === EV.RED) return "🟥";
    if (t === EV.SUB) return "🔄";
    if (t === EV.VAR) return "📺";
  }
  const s = String(t || "");
  if (s === "goal") return "⚽";
  if (s === "card") return "🟨";
  if (s === "subst") return "🔄";
  return "📌";
}

function evLabel(ev) {
  const parts = [];
  if (ev.info) parts.push(ev.info);
  if (ev.addition) parts.push(ev.addition);
  if (!parts.length && ev.detail) parts.push(ev.detail);
  if (ev.result) parts.push(ev.result);
  return parts.join(" · ");
}

// ═══════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════
function Skeleton() {
  return (
    <div className="space-y-4 max-w-3xl mx-auto px-4 animate-pulse">
      <div className="h-6 w-16 bg-white/10 rounded" />
      <div className="rounded-2xl p-6 bg-white/5">
        <div className="flex items-center justify-center gap-6">
          <div className="w-14 h-14 rounded-full bg-white/10" />
          <div className="w-24 h-12 bg-white/10 rounded-lg" />
          <div className="w-14 h-14 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="flex gap-1 h-10 bg-white/5 rounded-xl" />
      <div className="rounded-2xl h-80 bg-white/5" />
    </div>
  );
}

// ═══════════════════════════════════════
// PLAYER STATS MODAL
// ═══════════════════════════════════════
function PlayerStatsModal({ player, onClose }) {
  const ratingStyle =
    !player.rating || player.rating === 0
      ? "text-white/60"
      : player.rating >= 8.5
        ? "text-emerald-400"
        : player.rating >= 7.0
          ? "text-green-400"
          : player.rating >= 6.0
            ? "text-amber-400"
            : "text-red-400";

  return (
    <>
      {/* Backdrop */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      {/* Modal */}
      <m.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
      >
        <div className="bg-[#0f1520] border-t border-white/10 rounded-t-3xl p-6 space-y-4 shadow-2xl">
          {/* Handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-1" />

          {/* Player Header */}
          <div className="flex items-center gap-4">
            {player.imagePath ? (
              <img src={player.imagePath}
                alt=""
                className="w-16 h-16 rounded-full object-cover bg-slate-800 ring-2 ring-white/10"
                loading="lazy" decoding="async" width={64} height={64} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center ring-2 ring-white/10">
                <span className="text-2xl font-black text-white/50">
                  {player.number}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white truncate">
                {player.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-white/60">
                {player.number && (
                  <span className="bg-white/10 px-2 py-0.5 rounded font-bold">
                    #{player.number}
                  </span>
                )}
                {player.isSub && (
                  <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-bold">
                    Suplente
                  </span>
                )}
              </div>
            </div>
            {player.rating > 0 && (
              <div className="text-right">
                <span className={`text-3xl font-black ${ratingStyle}`}>
                  {player.rating.toFixed(1)}
                </span>
                <p className="text-[9px] text-white/50 uppercase tracking-widest">
                  Rating
                </p>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          {player.stats && player.stats.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {player.stats
                .filter((s) => s.typeId !== 118)
                .map((s, i) => (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between"
                  >
                    <span className="text-xs text-white/50">{s.label}</span>
                    <span className="text-sm font-bold text-white">
                      {typeof s.value === "number" ? s.value : s.value}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-4 text-white/50 text-sm bg-white/5 rounded-xl border border-white/5">
              {player.isSub
                ? "Sin datos de participación"
                : "Estadísticas no disponibles"}
            </div>
          )}

          {/* Close & Profile */}
          <div className="flex gap-2 w-full pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white/50 bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all"
            >
              Cerrar
            </button>
            <button
              onClick={() => {
                if (player.playerId) {
                  window.location.href = `/jugador/${player.playerId}?source=sportmonks`;
                }
              }}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 cursor-pointer transition-all border-none"
            >
              Ver Perfil Completo
            </button>
          </div>
        </div>
      </m.div>
    </>
  );
}
