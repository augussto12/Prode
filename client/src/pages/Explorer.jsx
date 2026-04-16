import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trophy, Globe, ChevronDown, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import api from '../services/api';
import { tCountry } from '../utils/translations';

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
  const [loading, setLoading] = useState(true);
  const [loadingToday, setLoadingToday] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [visibleCountries, setVisibleCountries] = useState(COUNTRIES_PER_PAGE);

  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    loadData();
    loadToday();
    const liveInterval = setInterval(loadToday, 60000);
    return () => clearInterval(liveInterval);
  }, []);

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
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar liga o país..."
            className="pl-9 pr-4 py-2.5 w-full md:w-72 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white bg-transparent border-none cursor-pointer text-xs">✕</button>
          )}
        </div>
      </div>

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
      ) : todayMatches?.total > 0 ? (
        <TodayMatchesRow data={todayMatches} />
      ) : null}

      {/* World Cup Banner */}
      {data.topLeagues.find(l => l.league.id === 1) && (
        <Link to="/liga/1" className="block no-underline">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden group cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #b8860b, #daa520, #ffd700)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            <div className="relative z-10 p-6 md:p-8 flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Trophy size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-black text-white">Copa del Mundo 2026</h2>
                <p className="text-white/70 text-sm mt-1">Estados Unidos, México y Canadá — El torneo más importante del mundo</p>
              </div>
              <ChevronRight size={28} className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </motion.div>
        </Link>
      )}

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
                className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 no-underline hover:bg-white/10 transition-all group"
              >
                {l.league.logo ? (
                  <img src={l.league.logo} alt={l.league.name} loading="lazy" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Trophy size={20} className="text-white/40" />
                  </div>
                )}
                <div className="text-center">
                  <div className="text-xs font-semibold text-white truncate w-full">{l.league.name}</div>
                  <div className="text-[10px] text-white/30 flex items-center justify-center gap-1 mt-0.5">
                    {l.country?.flag && <img src={l.country.flag} alt="" loading="lazy" className="w-3 h-2 object-contain" />}
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
const TodayMatchesRow = ({ data }) => (
  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-2xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-2 h-2 rounded-full bg-blue-500" />
      <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Partidos de Hoy — {data.total} encuentros</span>
    </div>
    <div className="space-y-3">
      {(data.grouped || []).map(group => (
        <div key={group.league.id} className="pt-2">
          <div className="flex items-center gap-2.5 mb-2 pl-1 border-l-2 border-amber-500/50">
            {group.league.logo && <img src={group.league.logo} alt="" loading="lazy" className="w-5 h-5 object-contain ml-2" />}
            <span className="text-[13px] text-white/90 font-bold uppercase tracking-wider">{group.league.name}</span>
            {group.league.flag && <img src={group.league.flag} alt="" className="w-4 h-3 object-contain opacity-70" />}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
            {group.matches.map(m => {
              const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(m.fixture.status.short);
              const isPending = ['NS', 'TBD'].includes(m.fixture.status.short);
              
              return (
                <Link
                  key={m.fixture.id}
                  to={`/partido/${m.fixture.id}`}
                  className={`flex-shrink-0 bg-white/5 rounded-xl p-3 min-w-[200px] hover:bg-white/10 transition-all no-underline border ${isLive ? 'border-red-500/30 bg-red-500/5' : 'border-transparent'}`}
                >
                  <div className="flex flex-col gap-2">
                    {/* Header info (Time/Status) */}
                    <div className="flex justify-between items-center text-[9px] font-mono text-white/40 border-b border-white/5 pb-1">
                       {isLive ? (
                         <span className="text-red-400 animate-pulse font-bold">● {m.fixture.status.elapsed || 0}'</span>
                       ) : isPending ? (
                         <span>{new Date(m.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                       ) : (
                         <span>{m.fixture.status.short}</span>
                       )}
                    </div>
                    {/* Teams and Score */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {m.teams?.home?.logo && <img src={m.teams.home.logo} alt="" loading="lazy" className="w-5 h-5 object-contain" />}
                        <span className="text-xs text-white font-medium truncate">{m.teams?.home?.name}</span>
                      </div>
                      <div className="text-xs font-bold text-white px-2 text-center w-6">
                        {!isPending ? (m.goals?.home ?? 0) : '-'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {m.teams?.away?.logo && <img src={m.teams.away.logo} alt="" loading="lazy" className="w-5 h-5 object-contain" />}
                        <span className="text-xs text-white font-medium truncate">{m.teams?.away?.name}</span>
                      </div>
                      <div className="text-xs font-bold text-white px-2 text-center w-6">
                        {!isPending ? (m.goals?.away ?? 0) : '-'}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

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
            <img src={c.flag} alt="" loading="lazy" className="w-6 h-4 object-contain rounded-sm" />
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
          <motion.div
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
                    <img src={l.league.logo} alt="" loading="lazy" className="w-8 h-8 object-contain" />
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
