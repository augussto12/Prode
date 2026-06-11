import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import {
  Search,
  Trophy,
  Globe,
  ChevronDown,
  ChevronRight,
  MapPin,
  Loader2,
  Users,
  Calendar,
  Star,
  Maximize2,
  X,
  Pencil,
} from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import { tCountry, tRound, tTeamName } from "../utils/translations";
import { WORLD_CUP_2026_LOGO, getLeagueLogo, getLeagueName } from "../utils/worldCupLogo";
import { getGroupCardVariant } from "../utils/groupCardVariants";
import MatchCard from "../components/matches/MatchCard";

// Debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const COUNTRIES_PER_PAGE = 25;
const LARGE_MATCH_SECTION_THRESHOLD = 10;

// Helper: fecha de hoy en formato YYYY-MM-DD (hora local del browser)
const getTodayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Fecha en timezone Argentina (YYYY-MM-DD), para comparar matchDates que vienen en UTC
const getArgentinaDate = (date = new Date()) =>
  date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

// [OCULTADO] Sportmonks league IDs - Ya no se usa Sportmonks
// const SPORTMONKS_LEAGUES_SET = new Set(SPORTMONKS_LEAGUE_IDS);

export default function Explorer() {
  const [data, setData] = useState({ topLeagues: [], byCountry: [] });
  const [todayMatches, setTodayMatches] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wcMatches, setWcMatches] = useState([]);
  const [wcPredictions, setWcPredictions] = useState([]);
  const liveIntervalRef = useRef(null);
  // [OCULTADO] todayIntervalRef ya no se usa (era para Sportmonks)
  // const todayIntervalRef = useRef(null);

  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [visibleCountries, setVisibleCountries] = useState(COUNTRIES_PER_PAGE);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [leagueFavorites, setLeagueFavorites] = useState(new Set());

  const debouncedSearch = useDebounce(search, 250);

  // [OCULTADO] Sportmonks store — endpoint unificado
  // const smFixtures = useSportmonksStore((s) => s.smFixtures);
  // const smReady = useSportmonksStore((s) => s.ready);
  // const smLastFetchAt = useSportmonksStore((s) => s.lastFetchAt);
  // const fetchSmToday = useSportmonksStore((s) => s.fetchToday);

  useEffect(() => {
    const initLoad = async () => {
      await Promise.all([
        loadData(),
        loadMatchesByDate(selectedDate),
        loadWorldCupToday(),
        user ? loadMyGroups() : Promise.resolve(),
        user ? loadLeagueFavorites() : Promise.resolve()
      ]);

      setLoading(false);
    };

    initLoad();

    // Polling 1: refrescar live cada 30s (goles, minutos) solo si es hoy
    const liveInterval = setInterval(() => {
      if (selectedDate === getTodayDate()) {
        refreshLiveApiFootball();
      }
    }, 30000);

    // Polling 2: refrescar datos completos cada 60s para capturar partidos que terminaron
    const fullInterval = setInterval(() => {
      if (selectedDate === getTodayDate()) {
        loadMatchesByDate(selectedDate);
      }
    }, 60000);

    return () => {
      clearInterval(liveInterval);
      clearInterval(fullInterval);
    };
  }, [user?.id]);

  // Reload matches when selectedDate changes
  useEffect(() => {
    if (!loading) {
      loadMatchesByDate(selectedDate);
    }
  }, [selectedDate]);

  // Reset visible countries when search changes
  useEffect(() => {
    setVisibleCountries(COUNTRIES_PER_PAGE);
  }, [debouncedSearch]);

  const loadData = async () => {
    try {
      const { data: result } = await api.get(`/explorer/leagues?_=${Date.now()}`);
      console.log('[FRONTEND EXPLORER] /explorer/leagues response:', result);
      console.log('[FRONTEND EXPLORER] topLeagues count:', result.topLeagues?.length);
      console.log('[FRONTEND EXPLORER] byCountry count:', result.byCountry?.length);
      console.log('[FRONTEND EXPLORER] First topLeague IDs:', result.topLeagues?.slice(0, 3).map(l => ({ id: l.league?.id, name: l.league?.name })));
      console.log('[FRONTEND EXPLORER] First byCountry:', result.byCountry?.slice(0, 2).map(c => ({ country: c.country, leagueCount: c.leagues?.length, firstLeague: c.leagues?.[0]?.league?.name })));
      setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * api-football: Fetch matches by date + live (si es hoy), mergear (live gana).
   */
  const loadMatchesByDate = async (date) => {
    try {
      const isToday = date === getTodayDate();
      const requests = [
        api.get(`/explorer/fixtures/date/${date}?timezone=America/Argentina/Buenos_Aires`).catch(() => ({ data: [] })),
      ];

      // Si es hoy, también traer live
      if (isToday) {
        requests.push(api.get("/explorer/live").catch(() => ({ data: { total: 0, grouped: [] } })));
      }

      const [dateRes, liveRes] = await Promise.all(requests);

      console.log('[FRONTEND EXPLORER] fixtures/date response:', dateRes.data);
      console.log('[FRONTEND EXPLORER] fixtures/date count:', dateRes.data?.length);

      // Convertir array plano a formato grouped (igual que today/live)
      const dateFixtures = dateRes.data || [];
      const grouped = groupFixturesByLeague(dateFixtures);

      console.log('[FRONTEND EXPLORER] grouped leagues count:', grouped.length);
      console.log('[FRONTEND EXPLORER] grouped league names:', grouped.map(g => g.league?.name));

      const dateData = { total: dateFixtures.length, grouped };

      if (isToday && liveRes) {
        const live = liveRes.data || { total: 0, grouped: [] };
        const merged = mergeApiFootballData(dateData, live);
        setTodayMatches(merged);
      } else {
        setTodayMatches(dateData);
      }
    } catch (err) {
      /* silent */
    }
  };

  /**
   * Agrupa fixtures planos por liga (mismo formato que today/live).
   */
  function groupFixturesByLeague(fixtures) {
    const byLeague = {};
    fixtures.forEach((m) => {
      const key = m.league?.id;
      if (!key) return;
      if (!byLeague[key]) {
        byLeague[key] = {
          league: m.league,
          matches: [],
        };
      }
      byLeague[key].matches.push(m);
    });
    return Object.values(byLeague).sort((a, b) => {
      return getLeagueName(a.league).localeCompare(getLeagueName(b.league), "es");
    });
  }

  /**
   * Polling: solo refresca live y mergea con todayMatches existente.
   */
  const refreshLiveApiFootball = async () => {
    try {
      const { data: live } = await api.get("/explorer/live");
      setTodayMatches((prev) => {
        if (!prev) return prev;
        return mergeApiFootballData(prev, live || { total: 0, grouped: [] });
      });
    } catch (err) {
      /* silent */
    }
  };

  /**
   * Merge api-football: toma today como base, sobreescribe con live.
   */
  function mergeApiFootballData(today, live) {
    if (!live || live.total === 0) return today;

    const liveMap = new Map();
    (live.grouped || []).forEach((group) => {
      group.matches.forEach((m) => {
        liveMap.set(m.fixture.id, m);
      });
    });

    if (liveMap.size === 0) return today;

    return {
      ...today,
      grouped: today.grouped.map((group) => ({
        ...group,
        matches: group.matches.map((m) => {
          const liveVersion = liveMap.get(m.fixture.id);
          if (liveVersion) {
            return {
              ...m,
              fixture: liveVersion.fixture,
              goals: liveVersion.goals,
            };
          }
          return m;
        }),
      })),
    };
  }

  const loadMyGroups = async () => {
    try {
      const { data: groups } = await api.get("/groups");
      setMyGroups(groups || []);
    } catch (err) {
      console.error("Failed to load my groups", err);
    }
  };

  const loadLeagueFavorites = async () => {
    try {
      const { data } = await api.get("/auth/me/league-favorites");
      // API returns array of objects; extract leagueId as numbers
      setLeagueFavorites(new Set((data || []).map((f) => Number(f.leagueId))));
    } catch (err) {
      console.error("Failed to load league favorites", err);
    }
  };

  const loadWorldCupToday = async () => {
    try {
      const todayAR = getArgentinaDate();
      const [matchRes, predRes] = await Promise.all([
        api.get("/matches?competitionId=1"),
        user ? api.get("/predictions/my?competitionId=1") : Promise.resolve({ data: [] }),
      ]);
      const todayWcMatches = (matchRes.data || []).filter((m) => {
        if (!m.matchDate) return false;
        return getArgentinaDate(new Date(m.matchDate)) === todayAR;
      });
      setWcMatches(todayWcMatches);
      setWcPredictions(predRes.data || []);
    } catch {
      /* silent */
    }
  };

  const toggleLeagueFavorite = async (leagueId) => {
    if (!user) return;
    const isFav = leagueFavorites.has(leagueId);
    try {
      if (isFav) {
        await api.delete(`/auth/me/league-favorites/${leagueId}`);
        setLeagueFavorites((prev) => {
          const next = new Set(prev);
          next.delete(leagueId);
          return next;
        });
      } else {
        await api.post("/auth/me/league-favorites", { leagueId });
        setLeagueFavorites((prev) => new Set(prev).add(leagueId));
      }
    } catch (err) {
      console.error("Failed to toggle league favorite", err);
    }
  };

  // Memoized filtered results
  const filteredTopLeagues = useMemo(() => {
    if (debouncedSearch.length < 2) return data.topLeagues;
    const q = debouncedSearch.toLowerCase();
    return data.topLeagues.filter(
      (l) =>
        getLeagueName(l.league).toLowerCase().includes(q) ||
        tCountry(l.country?.name)?.toLowerCase().includes(q),
    );
  }, [data.topLeagues, debouncedSearch]);

  const filteredCountries = useMemo(() => {
    if (debouncedSearch.length < 2) return data.byCountry;
    const q = debouncedSearch.toLowerCase();
    return data.byCountry.filter(
      (c) =>
        tCountry(c.country).toLowerCase().includes(q) ||
        c.leagues.some((l) => getLeagueName(l.league).toLowerCase().includes(q)),
    );
  }, [data.byCountry, debouncedSearch]);

  const visibleCountryList = useMemo(
    () => filteredCountries.slice(0, visibleCountries),
    [filteredCountries, visibleCountries],
  );

  const filteredAllLeagues = useMemo(() => {
    if (debouncedSearch.length < 2) return [];
    const q = debouncedSearch.toLowerCase();
    const result = [];
    data.byCountry.forEach((c) => {
      c.leagues.forEach((l) => {
        if (
          getLeagueName(l.league).toLowerCase().includes(q) ||
          tCountry(c.country).toLowerCase().includes(q)
        ) {
          result.push({ ...l, countryObj: c });
        }
      });
    });
    return result;
  }, [data.byCountry, debouncedSearch]);

  const handleShowMore = useCallback(() => {
    setVisibleCountries((prev) => prev + COUNTRIES_PER_PAGE);
  }, []);

  const wcPredictionsMap = useMemo(
    () => new Map(wcPredictions.map((p) => [Number(p.externalFixtureId || p.matchId), p])),
    [wcPredictions]
  );

  const WC_JOKER_LIMIT = 3;
  const wcJokersUsed = useMemo(
    () => wcPredictions.filter((p) => p.isJoker).length,
    [wcPredictions]
  );
  const wcJokersRemaining = Math.max(0, WC_JOKER_LIMIT - wcJokersUsed);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-7 w-48 bg-white/10 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-white/5 rounded mt-2 animate-pulse" />
          </div>
          <div className="h-10 w-72 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="h-28 bg-gradient-to-r from-amber-900/20 to-amber-700/10 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-4 h-28 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
            <Globe size={20} className="text-indigo-400 shrink-0" /> Explorar Ligas
          </h1>
          <p className="text-white/50 text-xs sm:text-sm mt-1">
            Navega entre ligas, posiciones, goleadores y partidos en vivo
          </p>
        </div>
        <div className="relative z-40">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => {
              if (!search) setSearch("");
            }} // trigger render
            placeholder="Buscar liga o país..."
            className="pl-9 pr-4 py-2.5 w-full md:w-72 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white bg-transparent border-none cursor-pointer text-xs"
            >
              ✕
            </button>
          )}

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {debouncedSearch.length >= 2 &&
              (filteredTopLeagues.length > 0 ||
                filteredCountries.length > 0) && (
                <m.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full mt-2 left-0 w-full md:w-80 border border-white/10 shadow-2xl rounded-xl overflow-hidden max-h-80 overflow-y-auto z-50"
                  style={{ background: 'color-mix(in srgb, var(--bg-start-color, #1e1b4b) 95%, white)' }}
                >
                  {filteredAllLeagues.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] uppercase font-bold text-white/60 px-2 py-1">
                        🏆 Ligas y Copas
                      </div>
                      {filteredAllLeagues.slice(0, 6).map((l) => (
                        <Link
                          key={`all-${l.league.id}`}
                          to={`/liga/${l.league.id}`}
                          className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-colors no-underline"
                        >
                          {getLeagueLogo(l.league) ? (
                            <img
                              src={getLeagueLogo(l.league)}
                              className="w-5 h-5 object-contain"
                              width={20}
                              height={20}
                              loading="lazy"
                              decoding="async"
                              
  onError={(e) => {
                                e.target.src = "/placeholder-team.svg";
                              }}
                            />
                          ) : (
                            <Trophy size={14} className="text-white/50" />
                          )}
                          <div className="truncate">
                            <div className="text-sm font-medium text-white">
                              {getLeagueName(l.league)}
                            </div>
                            <div className="text-[10px] text-white/50">
                              {tCountry(l.countryObj?.country)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {filteredCountries.length > 0 && (
                    <div className="p-2 border-t border-white/5">
                      <div className="text-[10px] uppercase font-bold text-white/60 px-2 py-1">
                        🌍 Países ({filteredCountries.length})
                      </div>
                      {filteredCountries.slice(0, 10).map((c) => (
                        <button
                          key={`country-${c.country}`}
                          onClick={() => {
                            setExpandedCountry(c.country);
                            setSearch("");
                          }}
                          className="w-full flex items-center justify-between p-2 hover:bg-white/10 rounded-lg transition-colors border-none text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {c.flag ? (
                              <img
                                src={c.flag}
                                className="w-4 h-3 object-contain"
                                width={16}
                                height={12}
                                loading="lazy"
                                decoding="async"
                                
  onError={(e) => {
                                  e.target.src = "/placeholder-team.svg";
                                }}
                              />
                            ) : (
                              <MapPin size={12} className="text-white/50" />
                            )}
                            <span className="text-sm font-medium text-white">
                              {tCountry(c.country)}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/60">
                            {c.leagues.length} ligas
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </m.div>
              )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mundial Hoy — MatchCards interactivas */}
      {wcMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-white/90 flex items-center justify-center p-0.5 shrink-0">
                <img src={WORLD_CUP_2026_LOGO} alt="" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wide">
                <span className="sm:hidden">Hoy</span>
                <span className="hidden sm:inline">Hoy</span>
              </h2>
            </div>
            <Link to="/liga/1" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium no-underline flex items-center gap-1 shrink-0">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-amber-500/15 bg-amber-500/5 mb-3">
              <Pencil size={12} className="text-amber-400 shrink-0" />
              <p className="text-xs text-white/60">
                <span className="font-semibold text-white/80">Completá el marcador</span> de cada partido antes de que empiece.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wcMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                existingPrediction={wcPredictionsMap.get(Number(match.externalId || match.id))}
                onPredictionSaved={loadWorldCupToday}
                jokerRemaining={wcJokersRemaining}
                jokerLimit={WC_JOKER_LIMIT}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mis Grupos Carousel */}
      {user && myGroups.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Users size={14} /> Tus Prodes
            </h2>
            <Link
              to="/groups"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Ver todos
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/10">
            {myGroups.map((group, index) => {
              const variant = getGroupCardVariant(group, index);
              const competitionName = group.competition
                ? getLeagueName(group.competition)
                : "Torneo Activo";

              return (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  className="flex-shrink-0 w-56 sm:w-64 md:w-72 rounded-2xl p-4 no-underline transition-all hover:-translate-y-1 relative overflow-hidden group shadow-lg"
                  style={{
                    background: variant.background,
                    border: `1px solid ${variant.border}`,
                    boxShadow: variant.shadow,
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: variant.accent }} />
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-white">
                    <Trophy size={52} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center border backdrop-blur shrink-0"
                        style={{ background: variant.badge, borderColor: variant.border }}
                      >
                        <span className="text-base font-bold text-white">
                          {group.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{group.name}</h3>
                        <div className="text-xs text-white/60 truncate">{competitionName}</div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-white/15 flex items-center justify-between">
                      <span className="text-xs text-white/70 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.22)" }}>
                        Ver posiciones
                      </span>
                      <ChevronRight size={15} className="text-white/60 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Selector de Fecha + Partidos */}
      <div className="glass-card rounded-2xl p-4 border border-white/5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-sm font-bold text-white/50 uppercase tracking-wider">
              Partidos
            </span>
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <Calendar size={14} className="shrink-0 text-white/50" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition-all focus:border-indigo-500 focus:outline-none sm:w-[9.5rem] sm:flex-none"
            />
            <button
              onClick={() => setSelectedDate(getTodayDate())}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedDate === getTodayDate()
                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
              }`}
            >
              Hoy
            </button>
          </div>
        </div>
        {todayMatches?.total > 0 ? (
          <TodayMatchesRow
            data={todayMatches}
            leagueFavorites={leagueFavorites}
            onToggleFavorite={toggleLeagueFavorite}
            user={user}
            excludeLeagueId={wcMatches.length > 0 ? 1 : null}
          />
        ) : (
          <div className="text-center py-8 text-white/40 text-sm">
            No hay partidos programados para esta fecha
          </div>
        )}
      </div>

      {/* Top Leagues */}
      <div>
        <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
          Ligas Principales
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredTopLeagues
            .filter((l) => Number(l.league?.id) !== 1)
            .map((l) => (
              <Link
                key={l.league.id}
                to={`/liga/${l.league.id}`}
                className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 no-underline border-white/10 hover:border-white/30 hover:bg-white/[0.08] transition-all group shadow-md hover:shadow-xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {getLeagueLogo(l.league) ? (
                  <img
                    src={getLeagueLogo(l.league)}
                    alt={getLeagueName(l.league)}
                    loading="lazy"
                    decoding="async"
                    width={48}
                    height={48}
                    className="w-12 h-12 object-contain group-hover:scale-110 group-hover:-translate-y-1 transition-all z-10 drop-shadow-lg"
                    
  onError={(e) => {
                      e.target.src = "/placeholder-team.svg";
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center z-10">
                    <Trophy size={20} className="text-white/60" />
                  </div>
                )}
                <div className="text-center z-10 w-full mt-1">
                  <div className="text-xs font-bold text-white/90 truncate">
                    {getLeagueName(l.league)}
                  </div>
                  <div className="text-[9px] font-medium text-white/50 flex items-center justify-center gap-1 mt-1 uppercase tracking-wider">
                    {l.country?.flag && (
                      <img
                        src={l.country.flag}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={12}
                        height={8}
                        className="w-3 h-2 object-contain rounded-sm"
                        
  onError={(e) => {
                          e.target.src = "/placeholder-team.svg";
                        }}
                      />
                    )}
                    {tCountry(l.country?.name)}
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>

      {/* By Country */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
            Por País
          </h2>
          <span className="text-xs text-white/40">
            {filteredCountries.length} países
          </span>
        </div>
        <div className="space-y-1">
          {visibleCountryList.map((c) => (
            <CountryAccordion
              key={c.country}
              country={c}
              expanded={expandedCountry === c.country}
              onToggle={() =>
                setExpandedCountry(
                  expandedCountry === c.country ? null : c.country,
                )
              }
            />
          ))}
        </div>

        {/* Show more button */}
        {visibleCountries < filteredCountries.length && (
          <button
            onClick={handleShowMore}
            className="w-full mt-3 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all"
          >
            Mostrar más países ({filteredCountries.length - visibleCountries}{" "}
            restantes)
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Today Matches grouped by league ───
const TodayMatchesRow = ({ data, leagueFavorites, onToggleFavorite, user, excludeLeagueId = null }) => {
  const [collapsedLeagues, setCollapsedLeagues] = useState({});
  const [liveOnly, setLiveOnly] = useState(false);
  const [expandedLeague, setExpandedLeague] = useState(null);

  const LIVE_STATUSES = ["1H", "2H", "HT", "ET", "BT", "P"];
  const WORLD_CUP_ID = 1;

  const filteredGrouped = (data.grouped || []).filter((g) =>
    excludeLeagueId ? Number(g.league?.id) !== excludeLeagueId : true
  );

  useEffect(() => {
    if (!expandedLeague) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setExpandedLeague(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedLeague]);

  // Ordenar: Mundial primero, luego favoritos, luego el resto
  const sortedGroups = [...filteredGrouped].sort((a, b) => {
    const aId = Number(a.league?.id);
    const bId = Number(b.league?.id);
    const aIsWC = aId === WORLD_CUP_ID;
    const bIsWC = bId === WORLD_CUP_ID;
    const aIsFav = leagueFavorites?.has(aId);
    const bIsFav = leagueFavorites?.has(bId);

    if (aIsWC && !bIsWC) return -1;
    if (!aIsWC && bIsWC) return 1;
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    return 0;
  });

  // Count total live matches
  const liveCount = filteredGrouped.reduce(
    (acc, g) =>
      acc +
      g.matches.filter((m) => LIVE_STATUSES.includes(m.fixture.status.short))
        .length,
    0,
  );

  // Filter groups when liveOnly is active
  const displayGroups = liveOnly
    ? sortedGroups
        .map((g) => ({
          ...g,
          matches: g.matches.filter((m) =>
            LIVE_STATUSES.includes(m.fixture.status.short),
          ),
        }))
        .filter((g) => g.matches.length > 0)
    : sortedGroups;

  const totalCount = filteredGrouped.reduce((acc, g) => acc + g.matches.length, 0);

  if (totalCount === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white/50 uppercase tracking-wider">
            {totalCount} encuentros
          </span>
        </div>
        {liveCount > 0 && (
          <button
            onClick={() => setLiveOnly((prev) => !prev)}
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              liveOnly
                ? "bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white/60"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${liveOnly ? "bg-red-400 animate-pulse" : "bg-white/30"}`}
            />
            En Vivo ({liveCount})
          </button>
        )}
      </div>
      <div className="space-y-4">
        {displayGroups.map((group) => {
          const leagueId = Number(group.league?.id);
          const isCollapsed = collapsedLeagues[leagueId];
          const isWorldCup = leagueId === WORLD_CUP_ID;
          const isFav = leagueFavorites?.has(leagueId);
          const hasManyMatches = group.matches.length >= LARGE_MATCH_SECTION_THRESHOLD;
          return (
            <div
              key={leagueId}
              className={`rounded-xl overflow-hidden border ${
                isWorldCup
                  ? "border-amber-500/30 bg-amber-500/[0.03]"
                  : isFav
                    ? "border-indigo-500/20 bg-indigo-500/[0.02]"
                    : "border-white/5 bg-white/[0.02]"
              }`}
            >
              {/* Header de liga - Mejorado */}
              <button
                onClick={() =>
                  setCollapsedLeagues((prev) => ({
                    ...prev,
                    [leagueId]: !isCollapsed,
                  }))
                }
                className={`w-full flex items-center justify-between px-3 py-2.5 cursor-pointer group transition-colors ${
                  isWorldCup
                    ? "bg-amber-900/30 hover:bg-amber-800/40"
                    : "bg-indigo-950/30 hover:bg-indigo-900/40"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {getLeagueLogo(group.league) && (
                    <img
                      src={getLeagueLogo(group.league)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={24}
                      height={24}
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        e.target.src = "/placeholder-team.svg";
                      }}
                    />
                  )}
                  <span
                    className={`text-sm font-bold uppercase tracking-wider transition-colors ${
                      isWorldCup
                        ? "text-amber-400"
                        : "text-white/90 group-hover:text-indigo-300"
                    }`}
                  >
                    {getLeagueName(group.league)}
                  </span>
                  {isWorldCup && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                      MUNDIAL
                    </span>
                  )}
                  {group.league.flag && (
                    <img
                      src={group.league.flag}
                      alt=""
                      className="w-5 h-4 object-contain opacity-70"
                      loading="lazy"
                      decoding="async"
                      width={20}
                      height={16}
                      onError={(e) => {
                        e.target.src = "/placeholder-team.svg";
                      }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(leagueId);
                      }}
                      className={`p-1 rounded-lg transition-all cursor-pointer border-none bg-transparent ${
                        isFav
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-white/30 hover:text-white/60"
                      }`}
                      title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                    >
                      <Star size={14} className={isFav ? "fill-amber-400" : ""} />
                    </button>
                  )}
                  <span className="text-xs text-white/40 font-medium">
                    {group.matches.length} partido{group.matches.length !== 1 ? "s" : ""}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-white/50 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {hasManyMatches && (
                      <div className="flex justify-start sm:justify-end px-2 sm:px-3 pt-3 pb-2">
                        <button
                          type="button"
                          onClick={() => setExpandedLeague(group)}
                          className="inline-flex h-9 min-w-[96px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-white/5 px-3 text-sm sm:text-xs font-bold text-emerald-200 hover:bg-white/10 hover:text-emerald-100 transition-colors cursor-pointer"
                        >
                          <Maximize2 size={14} />
                          Ver más
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 px-1 after:content-[''] after:w-4 after:shrink-0">
                      {group.matches.map((m, mIndex) => {
                        const isLive = [
                          "1H",
                          "2H",
                          "HT",
                          "ET",
                          "BT",
                          "P",
                        ].includes(m.fixture.status.short);
                        const isPending = ["NS", "TBD"].includes(
                          m.fixture.status.short,
                        );

                        return (
                          <Link
                            key={m.fixture.id}
                            to={`/partido/${m.fixture.id}`}
                            className={`flex-shrink-0 bg-white/5 rounded-xl p-2.5 min-w-[220px] md:min-w-[240px] hover:bg-white/10 transition-all no-underline border flex flex-col justify-between overflow-hidden ${isLive ? "border-red-500/30 bg-red-500/5" : "border-transparent"}`}
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-[10px] font-medium text-white/50 border-b border-white/5 pb-1.5">
                                {isLive ? (
                                  <span className="text-red-400 animate-pulse font-bold flex items-center gap-1">
                                    ● {m.fixture.status.elapsed || 0}'
                                  </span>
                                ) : isPending ? (
                                  <span>
                                    {new Date(m.fixture.date)
                                      .toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      })
                                      .toLowerCase()}
                                  </span>
                                ) : (
                                  <span>{m.fixture.status.short}</span>
                                )}
                                {m.league?.round && (
                                  <span
                                    className="truncate max-w-[150px] text-right"
                                    title={m.league.round}
                                  >
                                    {tRound(m.league.round)}
                                  </span>
                                )}
                              </div>
                              {/* Teams and Score */}
                              <div className="flex items-center justify-between gap-2.5">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {m.teams?.home?.logo && (
                                <img
                                  src={m.teams.home.logo}
                                  alt=""
                                  loading={mIndex < 2 ? "eager" : "lazy"} fetchPriority={mIndex < 2 ? "high" : "auto"}
                                  decoding="async"
                                  width={20}
                                  height={20}
                                  className="w-5 h-5 object-contain"
                                  onError={(e) => {
                                    e.target.src = "/placeholder-team.svg";
                                  }}
                                />
                              )}
                              <span className="text-xs sm:text-[13px] text-white font-semibold truncate">
                                {tTeamName(m.teams?.home?.name)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white px-1 text-center w-6">
                              {!isPending ? (m.goals?.home ?? 0) : "-"}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  {m.teams?.away?.logo && (
                                    <img
                                      src={m.teams.away.logo}
                                      alt=""
                                      loading={mIndex < 2 ? "eager" : "lazy"} fetchPriority={mIndex < 2 ? "high" : "auto"}
                                      decoding="async"
                                      width={20}
                                      height={20}
                                      className="w-5 h-5 object-contain"
                                      onError={(e) => {
                                        e.target.src = "/placeholder-team.svg";
                                      }}
                                    />
                                  )}
                                  <span className="text-xs sm:text-[13px] text-white font-semibold truncate">
                                    {tTeamName(m.teams?.away?.name)}
                                  </span>
                                </div>
                                <div className="text-sm font-bold text-white px-1 text-center w-6">
                                  {!isPending ? (m.goals?.away ?? 0) : "-"}
                                </div>
                              </div>

                              {/* Cuotas ocultadas a petición del usuario */}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {expandedLeague && (
          <m.div
            className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setExpandedLeague(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
            />
            <m.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="expanded-league-title"
              className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl border border-white/10 bg-[#071b14] shadow-2xl"
              initial={{ scale: 0.96, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 18 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {getLeagueLogo(expandedLeague.league) && (
                    <img
                      src={getLeagueLogo(expandedLeague.league)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={28}
                      height={28}
                      className="w-7 h-7 object-contain"
                      onError={(e) => {
                        e.target.src = "/placeholder-team.svg";
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <h3
                      id="expanded-league-title"
                      className="text-base font-bold uppercase tracking-wider text-white truncate"
                    >
                      {getLeagueName(expandedLeague.league)}
                    </h3>
                    <p className="text-xs font-semibold text-white/45">
                      {expandedLeague.matches.length} partido
                      {expandedLeague.matches.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedLeague(null)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {expandedLeague.matches.map((match, matchIndex) => {
                    const status = match.fixture.status.short;
                    const isLive = LIVE_STATUSES.includes(status);
                    const isPending = ["NS", "TBD"].includes(status);

                    return (
                      <Link
                        key={match.fixture.id}
                        to={`/partido/${match.fixture.id}`}
                        onClick={() => setExpandedLeague(null)}
                        className={`bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-all no-underline border flex flex-col justify-between overflow-hidden min-h-[104px] ${
                          isLive ? "border-red-500/30 bg-red-500/5" : "border-transparent"
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[10px] font-medium text-white/50 border-b border-white/5 pb-1.5">
                            {isLive ? (
                              <span className="text-red-400 font-bold flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                                {match.fixture.status.elapsed || 0}'
                              </span>
                            ) : isPending ? (
                              <span>
                                {new Date(match.fixture.date)
                                  .toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                  .toLowerCase()}
                              </span>
                            ) : (
                              <span>{status}</span>
                            )}
                            {match.league?.round && (
                              <span
                                className="truncate max-w-[170px] text-right"
                                title={match.league.round}
                              >
                                {tRound(match.league.round)}
                              </span>
                            )}
                          </div>

                          {[match.teams?.home, match.teams?.away].map((team, teamIndex) => (
                            <div
                              key={`${match.fixture.id}-${teamIndex}`}
                              className="flex items-center justify-between gap-2.5"
                            >
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {team?.logo && (
                                  <img
                                    src={team.logo}
                                    alt=""
                                    loading={matchIndex < 4 ? "eager" : "lazy"}
                                    fetchPriority={matchIndex < 4 ? "high" : "auto"}
                                    decoding="async"
                                    width={22}
                                    height={22}
                                    className="w-5 h-5 object-contain"
                                    onError={(e) => {
                                      e.target.src = "/placeholder-team.svg";
                                    }}
                                  />
                                )}
                                <span className="text-sm text-white font-semibold truncate">
                                  {tTeamName(team?.name)}
                                </span>
                              </div>
                              <div className="text-sm font-bold text-white px-1 text-center w-7">
                                {!isPending
                                  ? (teamIndex === 0 ? match.goals?.home : match.goals?.away) ?? 0
                                  : "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Country Accordion (memoized, renders only when expanded) ───
function CountryAccordion({ country: c, expanded, onToggle }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-transparent border-none text-white cursor-pointer hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-3">
          {c.flag ? (
            <img
              src={c.flag}
              alt=""
              loading="lazy"
              decoding="async"
              width={24}
              height={16}
              className="w-6 h-4 object-contain rounded-sm"
              
  onError={(e) => {
                e.target.src = "/placeholder-team.svg";
              }}
            />
          ) : (
            <MapPin size={16} className="text-white/50" />
          )}
          <span className="text-sm font-medium">
            {c.translatedName || tCountry(c.country)}
          </span>
          <span className="text-xs text-white/50">
            {c.leagues.length} ligas
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {c.leagues.map((l) => (
                <Link
                  key={l.league.id}
                  to={`/liga/${l.league.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-all no-underline"
                >
                  {getLeagueLogo(l.league) ? (
                    <img
                      src={getLeagueLogo(l.league)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain"
                      
  onError={(e) => {
                        e.target.src = "/placeholder-team.svg";
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                      <Trophy size={14} className="text-white/50" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-white font-medium">
                      {getLeagueName(l.league)}
                    </div>
                    <div className="text-[10px] text-white/50">
                      {l.league.type === "Cup" ? "Copa" : "Liga"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sportmonks Matches grouped by league ───
const SmTodayMatchesRow = ({ fixtures }) => {
  const [collapsedLeagues, setCollapsedLeagues] = useState({});

  if (fixtures.length === 0) return null;

  // Group by leagueName
  const grouped = fixtures.reduce((acc, f) => {
    let group = acc.find((g) => g.leagueName === f.leagueName);
    if (!group) {
      group = { 
        leagueId: f.leagueId, 
        leagueName: f.leagueName, 
        matches: [] 
      };
      acc.push(group);
    }
    group.matches.push(f);
    return acc;
  }, []);

  const totalCount = fixtures.length;
  const liveCount = fixtures.filter(f => f.isLive || f.status === 'live').length;

  return (
    <m.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span className="text-sm font-bold text-white/50 uppercase tracking-wider">
            Sportmonks — {totalCount} partidos
          </span>
          {liveCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {liveCount} EN VIVO
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {grouped.map((group, index) => {
          const isCollapsed = collapsedLeagues[group.leagueId];

          return (
            <div
              key={group.leagueId || index}
              className="flex flex-col gap-1 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden"
            >
              <button
                onClick={() =>
                  setCollapsedLeagues((prev) => ({
                    ...prev,
                    [group.leagueId]: !prev[group.leagueId],
                  }))
                }
                className="w-full h-11 flex items-center justify-between px-2 bg-gradient-to-r from-white/[0.03] to-transparent hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center">
                    <Trophy size={12} className="text-white/40" />
                  </div>
                  <span className="text-sm text-white/90 font-bold uppercase tracking-wider transition-colors ml-1">
                    {group.leagueName === "World Cup" ? "Copa del Mundo 2026" : group.leagueName}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-white/50 mr-2 transition-transform duration-300 ${
                    isCollapsed ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 px-1 after:w-4 after:shrink-0">
                      {group.matches.map((f) => {
                        const isLive = f.isLive || f.status === "live";
                        const isFinished = f.status === "finished";
                        const isPending = !isLive && !isFinished;

                        return (
                          <Link
                            key={f.id}
                            to={`/sm-partido/${f.externalId || f.id}`}
                            className={`flex-shrink-0 bg-white/5 rounded-xl p-2.5 min-w-[220px] md:min-w-[240px] hover:bg-white/10 transition-all no-underline border flex flex-col justify-between overflow-hidden gap-2 ${
                              isLive ? "border-red-500/30 bg-red-500/5" : "border-transparent"
                            }`}
                          >
                            <div className="flex justify-between items-center text-[10px] font-medium text-white/50 border-b border-white/5 pb-1.5">
                              {isLive ? (
                                <span className="text-red-400 animate-pulse font-bold flex items-center gap-1">
                                  ● {f.elapsed ? `${f.elapsed}'` : "EN VIVO"}
                                </span>
                              ) : isPending ? (
                                <span>
                                  {f.startTime
                                    ? new Date(f.startTime).toLocaleTimeString(
                                        "es-AR",
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )
                                    : "TBD"}
                                </span>
                              ) : (
                                <span>FT</span>
                              )}
                              {f.round && (
                                <span className="truncate max-w-[130px] text-right">
                                  {tRound(f.round)}
                                </span>
                              )}
                            </div>

                            {/* Home */}
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {f.homeTeamLogo && (
                                  <img
                                    src={f.homeTeamLogo}
                                    alt=""
                                    className="w-5 h-5 object-contain"
                                    loading="lazy"
                                    decoding="async"
                                    width={20}
                                    height={20}
                                  />
                                )}
                                <span className="text-xs sm:text-[13px] text-white font-semibold truncate">
                                  {tTeamName(f.homeTeamName) || `ID:${f.homeTeamId}`}
                                </span>
                              </div>
                              <div className="text-sm font-bold text-white w-6 text-center">
                                {!isPending ? (f.homeScore ?? 0) : "-"}
                              </div>
                            </div>

                            {/* Away */}
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {f.awayTeamLogo && (
                                  <img
                                    src={f.awayTeamLogo}
                                    alt=""
                                    className="w-5 h-5 object-contain"
                                    loading="lazy"
                                    decoding="async"
                                    width={20}
                                    height={20}
                                  />
                                )}
                                <span className="text-xs sm:text-[13px] text-white font-semibold truncate">
                                  {tTeamName(f.awayTeamName) || `ID:${f.awayTeamId}`}
                                </span>
                              </div>
                              <div className="text-sm font-bold text-white w-6 text-center">
                                {!isPending ? (f.awayScore ?? 0) : "-"}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </m.div>
  );
};
