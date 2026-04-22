import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import PitchView from '../components/fantasy/PitchView';
import '../components/fantasy/FantasyTeam.css';
import { Save, Search, UserPlus, Trash2, Calendar, X } from 'lucide-react';

function FantasyTeam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  
  const [team, setTeam] = useState(null);
  const [league, setLeague] = useState(null);
  const [activeGw, setActiveGw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!activeGw || !activeGw.startDate) return;
    if (!activeGw.transfersOpen) {
      setCountdown("Cerrado");
      return;
    }
    
    const calculateCountdown = () => {
      const now = new Date();
      const start = new Date(activeGw.startDate);
      const diff = start - now;
      if (diff <= 0) return "Cerrando...";
      
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
    };

    setCountdown(calculateCountdown());
    const interval = setInterval(() => setCountdown(calculateCountdown()), 60000);
    return () => clearInterval(interval);
  }, [activeGw]);

  // Draft State
  const [draftPicks, setDraftPicks] = useState([]);
  const [budgetRemaining, setBudgetRemaining] = useState(100.0);
  const [isSaving, setIsSaving] = useState(false);

  // Market State
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [positionFilter, setPositionFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextFixtures, setNextFixtures] = useState([]);

  // Drawer State
  const [showFixturesDrawer, setShowFixturesDrawer] = useState(false);
  const [showMarketDrawer, setShowMarketDrawer] = useState(false);

  useEffect(() => {
     if (showFixturesDrawer || showMarketDrawer) {
        document.body.style.overflow = 'hidden';
     } else {
        document.body.style.overflow = 'unset';
     }
     return () => { document.body.style.overflow = 'unset'; };
  }, [showFixturesDrawer, showMarketDrawer]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [resTeam, resDetails, resGw, resFix] = await Promise.all([
         api.get(`/fantasy/my-team/${id}`),
         api.get(`/fantasy/leagues/${id}/details`),
         api.get(`/fantasy/leagues/${id}/gameweeks/active`).catch(() => ({ data: null })),
         api.get(`/fantasy/leagues/${id}/next-fixtures`).catch(() => ({ data: [] }))
      ]);

      setTeam(resTeam.data);
      setLeague(resDetails.data);
      setActiveGw(resGw.data);
      setNextFixtures(resFix.data);
      
      const initialPicks = resTeam.data?.picks || [];
      setDraftPicks(initialPicks);
      
      // Calculate remaining budget natively
      const spent = initialPicks.reduce((acc, p) => acc + (p.purchasePrice || 0), 0);
      setBudgetRemaining(100.0 - spent);
      
      // Fetch teams and initial players based on the real league
      api.get(`/fantasy/teams?leagueId=${resDetails.data.leagueId}`).then(r => setLeagueTeams(r.data)).catch(console.error);
      fetchPlayers(resDetails.data.leagueId, '', '');
    } catch(err) {
      console.error(err);
      useToastStore.getState().addToast({ type: 'error', message: 'Hubo un error cargando tus datos. ¿Estás en esta liga?' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async (realLeagueId, posObj, teamObj, searchObj) => {
    setLoadingPlayers(true);
    try {
      const query = new URLSearchParams({ leagueId: realLeagueId });
      if (posObj) query.append('position', posObj);
      if (teamObj) query.append('teamId', teamObj);
      if (searchObj) query.append('search', searchObj);
      const { data } = await api.get(`/fantasy/players?${query.toString()}`);
      setPlayers(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handlePositionClick = (pos) => {
     setPositionFilter(pos);
     fetchPlayers(league?.leagueId, pos, teamFilter, searchQuery);
  };
  
  const handleTeamChange = (e) => {
     const tId = e.target.value;
     setTeamFilter(tId);
     fetchPlayers(league?.leagueId, positionFilter, tId, searchQuery);
  };

  useEffect(() => {
     if (!league) return;
     const delay = setTimeout(() => {
        fetchPlayers(league.leagueId, positionFilter, teamFilter, searchQuery);
     }, 400);
     return () => clearTimeout(delay);
  }, [searchQuery]);

  const [selectedFormation, setSelectedFormation] = useState('4-4-2');

  // Click handler from PitchView overrides to "Remove"
  const handlePitchPlayerClick = (p) => {
     if (p.isDummy) {
        setPositionFilter(p.playerPosition);
        setTimeout(() => {
           document.getElementById('marketSearchInput')?.focus();
        }, 100);
        if (window.innerWidth < 1024) {
           setShowMarketDrawer(true);
        }
        return;
     }

     if (!activeGw?.transfersOpen && draftPicks.length > 0 && team?.picks?.length > 0) {
        useToastStore.getState().addToast({ type: 'error', message: 'Mercado cerrado, cambios deshabilitados.' });
        return;
     }

     setDraftPicks(draftPicks.filter(draft => draft.playerId !== p.playerId));
     setBudgetRemaining(prev => prev + p.purchasePrice);
  };

  const handleSignPlayer = (p) => {
     // Validate duplicates
     if (draftPicks.find(draft => draft.playerId === p.sportmonksId)) {
        useToastStore.getState().addToast({ type: 'warning', message: 'Este jugador ya está en tu equipo.' });
        return;
     }

     // Evaluar límites dinámicos en base a la formación elegida (ignorar suplentes temporalmente, total 11)
     const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0, ATT: 0 };
     draftPicks.forEach(draft => {
        counts[draft.playerPosition === 'ATT' ? 'FWD' : draft.playerPosition]++;
     });
     
     const mappedPos = p.position === 'ATT' ? 'FWD' : p.position;
     
     const [def, mid, fwd] = selectedFormation.split('-').map(Number);
     const maxLimits = { GK: 1, DEF: def, MID: mid, FWD: fwd };

     if (counts[mappedPos] >= maxLimits[mappedPos]) {
        useToastStore.getState().addToast({ type: 'error', message: `Límite alcanzado para la posición ${mappedPos} en tu formación ${selectedFormation}.` });
        return;
     }

     if (draftPicks.length >= 11) {
        useToastStore.getState().addToast({ type: 'error', message: 'Tu equipo titular está completo.' });
        return;
     }

     setDraftPicks([...draftPicks, {
        playerId: p.sportmonksId,
        playerName: p.name,
        playerPosition: mappedPos,
        purchasePrice: p.price,
        isBenched: false // Sin suplentes por ahora
     }]);
     setBudgetRemaining(prev => prev - p.price);
  };

  const handleSaveDraft = async () => {
     setIsSaving(true);
     try {
       await api.post(`/fantasy/my-team/${id}`, {
          picks: draftPicks.map(p => ({
             playerId: p.playerId,
             isCaptain: p.isCaptain || false,
             isViceCaptain: p.isViceCaptain || false,
             isBenched: false
          }))
       });
       useToastStore.getState().addToast({ type: 'success', message: 'Alineación oficializada y blindada.' });
       fetchData(); // Reload perfectly
     } catch (err) {
       useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al guardar.' });
     } finally {
       setIsSaving(false);
     }
  };

  if (loading) return <div className="page-container loading-state">Abriendo vestuarios...</div>;
  if (!team) return <div className="page-container" style={{ textAlign: 'center', padding: '4rem' }}><h2>No tenés equipo en esta liga</h2></div>;

  const isComplete = draftPicks.length === 11;

  return (
    <div className="page-container fade-in" style={{ padding: '1rem', maxWidth: '1600px', margin: '0 auto' }}>
       {/* HUD */}
       <div className="glass-panel p-4 mb-4 flex flex-col gap-4 rounded-2xl">
          <div className="flex flex-wrap justify-between items-center gap-4 text-center sm:text-left">
            {activeGw && (
              <div className="flex flex-col items-center sm:items-start w-full sm:w-1/3">
                <span className="text-white/50 text-xs uppercase tracking-widest font-bold mb-1">
                  Gameweek {activeGw.gameweekNumber}
                </span>
                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border ${activeGw.transfersOpen ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                  <div className={`w-2 h-2 rounded-full ${activeGw.transfersOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                  {activeGw.transfersOpen ? `Cierra en: ${countdown}` : 'Mercado Cerrado'}
                </div>
              </div>
            )}
            
            <div className="flex flex-col flex-1 items-center justify-center min-w-[200px]">
              <span className="text-white/50 text-xs uppercase tracking-widest font-bold">Manager</span>
              <strong className="text-2xl text-white font-black">{team.name}</strong>
            </div>
            
            <div className="flex flex-col items-center sm:items-end w-full sm:w-1/3">
              <span className="text-white/50 text-xs uppercase tracking-widest font-bold">Puntos Totales</span>
              <strong className="text-3xl text-emerald-400 font-mono font-black">{team.totalPoints}</strong>
            </div>
          </div>
       </div>

       <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {/* BOTÓN MÓVIL PARA FIXTURES */}
          <button 
             onClick={() => setShowFixturesDrawer(true)}
             className="lg:hidden fixed left-0 top-[60%] -translate-y-1/2 z-40 bg-black/60 backdrop-blur-md text-white/70 p-2.5 rounded-r-xl shadow-lg border border-l-0 border-white/10 hover:text-white transition-all hover:bg-black/90 flex items-center justify-center"
             title="Partidos de la Fecha"
          >
             <Calendar size={16} />
          </button>

          {/* OVERLAY Y DRAWER MÓVIL PARA FIXTURES */}
          {showFixturesDrawer && (
             <div className="lg:hidden fixed inset-0 bg-black/80 z-50 flex" onClick={() => setShowFixturesDrawer(false)}>
                <div 
                   className="w-[85vw] max-w-[320px] h-full bg-black border-r border-white/10 p-4 flex flex-col shadow-2xl animate-fade-in"
                   onClick={e => e.stopPropagation()}
                >
                   <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
                      <h3 className="font-bold text-white flex items-center gap-2">  
                        Fixture GW {activeGw?.gameweekNumber}
                      </h3>
                      <button onClick={() => setShowFixturesDrawer(false)} className="bg-white/5 p-1 rounded-lg text-white/50 hover:text-white">
                         <X size={20} />
                      </button>
                   </div>
                   <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
                      {nextFixtures && nextFixtures.length > 0 ? (
                        nextFixtures.map(f => {
                            const hTeam = leagueTeams.find(t => t.teamId === f.homeTeamId)?.teamName || `Local (${f.homeTeamId})`;
                            const aTeam = leagueTeams.find(t => t.teamId === f.awayTeamId)?.teamName || `Visitante (${f.awayTeamId})`;
                            return (
                              <div key={f.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                                <div className="flex justify-between items-center text-xs font-bold text-white/90">
                                   <span className="truncate w-2/5 text-left" title={hTeam}>{hTeam}</span>
                                   <span className="bg-black/40 text-white/50 px-1.5 py-0.5 rounded text-[10px] font-black border border-white/5 shadow-inner">VS</span>
                                   <span className="truncate w-2/5 text-right" title={aTeam}>{aTeam}</span>
                                </div>
                                <div className="text-[10px] text-white/40 text-center font-mono bg-black/20 rounded p-1">
                                   {new Date(f.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              </div>
                            );
                        })
                      ) : (
                        <div className="text-center text-white/30 text-sm py-4">Sin partidos programados.</div>
                      )}
                   </div>
                </div>
             </div>
          )}

          {/* COLUMNA 1: FIXTURES (Desktop Solo) */}
          <div className="hidden lg:flex w-full lg:w-[380px] flex-shrink-0 glass-panel bg-black/40 rounded-2xl flex-col h-[800px] overflow-hidden sticky top-4">
             <div className="p-4 border-b border-white/5 bg-black/20 h-[72px] flex items-center justify-center sm:justify-start">
                <h3 className="font-bold text-white text-sm m-0">Fixture GW {activeGw?.gameweekNumber}</h3>
             </div>
             <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 p-4">
                {nextFixtures && nextFixtures.length > 0 ? (
                  nextFixtures.map(f => {
                      const hTeam = leagueTeams.find(t => t.teamId === f.homeTeamId)?.teamName || `Local (${f.homeTeamId})`;
                      const aTeam = leagueTeams.find(t => t.teamId === f.awayTeamId)?.teamName || `Visitante (${f.awayTeamId})`;
                      return (
                        <div key={f.id} className="bg-white/5 hover:bg-white/10 transition-colors p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-xs font-bold text-white/90">
                             <span className="truncate w-2/5 text-left" title={hTeam}>{hTeam}</span>
                             <span className="bg-black/40 text-white/50 px-1.5 py-0.5 rounded text-[10px] font-black border border-white/5 shadow-inner">VS</span>
                             <span className="truncate w-2/5 text-right" title={aTeam}>{aTeam}</span>
                          </div>
                          <div className="text-[10px] text-white/40 text-center font-mono bg-black/20 rounded p-1">
                             {new Date(f.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                      );
                  })
                ) : (
                  <div className="text-center text-white/30 text-sm py-4">Sin partidos programados.</div>
                )}
             </div>
          </div>
          {/* COLUMNA 2: PITCH (Center Flex-none) */}
          <div className="w-full lg:w-[480px] flex-shrink-0 flex flex-col gap-4">
             <div className="glass-panel bg-black/20 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col h-[800px]">
                {/* Save Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3 sm:p-4 border-b border-white/5 bg-black/20 h-auto sm:h-[72px]">
                   <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-4">
                      <div className="text-white/70 text-xs sm:text-sm font-semibold">
                         {draftPicks.length} / 11 <span className="hidden sm:inline">Jugadores</span>
                      </div>
                      <select 
                         value={selectedFormation} 
                         onChange={(e) => {
                            if (draftPicks.length > 0) {
                               useToastStore.getState().addToast({ type: 'warning', message: 'Vaciá tu equipo para cambiar táctica.' });
                            } else {
                               setSelectedFormation(e.target.value);
                            }
                         }}
                         className="bg-black/40 border border-white/10 rounded-md px-2 sm:px-3 py-1 text-white text-[11px] sm:text-xs font-bold"
                      >
                         <option value="4-4-2">Táctica 4-4-2</option>
                         <option value="4-3-3">Táctica 4-3-3</option>
                         <option value="3-5-2">Táctica 3-5-2</option>
                         <option value="3-4-3">Táctica 3-4-3</option>
                         <option value="5-3-2">Táctica 5-3-2</option>
                      </select>
                   </div>
                   <button 
                      disabled={isSaving || draftPicks.length !== 11}
                      onClick={handleSaveDraft}
                      className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2 transition"
                   >
                     {isSaving ? 'Guardando...' : <><Save size={16}/> Guardar</>}
                   </button>
                </div>
                
                {/* Leyenda Instrictiva */}
                {draftPicks.length < 11 && (
                   <div className="bg-indigo-500/10 border-b border-indigo-500/20 py-2 flex items-center justify-center gap-2">
                      <span className="flex h-4 w-4 bg-indigo-500 rounded-full animate-ping absolute opacity-20"></span>
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide relative">
                         👆 Tocá un hueco libre para reclutar en esa posición
                      </span>
                   </div>
                )}

                {/* The Pitch */}
                <PitchView 
                   squad={draftPicks} 
                   onPlayerClick={handlePitchPlayerClick}
                   activeGameweek={activeGw}
                   formation={selectedFormation}
                />
             </div>
          </div>
          
          {/* COLUMNA 3: MARKET PANEL (Right Side Flexing OR Mobile Modal) */}
          <div 
             className={`${showMarketDrawer ? 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in' : 'hidden lg:flex flex-1 min-w-[300px] flex-col'}`}
             onClick={() => showMarketDrawer && setShowMarketDrawer(false)}
          >
            <div 
               className={`glass-panel rounded-2xl flex flex-col overflow-hidden ${showMarketDrawer ? 'w-full max-w-[400px] h-[85vh] relative bg-[#1a1c23]' : 'h-[800px] bg-black/40'}`}
               onClick={e => e.stopPropagation()}
            >
               {showMarketDrawer && (
                  <button onClick={() => setShowMarketDrawer(false)} className="lg:hidden absolute top-4 right-4 z-50 bg-white/10 p-1.5 rounded-lg text-white/50 hover:text-white">
                     <X size={20} />
                  </button>
               )}
               <div className="p-4 border-b border-white/5 bg-black/20 h-[72px] flex items-center">
                 <h3 className="font-bold text-white text-sm m-0 flex items-center gap-2">
                    🛒 Director Deportivo
                 </h3>
               </div>
               
               <div className="p-4 border-b border-white/5">
                 <div className="relative mb-3 flex gap-2">
                    <div className="relative flex-1">
                       <Search className="absolute left-3 top-2.5 text-white/40" size={18} />
                       <input id="marketSearchInput"
                          type="text" 
                          placeholder="Buscar..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                       />
                    </div>
                    <select 
                       value={teamFilter} 
                       onChange={handleTeamChange} 
                       className="bg-black/30 border border-white/10 rounded-xl px-2 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 w-1/3"
                    >
                       <option value="">Equipo</option>
                       {leagueTeams.map(t => (
                          <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
                       ))}
                    </select>
                 </div>
                 <div className="flex justify-between gap-1 bg-black/40 p-1 rounded-lg">
                    {['', 'GK', 'DEF', 'MID', 'FWD'].map(pos => (
                       <button 
                          key={pos}
                          onClick={() => handlePositionClick(pos)}
                          className={`flex-1 text-xs font-bold py-1.5 rounded-md transition ${positionFilter === pos ? 'bg-indigo-500 text-white shadow-md' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                       >
                          {pos === '' ? 'TODOS' : pos}
                       </button>
                    ))}
                 </div>
               </div>

                 <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                   {loadingPlayers ? (
                      <div className="text-center text-white/40 py-10 animate-pulse">Analizando agentes libres...</div>
                   ) : players.length === 0 ? (
                      <div className="text-center text-white/40 py-10 text-sm">No se encontraron jugadores.</div>
                   ) : (
                      <React.Fragment>
                         {(!searchQuery.trim() && players.length > 10) && (
                            <div className="text-center text-xs font-bold text-indigo-300 bg-indigo-500/20 py-2 rounded-lg mb-2">
                               Usá el buscador para ver más jugadores
                            </div>
                         )}
                         {(searchQuery.trim() ? players : players.slice(0, 10)).map(p => {
                            const inDraft = draftPicks.find(d => d.playerId === p.sportmonksId);
                            
                            let matchBadge = null;
                            if (activeGw?.fixtures && activeGw.transfersOpen) {
                              const f = activeGw.fixtures.find(fix => fix.homeTeamId === p.teamId || fix.awayTeamId === p.teamId);
                              if (f) {
                                const isHome = f.homeTeamId === p.teamId;
                                const oppId = isHome ? f.awayTeamId : f.homeTeamId;
                                const oppName = leagueTeams.find(t => t.teamId === oppId)?.teamName || 'Rival';
                                matchBadge = <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 ml-2" title={`vs ${oppName}`}>vs {oppName.substring(0, 3).toUpperCase()} {isHome ? '(L)' : '(V)'}</span>;
                              } else {
                                matchBadge = <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 ml-2 font-bold">SIN PARTIDO</span>;
                              }
                            }
    
                            return (
                               <div key={p.sportmonksId} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${inDraft ? 'bg-white/5 border-emerald-500/30' : 'bg-black/20 border-white/5 hover:bg-white/10'}`}>
                                  <div>
                                     <h4 className="text-white font-bold text-sm leading-tight flex items-center">{p.name} {matchBadge}</h4>
                                     <div className="flex items-center gap-2 text-xs font-semibold mt-1">
                                        <span className={`px-2 py-0.5 rounded text-white/90 bg-white/5 border border-white/10`}>{p.position}</span>
                                     </div>
                                  </div>
                                  {inDraft ? (
                                     <button onClick={() => {
                                          handlePitchPlayerClick({ playerId: p.sportmonksId, purchasePrice: p.price, isDummy: false });
                                     }} className="h-8 w-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition group">
                                        <Trash2 size={14} className="group-hover:scale-110" />
                                     </button>
                                  ) : (
                                     <button onClick={() => {
                                          handleSignPlayer(p);
                                          if (window.innerWidth < 1024) setShowMarketDrawer(false);
                                     }} disabled={isComplete} className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white disabled:opacity-30 transition group">
                                        <UserPlus size={14} className="group-hover:scale-110" />
                                     </button>
                                  )}
                               </div>
                            )
                         })}
                      </React.Fragment>
                   )}
                 </div>
            </div>
          </div>
       </div>
    </div>
  );
}

export default FantasyTeam;
