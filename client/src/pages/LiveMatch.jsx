import { useState, useEffect, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowLeft, Clock, MapPin } from 'lucide-react';
import api from '../services/api';
import { tStat, tEvent, tRound, tMarket, tOddValue, tInjury } from '../utils/translations';

export default function LiveMatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [injuries, setInjuries] = useState([]);
  const [liveOdds, setLiveOdds] = useState([]);
  const [firstLeg, setFirstLeg] = useState(null); // Partido de ida (para llaves de vuelta)
  const [loading, setLoading] = useState(true);
  const [activeLineupTab, setActiveLineupTab] = useState('home');
  const [activeOddsMarketIndex, setActiveOddsMarketIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadMatch();
    return () => {
      // Limpiar interval al cambiar de partido o desmontar — evita polling con id viejo
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [id]);

  const loadMatch = async () => {
    try {
      const [resultRes, injuriesRes] = await Promise.all([
        api.get(`/explorer/fixtures/${id}`),
        api.get(`/explorer/injuries?fixture=${id}`).catch(() => ({ data: [] }))
      ]);
      setData(resultRes.data);
      setInjuries(injuriesRes.data || []);

      // Detectar si es partido de VUELTA en fase final → buscar partido de ida
      const roundStr = resultRes.data.fixture?.league?.round || '';
      const isSecondLeg = /2nd\s*Leg/i.test(roundStr);
      if (isSecondLeg) {
        fetchFirstLeg(resultRes.data.fixture);
      }

      // Polling if live
      const status = resultRes.data.fixture?.fixture?.status?.short;
      const isMatchLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(status);

      if (isMatchLive) {
        fetchLiveOdds();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(async () => {
            try {
              const { data: fresh } = await api.get(`/explorer/fixtures/${id}`);
              setData(fresh);
              fetchLiveOdds();
            } catch (e) { console.error(e); }
          }, 30000);
        }
      } else {
        if (status === 'NS' || !status) {
          fetchPreMatchOdds();
        }
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  /** Busca el partido de ida en el H2H para calcular el agregado */
  const fetchFirstLeg = async (fix) => {
    try {
      const homeId = fix.teams?.home?.id;
      const awayId = fix.teams?.away?.id;
      const leagueId = fix.league?.id;
      if (!homeId || !awayId) return;

      const { data: h2hData } = await api.get(`/explorer/h2h/${homeId}/${awayId}?last=5`);
      const matches = h2hData || [];

      // Buscar el partido de ida: misma liga, mismo año, que sea "1st Leg" y ya terminado
      // En el partido de IDA, los equipos están invertidos (home de vuelta = away de ida)
      const firstLegMatch = matches.find(m => {
        const round = m.league?.round || '';
        const isFirstLeg = /1st\s*Leg/i.test(round);
        const sameLeague = m.league?.id === leagueId;
        const isFinished = ['FT', 'AET', 'PEN'].includes(m.fixture?.status?.short);
        return isFirstLeg && sameLeague && isFinished;
      });

      if (firstLegMatch) {
        setFirstLeg(firstLegMatch);
      }
    } catch (e) {
      console.log('No se pudo cargar el partido de ida');
    }
  };

  const fetchLiveOdds = async () => {
    try {
      const { data } = await api.get(`/explorer/odds/live/${id}`);
      setLiveOdds(data || []);
    } catch (e) { console.log('No live odds available'); }
  };

  const fetchPreMatchOdds = async () => {
    try {
      const { data } = await api.get(`/explorer/odds?fixture=${id}`);
      setLiveOdds(data || []);
    } catch (e) { console.log('No pre-match odds available'); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  if (!data?.fixture) {
    return <div className="text-center py-10 text-white/40">Partido no encontrado</div>;
  }

  const fix = data.fixture;
  const match = fix.fixture;
  const teams = fix.teams;
  const goals = fix.goals;
  const league = fix.league;
  const events = data.events || [];
  const statistics = data.statistics || [];
  const lineups = data.lineups || [];

  const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(match?.status?.short);
  const isFinished = ['FT', 'AET', 'PEN'].includes(match?.status?.short);

  const goalEvents = events.filter(e => e.type === 'Goal');

  return (
    <div className="space-y-6 max-w-[1536px] mx-auto pb-10 px-4 xl:px-8">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white cursor-pointer bg-transparent border-none transition-all">
        <ArrowLeft size={16} /> Volver
      </button>

      {/* MATCH HEADER - Full Width */}
      <div className={`glass-card rounded-3xl p-6 relative overflow-hidden ${isLive ? 'border border-red-500/30' : 'border border-white/10'}`}>
        {isLive && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-pulse" />}
        
        {/* League & Venue Info */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5 mb-2">
            {league?.logo && <img src={league.logo} alt="" width={16} height={16} className="w-4 h-4 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
            <span className="text-xs font-medium text-white/70">{league?.name}</span>
            <span className="text-white/20 px-1">•</span>
            <span className="text-xs text-white/40">{tRound(league?.round)}</span>
          </div>
          {match?.venue && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/30">
              <MapPin size={12} />
              {match.venue.name}, {match.venue.city}
            </div>
          )}
        </div>

        {/* Main Scoreboard */}
        <div className="flex items-center justify-center gap-2 sm:gap-6 md:gap-12 max-w-4xl mx-auto">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center text-center cursor-pointer group" onClick={() => navigate(`/equipo/${teams?.home?.id}`)}>
            {teams?.home?.logo ? (
              <img src={teams.home.logo} alt="" width={48} height={48} className="w-12 h-12 md:w-24 md:h-24 mb-1 md:mb-4 object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-300" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
            ) : (
              <div className="w-12 h-12 md:w-24 md:h-24 rounded-full bg-white/5 flex items-center justify-center mb-1 md:mb-4 text-xl md:text-3xl group-hover:bg-white/10 transition-colors">{teams?.home?.name?.[0]}</div>
            )}
            <div className="text-sm md:text-2xl font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors max-w-[90px] md:max-w-[200px] leading-tight">{teams?.home?.name}</div>
          </div>

          {/* Score Center */}
          <div className="px-2 md:px-6 text-center flex flex-col items-center shrink-0">
            <div className="text-3xl sm:text-5xl md:text-7xl font-black text-white tracking-tighter whitespace-nowrap" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              {goals?.home ?? 0} <span className="text-white/20 font-normal mx-1 md:mx-3">-</span> {goals?.away ?? 0}
            </div>

            {/* Agregado para llaves de ida y vuelta */}
            {firstLeg && (() => {
              // En el partido de ida, el "home" actual era "away" y viceversa
              // Buscar qué equipo fue home/away en la ida
              const idaHomeId = firstLeg.teams?.home?.id;
              const currentHomeId = teams?.home?.id;
              // Si el home actual era el away de ida
              const idaGoalsForCurrentHome = idaHomeId === currentHomeId 
                ? firstLeg.goals?.home 
                : firstLeg.goals?.away;
              const idaGoalsForCurrentAway = idaHomeId === currentHomeId 
                ? firstLeg.goals?.away 
                : firstLeg.goals?.home;

              const aggHome = (goals?.home ?? 0) + (idaGoalsForCurrentHome ?? 0);
              const aggAway = (goals?.away ?? 0) + (idaGoalsForCurrentAway ?? 0);

              // Resultado de ida desde la perspectiva del home actual
              const idaScoreText = `${idaGoalsForCurrentAway ?? 0} - ${idaGoalsForCurrentHome ?? 0}`;

              return (
                <div className="mt-1 md:mt-2 space-y-1">
                  <div className="inline-flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-indigo-400/70">Agregado</span>
                    <span className="text-xs md:text-sm font-black text-indigo-300">{aggHome} - {aggAway}</span>
                  </div>
                  <div className="text-[9px] md:text-[10px] text-white/30 font-medium hidden sm:block">
                    Ida: <span className="text-white/50 font-bold">{idaScoreText}</span>
                    <span className="text-white/20 ml-1">({firstLeg.teams?.home?.name})</span>
                  </div>
                </div>
              );
            })()}
            
            <div className="mt-2 md:mt-4">
              {isLive ? (
                <div className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 whitespace-nowrap">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs md:text-sm text-red-500 font-bold">{match.status.elapsed}'</span>
                  {match.status.short === 'HT' && <span className="text-[10px] md:text-xs text-red-500/70 ml-1">(MT)</span>}
                </div>
              ) : isFinished ? (
                <span className="px-3 md:px-4 py-1 md:py-1.5 bg-white/10 text-white/70 rounded-full text-[10px] md:text-xs font-semibold uppercase tracking-widest inline-block border border-white/5 whitespace-nowrap">
                  {match.status.short === 'PEN' ? 'Penales' : match.status.short === 'AET' ? 'Alargue' : 'Final'}
                </span>
              ) : (
                <div className="inline-flex items-center justify-center gap-1 md:gap-1.5 px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-white/5 text-white/50 border border-white/5 whitespace-nowrap">
                  <Clock size={12} className="shrink-0" />
                  <span className="text-[10px] md:text-xs font-medium">
                    {new Date(match.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} • {new Date(match.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center text-center cursor-pointer group" onClick={() => navigate(`/equipo/${teams?.away?.id}`)}>
            {teams?.away?.logo ? (
              <img src={teams.away.logo} alt="" width={48} height={48} className="w-12 h-12 md:w-24 md:h-24 mb-1 md:mb-4 object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-300" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
            ) : (
              <div className="w-12 h-12 md:w-24 md:h-24 rounded-full bg-white/5 flex items-center justify-center mb-1 md:mb-4 text-xl md:text-3xl group-hover:bg-white/10 transition-colors">{teams?.away?.name?.[0]}</div>
            )}
            <div className="text-sm md:text-2xl font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors max-w-[90px] md:max-w-[200px] leading-tight">{teams?.away?.name}</div>
          </div>
        </div>

        {/* Goal Scorers Footer */}
        {goalEvents.length > 0 && (
          <div className="flex justify-between mt-8 pt-6 border-t border-white/5 max-w-4xl mx-auto">
            {/* Home Goals */}
            <div className="flex-1 space-y-1.5">
              {goalEvents.filter(e => e.team.id === teams?.home?.id).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                  <span className="text-[10px]">⚽</span>
                  <span className="font-medium text-white/90">{e.player.name}</span>
                  <span className="text-xs text-white/40 font-mono">{e.time.elapsed}'{e.time.extra ? `+${e.time.extra}` : ''}</span>
                  {e.detail !== 'Normal Goal' && <span className="text-xs text-amber-400/80">({tEvent(e.detail)})</span>}
                </div>
              ))}
            </div>
            {/* Away Goals */}
            <div className="flex-1 space-y-1.5 flex flex-col items-end">
              {goalEvents.filter(e => e.team.id === teams?.away?.id).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-white/60 flex-row-reverse">
                  <span className="text-[10px]">⚽</span>
                  <span className="font-medium text-white/90">{e.player.name}</span>
                  <span className="text-xs text-white/40 font-mono">{e.time.elapsed}'{e.time.extra ? `+${e.time.extra}` : ''}</span>
                  {e.detail !== 'Normal Goal' && <span className="text-xs text-amber-400/80">({tEvent(e.detail)})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* THREE-COLUMN LAYOUT (With Mobile Toggle) */}
      
      {/* Mobile Toggle */}
      {lineups.length >= 2 && (
        <div className="flex lg:hidden bg-white/5 rounded-xl p-1 mb-2 border border-white/10 max-w-sm mx-auto">
          <button 
            onClick={() => setActiveLineupTab('home')} 
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all border ${activeLineupTab === 'home' ? 'bg-white/20 text-white shadow border-white/10' : 'text-white/40 border-transparent'}`}
          >
            {teams?.home?.name || 'Local'}
          </button>
          <button 
            onClick={() => setActiveLineupTab('away')} 
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all border ${activeLineupTab === 'away' ? 'bg-white/20 text-white shadow border-white/10' : 'text-white/40 border-transparent'}`}
          >
            {teams?.away?.name || 'Visita'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Home Lineup */}
        {lineups.length >= 2 && (
          <div className={`lg:col-span-3 lg:border-none lg:block lg:order-1 ${activeLineupTab === 'home' ? 'block order-1' : 'hidden'}`}>
            <LineupCard lineup={lineups[0]} align="left" navigate={navigate} />
          </div>
        )}

        {/* CENTER COLUMN: Stats & Events */}
        <div className={`${lineups.length >= 2 ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-6 order-2 lg:order-2 mb-6 lg:mb-0`}>
          
          {/* Live Odds / Pre-Match Odds */}
          {liveOdds.length > 0 && (
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6 ring-1 ring-amber-400/20">
              <h3 className="text-sm font-bold text-amber-400/80 uppercase tracking-widest mb-4 flex items-center justify-center gap-2"><span className="text-amber-400/50">📈</span> {['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(match?.status?.short) ? 'Live Cuotas' : 'Cuotas Pre-Partido'}</h3>
              <div className="space-y-4">
                {(() => {
                  let markets = [];
                  if (liveOdds[0]?.odds) {
                    // LIVE ODDS FORMAT
                    // Prioritize specific IDs (1: Match Winner, 23: Final Score, etc.) then rest, limit to 10
                    markets = liveOdds[0].odds.slice(0, 10); 
                  } else if (liveOdds[0]?.bookmakers) {
                    // PRE MATCH FORMAT
                    markets = liveOdds[0].bookmakers[0]?.bets?.slice(0, 10) || [];
                  }

                  if (markets.length === 0) return <div className="text-center text-xs text-white/40">No hay cuotas disponibles</div>;

                  // Fallback if index gets out of bounds during a live update
                  const currentIndex = activeOddsMarketIndex < markets.length ? activeOddsMarketIndex : 0;
                  const currentMarket = markets[currentIndex];

                  return (
                    <div className="space-y-4">
                      {/* Market Selector Tabs (Horizontal Scroll) */}
                      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
                        {markets.map((market, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setActiveOddsMarketIndex(idx)}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${currentIndex === idx ? 'bg-amber-500 text-black shadow-lg' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                          >
                            {tMarket(market.name)}
                          </button>
                        ))}
                      </div>

                      {/* Active Market Content */}
                      <m.div 
                         key={currentIndex}
                         initial={{ opacity: 0, x: -10 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ duration: 0.2 }}
                         className="bg-white/[0.02] rounded-xl p-3 md:p-4 border border-white/5"
                      >
                        <div className="flex flex-wrap gap-2 justify-center">
                          {(currentMarket.values || []).filter(v => v.odd).slice(0, 12).map((val, i) => (
                             <div key={i} className={`px-4 py-2 rounded-xl text-center border transition-all ${val.main ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/10 text-white/70'}`}>
                               <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5 opacity-70 truncate max-w-[100px]">{tOddValue(val.value)} {val.handicap || ''}</div>
                               <div className="text-sm font-black">{val.odd}</div>
                             </div>
                          ))}
                        </div>
                      </m.div>
                    </div>
                  );
                })()}
              </div>
              <div className="text-center mt-4 text-[9px] font-mono text-white/20 uppercase tracking-widest">
                 {liveOdds[0]?.bookmakers ? `Vía ${liveOdds[0].bookmakers[0]?.name}` : 'Live Odds Auto'}
              </div>
            </m.div>
          )}

          {/* Statistics */}
          {statistics.length >= 2 && (
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center justify-center gap-2"><span className="text-white/30">📊</span> Estadísticas</h3>
              <div className="space-y-4">
                {(statistics[0]?.statistics || []).map((stat, i) => {
                  const homeStat = stat;
                  const awayStat = statistics[1]?.statistics?.[i];
                  const homeVal = String(homeStat?.value ?? 0).replace('%', '');
                  const awayVal = String(awayStat?.value ?? 0).replace('%', '');
                  const homeNum = parseFloat(homeVal) || 0;
                  const awayNum = parseFloat(awayVal) || 0;
                  const total = homeNum + awayNum || 1;

                  return (
                    <div key={stat.type}>
                      <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                        <span className={`font-bold w-10 ${homeNum > awayNum ? 'text-emerald-400' : homeNum < awayNum ? 'text-white/50' : 'text-white'}`}>{homeStat?.value ?? 0}</span>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-white/30 text-center flex-1">{tStat(stat.type)}</span>
                        <span className={`font-bold w-10 text-right ${awayNum > homeNum ? 'text-emerald-400' : awayNum < homeNum ? 'text-white/50' : 'text-white'}`}>{awayStat?.value ?? 0}</span>
                      </div>
                      <div className="flex gap-1.5 h-2">
                        <div className="rounded-full flex-1 flex justify-end overflow-hidden bg-white/5">
                           <div className="h-full rounded-full transition-all duration-1000" style={{ 
                             width: `${(homeNum / total) * 100}%`, 
                             background: homeNum > awayNum ? 'rgb(52, 211, 153)' : homeNum === awayNum ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)' 
                           }} />
                        </div>
                        <div className="rounded-full flex-1 overflow-hidden bg-white/5">
                           <div className="h-full rounded-full transition-all duration-1000" style={{ 
                             width: `${(awayNum / total) * 100}%`, 
                             background: awayNum > homeNum ? 'rgb(52, 211, 153)' : awayNum === homeNum ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)' 
                           }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </m.div>
          )}

          {/* Injuries / Hospital */}
          {injuries.length > 0 && (
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center justify-center gap-2"><span className="text-white/30">🏥</span> Enfemería / Bajas</h3>
              <div className="relative flex justify-between gap-2 md:gap-6">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2" />
                
                {/* Home Injuries */}
                <div className="w-1/2 pr-2 md:pr-4 space-y-3 md:space-y-4">
                  <div className="text-[9px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 md:mb-3 border-b border-white/10 pb-1 md:pb-2 truncate">{teams?.home?.name}</div>
                  {injuries.filter(i => i.team.id === teams?.home?.id).map((inj, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 md:gap-2">
                       <div className="w-5 h-5 md:w-8 md:h-8 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10">
                         <img src={`https://media.api-sports.io/football/players/${inj.player.id}.png`} alt="" loading="lazy" width={20} height={20} className="w-full h-full object-cover bg-white/10" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                         <div className="w-full h-full items-center justify-center text-[9px] md:text-[10px] font-bold text-white/50" style={{display:'none'}}>{inj.player.name[0]}</div>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="text-[10px] md:text-xs font-bold text-white truncate leading-tight">{inj.player.name}</div>
                         <div className={`text-[8px] md:text-[9px] uppercase tracking-wider font-bold truncate ${inj.player.type === 'Missing Fixture' ? 'text-red-400' : 'text-amber-400'}`}>
                           {tInjury(inj.player.reason?.split('(')[0]?.trim()) || tInjury(inj.player.type) || 'En duda'}
                         </div>
                       </div>
                    </div>
                  ))}
                  {injuries.filter(i => i.team.id === teams?.home?.id).length === 0 && <span className="text-[9px] md:text-[10px] text-white/20 italic block">Plantel a disp.</span>}
                </div>
                {/* Away Injuries */}
                <div className="w-1/2 pl-2 md:pl-4 space-y-3 md:space-y-4">
                  <div className="text-[9px] md:text-[10px] text-right font-bold text-white/40 uppercase tracking-widest mb-2 md:mb-3 border-b border-white/10 pb-1 md:pb-2 truncate">{teams?.away?.name}</div>
                  {injuries.filter(i => i.team.id === teams?.away?.id).map((inj, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 md:gap-2 flex-row-reverse text-right">
                       <div className="w-5 h-5 md:w-8 md:h-8 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10">
                         <img src={`https://media.api-sports.io/football/players/${inj.player.id}.png`} alt="" loading="lazy" width={20} height={20} className="w-full h-full object-cover bg-white/10" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                         <div className="w-full h-full items-center justify-center text-[9px] md:text-[10px] font-bold text-white/50" style={{display:'none'}}>{inj.player.name[0]}</div>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="text-[10px] md:text-xs font-bold text-white truncate leading-tight">{inj.player.name}</div>
                         <div className={`text-[8px] md:text-[9px] uppercase tracking-wider font-bold truncate ${inj.player.type === 'Missing Fixture' ? 'text-red-400' : 'text-amber-400'}`}>
                           {tInjury(inj.player.reason?.split('(')[0]?.trim()) || tInjury(inj.player.type) || 'En duda'}
                         </div>
                       </div>
                    </div>
                  ))}
                  {injuries.filter(i => i.team.id === teams?.away?.id).length === 0 && <span className="text-[9px] md:text-[10px] text-white/20 italic block text-right">Plantel a disp.</span>}
                </div>
              </div>
            </m.div>
          )}

          {/* Events Timeline */}
          {events.length > 0 && (
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center justify-center gap-2"><span className="text-white/30">⚡</span> Cronología</h3>
              <div className="relative flex flex-col space-y-3 py-2">
                {/* Central Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2" />
                
                {events.map((e, i) => {
                  const isHome = e.team.id === teams?.home?.id;
                  let icon = '📌';
                  let bg = 'bg-white/10';
                  let border = 'border-white/5';
                  let textColor = 'text-white/90';
                  
                  if (e.type === 'Goal') { icon = e.detail === 'Own Goal' ? '🔴' : '⚽'; bg = 'bg-emerald-500/20'; border = 'border-emerald-500/50'; textColor = 'text-emerald-400'; }
                  if (e.type === 'Card') { 
                    icon = e.detail === 'Yellow Card' ? '🟨' : '🟥'; 
                    bg = 'bg-white/5';
                    if (e.detail === 'Red Card' || e.detail === 'Second Yellow card') {
                      bg = 'bg-red-500/20'; border = 'border-red-500/50'; textColor = 'text-red-400';
                    }
                  }
                  if (e.type === 'subst') { icon = '🔄'; bg = 'bg-white/5'; }
                  if (e.type === 'Var') { icon = '📺'; bg = 'bg-purple-500/20'; border = 'border-purple-500/30'; }

                  return (
                    <div key={i} className={`flex w-full ${isHome ? 'justify-start' : 'justify-end'} relative`}>
                      {/* Central Dot */}
                      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] border border-white/20 bg-[#0f1115] z-10 shadow-lg ${bg}`}>
                        {icon}
                      </div>

                      {/* Content Box */}
                      <div className={`w-[46%] flex flex-col ${isHome ? 'items-end text-right' : 'items-start text-left'}`}>
                        <div className={`bg-white/[0.02] border ${border} rounded-xl p-2 md:p-3 inline-block max-w-full`}>
                          <div className={`flex items-center gap-1.5 mb-1 ${isHome ? 'justify-end' : 'justify-start'}`}>
                            {isHome && e.type === 'Goal' && <span className="text-[10px] uppercase font-bold text-emerald-500/50 hidden md:block">GOL</span>}
                            {isHome && (e.detail === 'Red Card' || e.detail === 'Second Yellow card') && <span className="text-[10px] uppercase font-bold text-red-500/50 hidden md:block">ROJA</span>}
                            <span className="text-[10px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                              {e.time.elapsed}'{e.time.extra ? `+${e.time.extra}` : ''}
                            </span>
                            {!isHome && e.type === 'Goal' && <span className="text-[10px] uppercase font-bold text-emerald-500/50 hidden md:block">GOL</span>}
                            {!isHome && (e.detail === 'Red Card' || e.detail === 'Second Yellow card') && <span className="text-[10px] uppercase font-bold text-red-500/50 hidden md:block">ROJA</span>}
                          </div>
                          <div className="flex flex-col">
                             <span className={`text-xs md:text-sm font-bold ${textColor}`}>{e.player?.name}</span>
                             {e.type === 'subst' && e.assist?.name && (
                               <span className="text-xs text-white/60 mt-0.5">x {e.assist.name}</span>
                             )}
                             {e.type === 'Goal' && e.assist?.name && (
                               <span className="text-xs text-white/60 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Asistencia: {e.assist.name}</span>
                             )}
                             {e.detail && e.type !== 'subst' && e.detail !== 'Normal Goal' && (
                               <span className="text-xs text-amber-400/90 mt-0.5">{tEvent(e.detail)}</span>
                             )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </m.div>
          )}

          {/* No data */}
          {events.length === 0 && statistics.length === 0 && lineups.length === 0 && !isLive && (
            <div className="glass-card rounded-3xl p-8 text-center text-white/40 border border-white/5">
              <p>Esperando datos del partido...</p>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Away Lineup */}
        {lineups.length >= 2 && (
          <div className={`lg:col-span-3 lg:border-none lg:block lg:order-3 ${activeLineupTab === 'away' ? 'block order-1' : 'hidden'}`}>
            <LineupCard lineup={lineups[1]} align="right" navigate={navigate} />
          </div>
        )}

      </div>
    </div>
  );
}

// Subcomponent for Lineup Card
const LineupCard = memo(function LineupCard({ lineup, align, navigate }) {
  let hasGrid = false;
  const gridRows = {};

  (lineup.startXI || []).forEach(p => {
    if (p.player?.grid) {
      hasGrid = true;
      const [row] = p.player.grid.split(':');
      if (!gridRows[row]) gridRows[row] = [];
      gridRows[row].push(p);
    }
  });

  // Both Home (left) and Away (right) attack UP, so GK (row 1) is at the bottom (last in flex-col). Sort: 4, 3, 2, 1
  const sortedRows = Object.keys(gridRows).sort((a, b) => Number(b) - Number(a));

  return (
    <m.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-3xl p-5 border border-white/5">
      <div className={`flex items-center gap-3 mb-5 pb-4 border-b border-white/5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {lineup.team?.logo && <img src={lineup.team.logo} alt="" width={40} height={40} className="w-10 h-10 object-contain drop-shadow-lg" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
        <div className={`flex-1 ${align === 'right' ? 'text-right' : ''}`}>
          <div className="text-base font-black text-white tracking-tight">{lineup.team?.name}</div>
          {lineup.formation && <div className="text-[10px] text-amber-400 font-mono tracking-widest bg-amber-400/10 px-2 py-0.5 rounded-full inline-block mt-1">{lineup.formation}</div>}
        </div>
      </div>

      {lineup.coach && (
        <div className={`flex items-center gap-2 mb-5 px-1 bg-white/[0.02] rounded-xl p-2 border border-white/5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {lineup.coach.photo ? (
            <img src={lineup.coach.photo} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover border border-white/10" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50 border border-white/5">DT</div>
          )}
          <div className={`${align === 'right' ? 'text-right mr-2' : 'ml-2'}`}>
             <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-0.5">Entrenador</div>
             <div className="text-xs font-semibold text-white/80">{lineup.coach.name}</div>
          </div>
        </div>
      )}

      <div className={`text-xs text-white/50 uppercase tracking-widest mb-3 font-semibold px-2 ${align === 'right' ? 'text-right' : ''}`}>Titulares</div>
      
      {hasGrid ? (
        <div className="relative w-full max-w-[400px] mx-auto aspect-[4/5] bg-emerald-700/80 rounded-2xl overflow-hidden mb-6 border-2 border-white/20 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] flex flex-col justify-between py-6 group/pitch"
          style={{ 
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(255,255,255,0.05) 10%, rgba(255,255,255,0.05) 20%)`
          }}>
          
          {/* Pitch Markings */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
             {/* Pitch (Attacking UP) -> Center line at TOP, Penalty at BOTTOM */}
             <>
               <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] aspect-square border-2 border-white rounded-full bg-transparent" />
               <div className="absolute top-0 w-full border-t-2 border-white" />
               
               <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[50%] h-[20%] border-2 border-b-0 border-white" />
               <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[20%] h-[8%] border-2 border-b-0 border-white" />
             </>
          </div>

          {/* Render Players */}
          {sortedRows.map(rowNum => (
             <div key={rowNum} className="relative z-10 flex justify-around w-full px-4">
                {gridRows[rowNum].map((p, index) => {
                   // Clean up name: first letter of first name + last name
                   const names = p.player.name.split(' ');
                   const shortName = names.length > 1 ? `${names[0][0]}. ${names.pop()}` : p.player.name;
                   
                   return (
                     <m.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={p.player.id} 
                        className="flex flex-col items-center cursor-pointer group/player" 
                        onClick={() => p.player?.id && navigate(`/jugador/${p.player.id}`)}
                     >
                        <div className="relative">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 z-10 relative transition-transform overflow-hidden group-hover/player:scale-110 group-hover/player:-translate-y-1 ${align === 'right' ? 'border-indigo-400 bg-indigo-400/20' : 'border-white bg-white/20'}`}>
                             <img 
                               src={`https://media.api-sports.io/football/players/${p.player.id}.png`} 
                               alt={shortName}
                               loading="lazy"
                               className="w-full h-full object-cover bg-white"
                               onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                               }}
                             />
                             <div className="absolute inset-0 items-center justify-center text-xs font-bold text-black bg-white" style={{ display: 'none' }}>
                                {p.player.number || '-'}
                             </div>
                          </div>
                          {/* Number Badge */}
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white/20 z-20">
                             {p.player.number || '-'}
                          </div>
                          {/* Dot below the player */}
                          <div className="w-5 h-1 bg-black/50 blur-[2px] rounded-full absolute -bottom-1 left-1/2 -translate-x-1/2 z-0" />
                        </div>
                        
                        <div className="mt-1.5 text-[9px] text-white font-bold bg-black/70 px-2 py-0.5 rounded-full backdrop-blur-md max-w-[85px] truncate text-center shadow-md border border-white/10 group-hover/player:bg-indigo-600 transition-colors">
                           {shortName}
                        </div>
                     </m.div>
                   );
                })}
             </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 mb-6">
          {(lineup.startXI || []).map((p, pi) => (
            <div key={pi} onClick={() => p.player?.id && navigate(`/jugador/${p.player.id}`)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-all border border-transparent hover:border-white/5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
               <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-mono font-bold text-white/50 shrink-0 shadow-inner">
                 {p.player?.number}
               </div>
               <span className={`text-xs font-medium text-white/90 truncate flex-1 ${align === 'right' ? 'text-right' : ''}`}>{p.player?.name}</span>
               <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest w-8 text-center">{p.player?.pos}</span>
            </div>
          ))}
        </div>
      )}

      {(lineup.substitutes || []).length > 0 && (
        <>
          <div className={`text-xs text-white/50 uppercase tracking-widest mt-4 mb-3 font-semibold px-2 ${align === 'right' ? 'text-right' : ''}`}>Suplentes</div>
          <div className="space-y-1">
            {(lineup.substitutes || []).map((p, pi) => (
              <div key={pi} onClick={() => p.player?.id && navigate(`/jugador/${p.player.id}`)}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-all ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                 <span className="w-7 text-center text-xs font-mono text-white/40 shrink-0">{p.player?.number}</span>
                 <span className={`text-xs text-white/70 truncate flex-1 ${align === 'right' ? 'text-right' : ''}`}>{p.player?.name}</span>
                 <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest w-8 text-center">{p.player?.pos}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </m.div>
  );
});
