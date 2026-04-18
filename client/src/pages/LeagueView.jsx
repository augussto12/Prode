import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { Trophy, ArrowLeft, Table, Calendar, Target, Users, Zap, ChevronDown, ShieldCheck, GitBranch, List, Loader2, Check } from 'lucide-react';
import api from '../services/api';
import { tCountry, tRound } from '../utils/translations';
import BracketViewer from '../components/bracket/BracketViewer';
import { useBracket } from '../hooks/useBracket';
import useAuthStore from '../store/authStore';
import useCompetitionStore from '../store/competitionStore';
import useToastStore from '../store/toastStore';

const WORLD_CUP_ID = 1;

const TABS = [
  { id: 'standings', label: 'Posiciones', icon: Table },
  { id: 'fixtures', label: 'Partidos', icon: Calendar },
  { id: 'scorers', label: 'Goleadores', icon: Target },
  { id: 'teams', label: 'Equipos', icon: ShieldCheck },
];

export default function LeagueView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [league, setLeague] = useState(null);
  const [season, setSeason] = useState(null);
  const [tab, setTab] = useState('standings');
  const [standings, setStandings] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [allFixtures, setAllFixtures] = useState([]);
  const [scorers, setScorers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [standingsView, setStandingsView] = useState('table'); // 'table' | 'bracket'
  const [syncing, setSyncing] = useState(false);

  // Bracket data (loaded when switching to bracket view in standings)
  const { bracket: bracketData, loading: bracketLoading } = useBracket(
    standingsView === 'bracket' ? id : null,
    season
  );

  const currentUser = useAuthStore(s => s.user);
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN';
  const competitions = useCompetitionStore(state => state.competitions);
  const fetchCompetitions = useCompetitionStore(state => state.fetchCompetitions);
  const addToast = useToastStore(s => s.addToast);

  const isWorldCup = Number(id) === WORLD_CUP_ID;
  const isSynced = competitions.some(c => c.externalId === Number(id) && c.season === season);

  // Generate available seasons (current year down to 2020)
  const availableSeasons = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadLeague();
  }, [id]);

  // Reload all data when season changes
  useEffect(() => {
    if (!season) return;
    setStandings(null);
    setFixtures([]);
    setScorers([]);
    setRounds([]);
    setSelectedRound(null);
    if (tab === 'standings') loadStandings();
    if (tab === 'fixtures') loadFixtures();
    if (tab === 'scorers') loadScorers();
  }, [season]);

  useEffect(() => {
    if (!season) return;
    if (tab === 'standings' && !standings) loadStandings();
    if (tab === 'fixtures' && fixtures.length === 0) loadFixtures();
    if (tab === 'scorers' && scorers.length === 0) loadScorers();
    if (tab === 'teams' && teams.length === 0) loadTeams();
  }, [tab, season]);

  const loadLeague = async () => {
    try {
      // Fetch league without forcing season to get seasons array
      const { data } = await api.get(`/explorer/leagues/${id}`);
      setLeague(data);
      
      // Auto-detect correct current season
      const activeSeason = data.seasons?.find(s => s.current)?.year || currentYear;
      setSeason(activeSeason);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleEnableProde = async () => {
    if (!isAdmin || !season) return;
    setSyncing(true);
    try {
      addToast({ type: 'success', message: 'Descargando equipos y logos...' });
      await api.post(`/admin/sync/teams`, { leagueId: Number(id), season });
      
      addToast({ type: 'success', message: 'Descargando fixtures y fechas...' });
      await api.post(`/admin/sync/fixtures`, { leagueId: Number(id), season });
      
      await fetchCompetitions();
      addToast({ type: 'success', message: '¡Torneo habilitado para el Prode!' });
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Error al habilitar el torneo' });
    } finally {
      setSyncing(false);
    }
  };

  const loadStandings = async () => {
    try {
      const { data } = await api.get(`/explorer/leagues/${id}/standings?season=${season}`);
      setStandings(data);
      setActiveGroupIndex(0);
    } catch (err) { console.error(err); }
  };

  const loadFixtures = async () => {
    try {
      const [fixRes, roundsRes] = await Promise.all([
        api.get(`/explorer/leagues/${id}/fixtures?season=${season}`),
        api.get(`/explorer/leagues/${id}/rounds?season=${season}`),
      ]);
      const roundsData = roundsRes.data;
      const allRounds = roundsData.rounds || roundsData || [];
      const currentRound = roundsData.currentRound || null;

      setRounds(allRounds);
      // Always save all fixtures for the bracket view in standings
      setAllFixtures(fixRes.data);

      // Auto-seleccionar la ronda actual
      if (currentRound && !selectedRound) {
        setSelectedRound(currentRound);
        // Cargar solo la ronda actual
        const { data: currentFixtures } = await api.get(`/explorer/leagues/${id}/fixtures?season=${season}&round=${encodeURIComponent(currentRound)}`);
        setFixtures(currentFixtures);
      } else {
        setFixtures(fixRes.data);
      }
    } catch (err) { console.error(err); }
  };

  const loadFixturesByRound = async (round) => {
    setSelectedRound(round);
    try {
      const { data } = await api.get(`/explorer/leagues/${id}/fixtures?season=${season}&round=${encodeURIComponent(round)}`);
      setFixtures(data);
    } catch (err) { console.error(err); }
  };

  const loadScorers = async () => {
    try {
      const { data } = await api.get(`/explorer/leagues/${id}/scorers?season=${season}`);
      setScorers(data);
    } catch (err) { console.error(err); }
  };

  const loadTeams = async () => {
    try {
      // Usar standings si ya está cargado, sino cargarlo directo (no leer state post-setState, es async)
      let standingsData = standings;
      if (!standingsData) {
        const { data } = await api.get(`/explorer/leagues/${id}/standings?season=${season}`);
        setStandings(data);
        standingsData = data;
      }
      const allTeams = [];
      const groups = standingsData?.league?.standings || [];
      groups.forEach(group => {
        group.forEach(row => {
          allTeams.push(row.team);
        });
      });
      setTeams(allTeams);
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  const leagueInfo = league?.league;
  const countryInfo = league?.country;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/explorar')}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white cursor-pointer bg-transparent border-none transition-all">
        <ArrowLeft size={16} /> Volver al explorador
      </button>

      {/* League Header — special gold for World Cup */}
      <div className={`glass-card rounded-2xl p-6 relative overflow-hidden ${
        isWorldCup ? 'border border-amber-500/30' : ''
      }`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          background: isWorldCup
            ? 'linear-gradient(135deg, #b8860b, #daa520, #ffd700)'
            : 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
        }} />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-5 w-full">
          {leagueInfo?.logo ? (
            <img src={leagueInfo.logo} alt={leagueInfo.name} width={64} height={64} className={`object-contain ${isWorldCup ? 'w-20 h-20' : 'w-16 h-16'}`} loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
          ) : (
            <div className={`rounded-2xl flex items-center justify-center ${isWorldCup ? 'w-20 h-20 bg-amber-500/20' : 'w-16 h-16 bg-white/10'}`}>
              <Trophy size={isWorldCup ? 36 : 28} className={isWorldCup ? 'text-amber-400' : 'text-white/40'} />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <h1 className={`font-black ${isWorldCup ? 'text-3xl' : 'text-2xl'} text-white`}>
              {isWorldCup ? 'Copa del Mundo 2026' : leagueInfo?.name}
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
              {isWorldCup ? (
                <span className="text-sm text-amber-400/70">Estados Unidos, México y Canadá</span>
              ) : (
                <>
                  {countryInfo?.flag && <img src={countryInfo.flag} alt="" width={20} height={12} className="w-5 h-3 object-contain rounded-sm" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                  <span className="text-sm text-white/50">{tCountry(countryInfo?.name)}</span>
                  <span className="text-white/20">•</span>
                  <span className="text-sm text-white/50">{leagueInfo?.type === 'Cup' ? 'Copa' : 'Liga'}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 md:mt-0">
            {/* Admin Enable Prode Button */}
            {isAdmin && !isSynced && (
              <button
                onClick={handleEnableProde}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border-none text-white cursor-pointer transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {syncing ? 'Habilitando...' : 'Habilitar para Prode'}
              </button>
            )}

            {/* Admin Synced Indicator */}
            {isAdmin && isSynced && (
              <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                <Check size={14} /> Prode Disp.
              </span>
            )}

            {/* Season selector */}
            <div className="relative">
              <select
                value={season || currentYear}
                onChange={(e) => setSeason(Number(e.target.value))}
                className="appearance-none bg-white/10 border border-white/20 text-white text-xs sm:text-sm font-semibold rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 pr-8 cursor-pointer hover:bg-white/15 transition-all focus:outline-none focus:border-indigo-500"
              >
                {availableSeasons.map(s => (
                  <option key={s} value={s} className="bg-gray-900 text-white">{s}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full sm:w-fit overflow-x-auto hide-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border-none whitespace-nowrap shrink-0 flex-1 sm:flex-none ${
              tab === t.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/70 bg-transparent'
            }`}>
            <t.icon size={14} className="sm:w-4 sm:h-4" /> <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Standings Tab */}
      {tab === 'standings' && !standings && (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" /></div>
      )}
      {tab === 'standings' && standings && (
        <div className="space-y-4">
          {/* Tabla / Fase Final toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStandingsView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                standingsView === 'table' ? 'bg-white/10 text-white' : 'bg-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <Table size={14} /> Tabla
            </button>
            <button
              onClick={() => setStandingsView('bracket')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                standingsView === 'bracket' ? 'bg-white/10 text-white' : 'bg-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <GitBranch size={14} /> Fase Final
            </button>
          </div>

          {/* TABLE VIEW */}
          {standingsView === 'table' && (
            <>
              {standings.league?.standings?.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {standings.league.standings.map((g, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveGroupIndex(i)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border cursor-pointer ${
                        activeGroupIndex === i 
                          ? 'bg-white/10 text-white border-white/20 shadow-md' 
                          : 'bg-transparent text-white/40 border-transparent hover:bg-white/5 hover:text-white/80'
                      }`}
                    >
                      {g[0]?.group || `Grupo ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}

              {standings.league?.standings?.[activeGroupIndex] && (() => {
                const group = standings.league.standings[activeGroupIndex];
                return (
                  <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/30 text-xs">
                            <th className="text-left px-4 py-2 font-medium sticky-col backdrop-blur-md">
                              <span className="inline-block w-6 text-white/50">#</span>
                              Equipo
                            </th>
                            <th className="px-2 py-2 font-medium text-center">PJ</th>
                            <th className="px-2 py-2 font-medium text-center">G</th>
                            <th className="px-2 py-2 font-medium text-center">E</th>
                            <th className="px-2 py-2 font-medium text-center">P</th>
                            <th className="px-2 py-2 font-medium text-center">GF</th>
                            <th className="px-2 py-2 font-medium text-center">GC</th>
                            <th className="px-2 py-2 font-medium text-center">DG</th>
                            <th className="px-2 py-2 font-medium text-center font-bold">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.map((row) => {
                            const desc = (row.description || '').toLowerCase();
                            let indicatorColor = 'border-l-transparent';
                            if (desc.includes('1/8-finals')) {
                              indicatorColor = 'border-l-emerald-500';
                            } else if (desc.includes('1/16-finals')) {
                              indicatorColor = 'border-l-blue-400';
                            } else if (desc.includes('promotion') || desc.includes('champions league') || desc.includes('libertadores') || desc.includes('playoffs') || desc.includes('play-off')) {
                              indicatorColor = 'border-l-emerald-500';
                            } else if (desc.includes('relegation')) {
                              indicatorColor = 'border-l-red-500';
                            } else if (desc.includes('qualifiers') || desc.includes('europa') || desc.includes('sudamericana') || desc.includes('knockout')) {
                              indicatorColor = 'border-l-amber-500';
                            }

                            return (
                            <tr key={row.team.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                              <td className={`px-4 py-2.5 sticky-col backdrop-blur-md border-r border-l-[3px] border-white/5 ${indicatorColor}`}>
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate(`/equipo/${row.team.id}`)}>
                                  <span className="w-5 font-bold text-white/40 text-xs text-right mr-1">{row.rank}</span>
                                  {row.team.logo && <img src={row.team.logo} alt="" width={20} height={20} className="w-5 h-5 object-contain group-hover:scale-110 transition-transform shrink-0" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                                  <span className="text-white font-medium text-xs group-hover:text-indigo-300 transition-colors whitespace-nowrap">{row.team.name}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2.5 text-center text-white/60">{row.all.played}</td>
                              <td className="px-2 py-2.5 text-center text-white/60">{row.all.win}</td>
                              <td className="px-2 py-2.5 text-center text-white/60">{row.all.draw}</td>
                              <td className="px-2 py-2.5 text-center text-white/60">{row.all.lose}</td>
                              <td className="px-2 py-2.5 text-center text-white/60">{row.all.goals.for}</td>
                              <td className="px-2 py-2.5 text-center text-white/60">{row.all.goals.against}</td>
                              <td className="px-2 py-2.5 text-center text-white/50">{row.goalsDiff > 0 ? '+' : ''}{row.goalsDiff}</td>
                              <td className="px-2 py-2.5 text-center text-white font-bold">{row.points}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* References Legend */}
                    {(() => {
                      const legends = [];
                      group.forEach(row => {
                        if (!row.description) return;
                        const descText = String(row.description);
                        const descLower = descText.toLowerCase();
                        
                        let indicatorBg = null;
                        if (descLower.includes('1/8-finals')) {
                          indicatorBg = 'bg-emerald-500';
                        } else if (descLower.includes('1/16-finals')) {
                          indicatorBg = 'bg-blue-400';
                        } else if (descLower.includes('promotion') || descLower.includes('champions league') || descLower.includes('libertadores') || descLower.includes('playoffs') || descLower.includes('play-off')) {
                          indicatorBg = 'bg-emerald-500';
                        } else if (descLower.includes('relegation')) {
                          indicatorBg = 'bg-red-500';
                        } else if (descLower.includes('qualifiers') || descLower.includes('europa') || descLower.includes('sudamericana') || descLower.includes('knockout')) {
                          indicatorBg = 'bg-amber-500';
                        }
                        
                        if (indicatorBg && !legends.some(l => l.text === descText)) {
                          legends.push({ text: descText, bg: indicatorBg });
                        }
                      });

                      if (legends.length === 0) return null;
                      
                      return (
                        <div className="p-4 border-t border-white/5 bg-white/[0.01] flex flex-wrap gap-x-6 gap-y-2">
                          {legends.map((l, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-white/60">
                              <div className={`w-2 h-2 rounded-full ${l.bg}`}></div>
                              {l.text}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </m.div>
                );
              })()}
            </>
          )}

          {/* BRACKET / FASE FINAL VIEW */}
          {standingsView === 'bracket' && (
            bracketLoading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" /></div>
            ) : bracketData?.hasKnockout ? (
              <BracketViewer columns={bracketData.columns} thirdPlace={bracketData.thirdPlace} />
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center text-white/40">No hay fases eliminatorias disponibles.</div>
            )
          )}
        </div>
      )}

      {/* Fixtures Tab — just the list, no toggles */}
      {tab === 'fixtures' && fixtures.length === 0 && rounds.length === 0 && (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" /></div>
      )}
      {tab === 'fixtures' && (fixtures.length > 0 || rounds.length > 0) && (
        <div className="space-y-4">
          {/* Round selector */}
          {rounds.length > 0 && (
            <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2 rounded-xl">
              <span className="text-xs font-medium text-white/50 pl-2">Fase / Jornada:</span>
              <div className="relative flex-1">
                <select
                  value={selectedRound || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setSelectedRound(null);
                      loadFixtures();
                    } else {
                      loadFixturesByRound(val);
                    }
                  }}
                  className="w-full appearance-none bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                >
                  <option value="" className="bg-slate-900">Todos los partidos</option>
                  {rounds.map(r => (
                    <option key={r} value={r} className="bg-slate-900">{tRound(r)}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>
          )}

          {/* Fixtures list */}
          <FixturesList fixtures={fixtures} />
        </div>
      )}

      {/* Scorers Tab */}
      {tab === 'scorers' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full min-w-[500px] md:min-w-full text-sm">
              <thead>
                <tr className="text-white/30 text-[10px] md:text-xs border-b border-white/5 uppercase tracking-wider">
                  <th className="text-left px-3 md:px-4 py-3 font-bold sticky-col backdrop-blur-md">
                    <span className="inline-block w-3 md:w-4 text-white/50">#</span> Jugador
                  </th>
                  <th className="text-left px-2 py-3 font-bold whitespace-nowrap">Equipo</th>
                  <th className="px-2 py-3 font-bold text-center whitespace-nowrap">⚽ Goles</th>
                  <th className="px-2 py-3 font-bold text-center whitespace-nowrap">🅰️ Asist.</th>
                  <th className="px-2 py-3 font-bold text-center whitespace-nowrap">PJ</th>
                </tr>
              </thead>
              <tbody>
                {scorers.map((s, i) => {
                  const player = s.player;
                  const stats = s.statistics?.[0];
                  return (
                    <tr key={player.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => navigate(`/jugador/${player.id}`)}>
                      <td className="px-3 md:px-4 py-2 sticky-col backdrop-blur-xl border-r border-white/5 group-hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="w-3 md:w-4 text-white/40 text-[10px] md:text-xs font-bold shrink-0">{i + 1}</span>
                          {player.photo ? (
                            <img src={player.photo} alt="" width={24} height={24} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover bg-white/10" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
                          ) : (
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] md:text-xs font-bold text-white/40">
                              {player.name?.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 pr-2">
                            <div className="text-xs md:text-sm font-bold text-white truncate max-w-[120px] sm:max-w-[180px]">{player.name}</div>
                            <div className="text-[9px] md:text-[10px] text-white/40 truncate">{tCountry(player.nationality)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          {stats?.team?.logo && <img src={stats.team.logo} alt="" width={16} height={16} className="w-4 h-4 md:w-5 md:h-5 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                          <span className="text-[10px] md:text-xs text-white/60 truncate max-w-[80px] sm:max-w-[120px]">{stats?.team?.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-emerald-400 font-black text-sm md:text-base">{stats?.goals?.total ?? 0}</td>
                      <td className="px-2 py-2 text-center text-white/60 text-xs md:text-sm">{stats?.goals?.assists ?? 0}</td>
                      <td className="px-2 py-2 text-center text-white/40 text-[10px] md:text-xs">{stats?.games?.appearences ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {tab === 'teams' && (
        <div>
          {teams.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {teams.map(team => (
                <m.div
                  key={team.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => navigate(`/equipo/${team.id}`)}
                  className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 hover:bg-white/10 hover:ring-1 hover:ring-indigo-500/50 transition-all cursor-pointer group"
                >
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} loading="lazy" decoding="async" width={56} height={56} className="w-14 h-14 object-contain group-hover:scale-110 transition-transform" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                      <ShieldCheck size={24} className="text-white/30" />
                    </div>
                  )}
                  <span className="text-xs font-medium text-white text-center">{team.name}</span>
                </m.div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center text-white/40">
              <p>Cargando equipos...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fixtures List Component ───
function FixturesList({ fixtures }) {
  const navigate = useNavigate();

  // Group by date
  const byDate = {};
  [...fixtures]
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
    .forEach(m => {
      const dateKey = new Date(m.fixture.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(m);
    });

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, dayFixtures]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-white/40" />
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">{date}</h3>
          </div>
          <div className="space-y-1.5">
            {dayFixtures.map(m => {
              const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(m.fixture.status?.short);
              const isFinished = ['FT', 'AET', 'PEN'].includes(m.fixture.status?.short);

              return (
                <div key={m.fixture.id}
                  onClick={() => navigate(`/partido/${m.fixture.id}`)}
                  className={`glass-card rounded-xl p-3 flex items-center cursor-pointer hover:bg-white/[0.06] transition-all ${
                    isLive ? 'border border-red-500/20' : ''
                  }`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {m.teams?.home?.logo && <img src={m.teams.home.logo} alt="" width={24} height={24} className="w-6 h-6 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                    <span className="text-sm text-white font-medium truncate">{m.teams?.home?.name}</span>
                  </div>
                  <div className="px-4 text-center min-w-[70px]">
                    {isLive ? (
                      <div>
                        <span className="text-base font-bold text-white">{m.goals?.home} - {m.goals?.away}</span>
                        <div className="text-[10px] text-red-400 font-bold animate-pulse">{m.fixture.status.elapsed}'</div>
                      </div>
                    ) : isFinished ? (
                      <span className="text-base font-bold text-white">{m.goals?.home} - {m.goals?.away}</span>
                    ) : (
                      <span className="text-xs text-white/40">
                        {new Date(m.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-sm text-white font-medium truncate">{m.teams?.away?.name}</span>
                    {m.teams?.away?.logo && <img src={m.teams.away.logo} alt="" width={24} height={24} className="w-6 h-6 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                  </div>
                  <div className="ml-3 w-10 text-right">
                    {isLive && <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />}
                    {isFinished && <span className="text-[10px] text-green-400/60 font-medium">FT</span>}
                    {!isLive && !isFinished && <span className="text-[10px] text-white/20">→</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
