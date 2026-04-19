import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Search, Trophy, Globe, ChevronDown, ChevronRight, MapPin, Loader2, Users } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { tCountry } from '../utils/translations';
import AggregateScore from '../components/matches/AggregateScore';

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

export default function Explorer() {
  const [data, setData] = useState({ topLeagues: [], byCountry: [] });
  const [todayMatches, setTodayMatches] = useState(null);
  const [liveMatches, setLiveMatches] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingToday, setLoadingToday] = useState(true);
  const liveIntervalRef = useRef(null);
  const todayIntervalRef = useRef(null);

  const user = useAuthStore(state => state.user);
  const [search, setSearch] = useState('');
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [visibleCountries, setVisibleCountries] = useState(COUNTRIES_PER_PAGE);

  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    loadData();
    loadToday();
    loadLive(); // Primera carga inmediata de live
    if (user) {
      loadMyGroups();
    }

    // Polling live data cada 30s — siempre fresco (endpoint sin cache)
    liveIntervalRef.current = setInterval(loadLive, 30000);
    // Reload today cada 5 min para capturar nuevos partidos que arrancan/terminan
    todayIntervalRef.current = setInterval(loadToday, 300000);

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      if (todayIntervalRef.current) clearInterval(todayIntervalRef.current);
    };
  }, [user?.id]); // user?.id es estable, user como objeto cambia de referencia

  // Reset visible countries when search changes
  useEffect(() => {
    setVisibleCountries(COUNTRIES_PER_PAGE);
  }, [debouncedSearch]);

  const loadData = async () => {
    try {
      const { data: result } = await api.get('/explorer/leagues');
      setData(result);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadToday = async () => {
    try {
      const { data: today } = await api.get('/explorer/today');
      setTodayMatches(today || { total: 0, grouped: [] });
    } catch (err) { /* silent */ }
    finally { setLoadingToday(false); }
  };

  /** Fetch live matches (sin cache en el server) y mergear con todayMatches */
  const loadLive = async () => {
    try {
      const { data: live } = await api.get('/explorer/live');
      setLiveMatches(live || { total: 0, grouped: [] });
    } catch (err) { /* silent — live might have 0 matches */ }
  };

  /**
   * Merge: toma todayMatches como base y sobreescribe los scores/status
   * de cualquier partido que esté en liveMatches (datos frescos sin cache).
   * Esto garantiza que los cards siempre muestren el score en tiempo real.
   */
  const mergedTodayMatches = useMemo(() => {
    if (!todayMatches) return null;
    if (!liveMatches || liveMatches.total === 0) return todayMatches;

    // Build lookup map: fixtureId → live match data
    const liveMap = new Map();
    (liveMatches.grouped || []).forEach(group => {
      group.matches.forEach(m => {
        liveMap.set(m.fixture.id, m);
      });
    });

    if (liveMap.size === 0) return todayMatches;

    // Override today matches with live data (preserving odds from today)
    const merged = {
      ...todayMatches,
      grouped: todayMatches.grouped.map(group => ({
        ...group,
        matches: group.matches.map(m => {
          const live = liveMap.get(m.fixture.id);
          if (live) {
            return {
              ...m,
              fixture: live.fixture, // Fresh status + elapsed
              goals: live.goals,      // Fresh score
            };
          }
          return m;
        }),
      })),
    };

    return merged;
  }, [todayMatches, liveMatches]);

  const loadMyGroups = async () => {
    try {
      const { data: groups } = await api.get('/groups');
      setMyGroups(groups || []);
    } catch (err) { console.error('Failed to load my groups', err); }
  };

  // Memoized filtered results
  const filteredTopLeagues = useMemo(() => {
    if (debouncedSearch.length < 2) return data.topLeagues;
    const q = debouncedSearch.toLowerCase();
    return data.topLeagues.filter(l =>
      l.league.name.toLowerCase().includes(q) ||
      tCountry(l.country?.name)?.toLowerCase().includes(q)
    );
  }, [data.topLeagues, debouncedSearch]);

  const filteredCountries = useMemo(() => {
    if (debouncedSearch.length < 2) return data.byCountry;
    const q = debouncedSearch.toLowerCase();
    return data.byCountry.filter(c =>
      tCountry(c.country).toLowerCase().includes(q) ||
      c.leagues.some(l => l.league.name.toLowerCase().includes(q))
    );
  }, [data.byCountry, debouncedSearch]);

  const visibleCountryList = useMemo(() =>
    filteredCountries.slice(0, visibleCountries),
    [filteredCountries, visibleCountries]
  );

  const filteredAllLeagues = useMemo(() => {
    if (debouncedSearch.length < 2) return [];
    const q = debouncedSearch.toLowerCase();
    const result = [];
    data.byCountry.forEach(c => {
      c.leagues.forEach(l => {
        if (l.league.name.toLowerCase().includes(q) || tCountry(c.country).toLowerCase().includes(q)) {
          result.push({ ...l, countryObj: c });
        }
      });
    });
    return result;
  }, [data.byCountry, debouncedSearch]);

  const handleShowMore = useCallback(() => {
    setVisibleCountries(prev => prev + COUNTRIES_PER_PAGE);
  }, []);

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
            <div key={i} className="glass-card rounded-xl p-4 h-28 animate-pulse" />
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe size={24} className="text-indigo-400" /> Explorar Ligas
          </h1>
          <p className="text-white/50 text-sm mt-1">Navega entre ligas, posiciones, goleadores y partidos en vivo</p>
        </div>
        <div className="relative z-40">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => { if (!search) setSearch(''); }} // trigger render
            placeholder="Buscar liga o país..."
            className="pl-9 pr-4 py-2.5 w-full md:w-72 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white bg-transparent border-none cursor-pointer text-xs">✕</button>
          )}

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {debouncedSearch.length >= 2 && (filteredTopLeagues.length > 0 || filteredCountries.length > 0) && (
              <m.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-2 left-0 w-full md:w-80 bg-[#1e1b4b] border border-white/10 shadow-2xl rounded-xl overflow-hidden max-h-80 overflow-y-auto z-50"
              >
                {filteredAllLeagues.length > 0 && (
                  <div className="p-2">
                    <div className="text-[10px] uppercase font-bold text-white/40 px-2 py-1">🏆 Ligas y Copas</div>
                    {filteredAllLeagues.slice(0, 6).map(l => (
                      <Link key={`all-${l.league.id}`} to={`/liga/${l.league.id}`} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-colors no-underline">
                        {l.league.logo ? <img src={l.league.logo} className="w-5 h-5 object-contain" width={20} height={20} loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} /> : <Trophy size={14} className="text-white/30"/>}
                        <div className="truncate">
                          <div className="text-sm font-medium text-white">{l.league.name}</div>
                          <div className="text-[10px] text-white/50">{tCountry(l.countryObj?.country)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {filteredCountries.length > 0 && (
                  <div className="p-2 border-t border-white/5">
                    <div className="text-[10px] uppercase font-bold text-white/40 px-2 py-1">🌍 Países ({filteredCountries.length})</div>
                    {filteredCountries.slice(0, 10).map(c => (
                      <button key={`country-${c.country}`} onClick={() => { setExpandedCountry(c.country); setSearch(''); }} className="w-full flex items-center justify-between p-2 hover:bg-white/10 rounded-lg transition-colors border-none text-left cursor-pointer">
                        <div className="flex items-center gap-2">
                          {c.flag ? <img src={c.flag} className="w-4 h-3 object-contain" width={16} height={12} loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} /> : <MapPin size={12} className="text-white/30" />}
                          <span className="text-sm font-medium text-white">{tCountry(c.country)}</span>
                        </div>
                        <span className="text-[10px] text-white/40">{c.leagues.length} ligas</span>
                      </button>
                    ))}
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* World Cup Banner Hero */}
      {data.topLeagues.find(l => l.league.id === 1) && (
        <Link to="/liga/1" className="block no-underline">
          <m.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="relative rounded-3xl overflow-hidden group cursor-pointer shadow-[0_10px_30px_#b8860b33]"
            style={{ background: 'linear-gradient(135deg, #b8860b, #daa520, #ffd700)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="relative z-10 p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-5">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center shrink-0 shadow-xl">
                <Trophy size={28} className="text-white drop-shadow-md" />
              </div>
              <div className="flex-1">
                <div className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur rounded text-white/90 text-[8px] font-bold uppercase tracking-widest mb-1.5 border border-white/20">
                  DESTACADO
                </div>
                <h2 className="text-xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">Copa del Mundo 2026</h2>
                <p className="text-white/80 text-xs md:text-sm mt-1.5 font-medium max-w-xl">
                  Sumate a predecir el torneo más importante del mundo entero.
                </p>
              </div>
              <div className="hidden md:flex bg-white/10 hover:bg-white/20 backdrop-blur rounded-2xl p-2 transition-all border border-white/20">
                <ChevronRight size={20} className="text-white" />
              </div>
            </div>
          </m.div>
        </Link>
      )}

      {/* Mis Grupos Carousel */}
      {user && myGroups.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Users size={16} /> Tus Prodes
            </h2>
            <Link to="/groups" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Ver todos</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 pt-2">
            {myGroups.map(group => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="flex-shrink-0 w-[280px] md:w-[320px] rounded-2xl p-5 border border-white/10 no-underline transition-all hover:-translate-y-1 hover:shadow-xl relative overflow-hidden group"
                style={{
                  background: `linear-gradient(135deg, ${group.bgGradientFrom || '#1e1b4b'}, ${group.bgGradientTo || '#312e81'})`
                }}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Trophy size={60} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur">
                      <span className="text-lg font-bold text-white">{group.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white truncate group-hover:text-amber-400 transition-colors">{group.name}</h3>
                      <div className="text-xs text-white/50">{group.competition?.name || 'Torneo Activo'}</div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-white/70 bg-black/20 px-2 py-1 rounded">
                      Tu turno de predecir
                    </span>
                    <ChevronRight size={16} className="text-white/40 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Today Matches */}
      {loadingToday ? (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-white/10" />
            <div className="h-4 w-32 bg-white/10 rounded" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 bg-white/5 rounded-xl p-3 min-w-[200px] h-[88px]" />
            ))}
          </div>
        </div>
      ) : mergedTodayMatches?.total > 0 ? (
        <TodayMatchesRow data={mergedTodayMatches} />
      ) : null}

      {/* Top Leagues */}
      <div>
        <h2 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-3">Ligas Principales</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredTopLeagues
            .filter(l => l.league.id !== 1)
            .map((l) => (
              <Link
                key={l.league.id}
                to={`/liga/${l.league.id}`}
                className="bg-white/[0.03] rounded-xl p-4 flex flex-col items-center gap-3 no-underline border border-white/10 hover:border-white/20 hover:bg-white/[0.08] transition-all group shadow-[0_4px_24px_-12px_rgba(0,0,0,0.5)] hover:shadow-xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {l.league.logo ? (
                  <img src={l.league.logo} alt={l.league.name} loading="lazy" decoding="async" width={48} height={48} className="w-12 h-12 object-contain group-hover:scale-110 group-hover:-translate-y-1 transition-all z-10 drop-shadow-lg" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center z-10">
                    <Trophy size={20} className="text-white/40" />
                  </div>
                )}
                <div className="text-center z-10 w-full mt-1">
                  <div className="text-xs font-bold text-white/90 truncate">{l.league.name}</div>
                  <div className="text-[9px] font-medium text-white/50 flex items-center justify-center gap-1 mt-1 uppercase tracking-wider">
                    {l.country?.flag && <img src={l.country.flag} alt="" loading="lazy" decoding="async" width={12} height={8} className="w-3 h-2 object-contain rounded-sm" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
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
          <h2 className="text-sm font-bold text-white/40 uppercase tracking-wider">Por País</h2>
          <span className="text-xs text-white/20">{filteredCountries.length} países</span>
        </div>
        <div className="space-y-1">
          {visibleCountryList.map(c => (
            <CountryAccordion
              key={c.country}
              country={c}
              expanded={expandedCountry === c.country}
              onToggle={() => setExpandedCountry(expandedCountry === c.country ? null : c.country)}
            />
          ))}
        </div>

        {/* Show more button */}
        {visibleCountries < filteredCountries.length && (
          <button
            onClick={handleShowMore}
            className="w-full mt-3 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all"
          >
            Mostrar más países ({filteredCountries.length - visibleCountries} restantes)
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Today Matches grouped by league ───
const TodayMatchesRow = ({ data }) => {
  const [collapsedLeagues, setCollapsedLeagues] = useState({});
  const [liveOnly, setLiveOnly] = useState(false);

  const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P'];

  // Count total live matches across all leagues
  const liveCount = (data.grouped || []).reduce((acc, g) =>
    acc + g.matches.filter(m => LIVE_STATUSES.includes(m.fixture.status.short)).length, 0
  );

  // Filter groups when liveOnly is active
  const displayGroups = liveOnly
    ? (data.grouped || [])
        .map(g => ({
          ...g,
          matches: g.matches.filter(m => LIVE_STATUSES.includes(m.fixture.status.short)),
        }))
        .filter(g => g.matches.length > 0)
    : (data.grouped || []);

  return (
    <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-sm font-bold text-white/50 uppercase tracking-wider">Partidos de Hoy — {data.total} encuentros</span>
        </div>
        {liveCount > 0 && (
          <button
            onClick={() => setLiveOnly(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
              liveOnly
                ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${liveOnly ? 'bg-red-400 animate-pulse' : 'bg-white/30'}`} />
            En Vivo ({liveCount})
          </button>
        )}
      </div>
      <div className="space-y-3">
        {displayGroups.map(group => {
          const isCollapsed = collapsedLeagues[group.league.id];
          return (
            <div key={group.league.id} className="pt-2">
              <button 
                onClick={() => setCollapsedLeagues(prev => ({ ...prev, [group.league.id]: !isCollapsed }))}
                className="w-full flex items-center justify-between mb-2 pl-1 border-l-[3px] border-amber-500/50 bg-transparent border-t-0 border-r-0 border-b-0 cursor-pointer group px-0"
              >
                <div className="flex items-center gap-2.5">
                  {group.league.logo && <img src={group.league.logo} alt="" loading="lazy" decoding="async" width={24} height={24} className="w-6 h-6 object-contain ml-2" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                  <span className="text-sm text-white/90 font-bold uppercase tracking-wider group-hover:text-amber-400 transition-colors">{group.league.name}</span>
                  {group.league.flag && <img src={group.league.flag} alt="" className="w-5 h-4 object-contain opacity-70" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                </div>
                <ChevronDown size={16} className={`text-white/30 mr-2 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <m.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 px-1 after:content-[''] after:w-4 after:shrink-0">
                      {group.matches.map(m => {
              const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(m.fixture.status.short);
              const isPending = ['NS', 'TBD'].includes(m.fixture.status.short);

              return (
                      <Link
                        key={m.fixture.id}
                        to={`/partido/${m.fixture.id}`}
                        className={`flex-shrink-0 bg-white/5 rounded-xl p-2.5 min-w-[220px] md:min-w-[240px] hover:bg-white/10 transition-all no-underline border flex flex-col justify-between overflow-hidden ${isLive ? 'border-red-500/30 bg-red-500/5' : 'border-transparent'}`}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[10px] font-medium text-white/50 border-b border-white/5 pb-1.5">
                            {isLive ? (
                              <span className="text-red-400 animate-pulse font-bold flex items-center gap-1">● {m.fixture.status.elapsed || 0}'</span>
                            ) : isPending ? (
                              <span>{new Date(m.fixture.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}</span>
                            ) : (
                              <span>{m.fixture.status.short}</span>
                            )}
                            {m.league?.round && (
                              <span className="truncate max-w-[150px] text-right" title={m.league.round}>
                                {m.league.round.replace(/Regular Season - /i, 'Fecha ').replace(/Reg /i, 'Fecha ').replace(/Group Stage/i, 'Fase de Grupos')}
                              </span>
                            )}
                          </div>
                    {/* Teams and Score */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {m.teams?.home?.logo && <img src={m.teams.home.logo} alt="" loading="lazy" decoding="async" width={20} height={20} className="w-5 h-5 object-contain" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                        <span className="text-xs sm:text-[13px] text-white font-semibold truncate">{m.teams?.home?.name}</span>
                      </div>
                      <div className="text-sm font-bold text-white px-1 text-center w-6">
                        {!isPending ? (m.goals?.home ?? 0) : '-'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {m.teams?.away?.logo && <img src={m.teams.away.logo} alt="" loading="lazy" decoding="async" width={20} height={20} className="w-5 h-5 object-contain" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                        <span className="text-xs sm:text-[13px] text-white font-semibold truncate">{m.teams?.away?.name}</span>
                      </div>
                      <div className="text-sm font-bold text-white px-1 text-center w-6">
                        {!isPending ? (m.goals?.away ?? 0) : '-'}
                      </div>
                    </div>
                    {/* Aggregate / Global score — al lado del resultado */}
                    <AggregateScore
                      homeId={m.teams?.home?.id}
                      awayId={m.teams?.away?.id}
                      leagueId={m.league?.id}
                      round={m.league?.round}
                      homeGoalsToday={m.goals?.home}
                      awayGoalsToday={m.goals?.away}
                    />

                    {/* Real Odds / 1X2 View */}
                    <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-white/5 relative">
                      <div className={`flex items-center justify-between w-full flex-1 gap-1 ${['FT', 'AET', 'PEN'].includes(m.fixture.status.short) ? 'opacity-90' : ''}`}>
                        {(() => {
                          let h = '-', d = '-', a = '-';
                          if (m.odds && m.odds.length > 0) {
                            h = m.odds.find(o => o.value === 'Home')?.odd || '-';
                            d = m.odds.find(o => o.value === 'Draw')?.odd || '-';
                            a = m.odds.find(o => o.value === 'Away')?.odd || '-';
                          }

                          const isFinished = ['FT', 'AET', 'PEN'].includes(m.fixture.status.short);
                          const homeGoals = m.goals?.home ?? 0;
                          const awayGoals = m.goals?.away ?? 0;

                          const homeWon = isFinished && homeGoals > awayGoals;
                          const isDraw = isFinished && homeGoals === awayGoals;
                          const awayWon = isFinished && homeGoals < awayGoals;

                          return (
                            <>
                              <div className={`flex-1 text-center rounded py-1 text-[11px] font-medium border border-white/5 transition-all ${homeWon ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-black/20 text-white/50 hover:bg-white/10'
                                }`}>1: {h}</div>
                              <div className={`flex-1 text-center rounded py-1 text-[11px] font-medium border border-white/5 transition-all ${isDraw ? 'bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-black/20 text-white/50 hover:bg-white/10'
                                }`}>X: {d}</div>
                              <div className={`flex-1 text-center rounded py-1 text-[11px] font-medium border border-white/5 transition-all ${awayWon ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-black/20 text-white/50 hover:bg-white/10'
                                }`}>2: {a}</div>
                            </>
                          );
                        })()}
                      </div>
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
            <img src={c.flag} alt="" loading="lazy" decoding="async" width={24} height={16} className="w-6 h-4 object-contain rounded-sm" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
          ) : (
            <MapPin size={16} className="text-white/30" />
          )}
          <span className="text-sm font-medium">{c.translatedName || tCountry(c.country)}</span>
          <span className="text-xs text-white/30">{c.leagues.length} ligas</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {c.leagues.map(l => (
                <Link
                  key={l.league.id}
                  to={`/liga/${l.league.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-all no-underline"
                >
                  {l.league.logo ? (
                    <img src={l.league.logo} alt="" loading="lazy" decoding="async" width={32} height={32} className="w-8 h-8 object-contain" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
                  ) : (
                    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                      <Trophy size={14} className="text-white/30" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-white font-medium">{l.league.name}</div>
                    <div className="text-[10px] text-white/30">{l.league.type === 'Cup' ? 'Copa' : 'Liga'}</div>
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
