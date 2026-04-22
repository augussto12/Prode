import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Copy, Users, UserX, ShieldCheck, CheckCircle, ArrowRight, UserPlus, RefreshCw, Zap } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import './Fantasy.css'; // Reutilizamos base de hub

function FantasyLeague() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [activeGw, setActiveGw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState(false);
  const [recalcFixtureId, setRecalcFixtureId] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);
  
  // New States for Calendar UI
  const [activeTab, setActiveTab] = useState('standings'); // 'standings' | 'calendar'
  const [calendar, setCalendar] = useState([]);
  const [selectedGwNum, setSelectedGwNum] = useState(1);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // Usamos el axios wrapper preconfigurado
      const [resDetails, resStandings, resGw, resCal] = await Promise.all([
         api.get(`/fantasy/leagues/${id}/details`),
         api.get(`/fantasy/leagues/${id}/standings`),
         api.get(`/fantasy/leagues/${id}/gameweeks/active`).catch(() => ({ data: null })), // puede no haber fecha activa
         api.get(`/fantasy/leagues/${id}/calendar`).catch(() => ({ data: [] }))
      ]);

      setLeague(resDetails.data);
      setStandings(resStandings.data);
      setActiveGw(resGw.data);
      
      const calData = resCal.data || [];
      setCalendar(calData);
      
      // Auto-select the most relevant Gameweek for the calendar tab
      if (calData.length > 0) {
         const active = calData.find(gw => gw.status === 'IN_PROGRESS' || gw.status === 'SCHEDULED') || calData[calData.length - 1];
         setSelectedGwNum(active ? active.gameweekNumber : calData[0].gameweekNumber);
      }
    } catch(err) {
      console.error(err);
      useToastStore.getState().addToast({ type: 'error', message: 'No se pudo cargar la liga' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
     if (!league) return;
     navigator.clipboard.writeText(league.code);
     useToastStore.getState().addToast({ type: 'success', message: `Código ${league.code} copiado al portapapeles` });
  };

  const toggleBan = async (teamId, currentStatus) => {
     const isBanning = currentStatus === 'active';
     const verb = isBanning ? 'ban' : 'unban';
     try {
       await api.put(`/fantasy/leagues/${id}/teams/${teamId}/${verb}`);
       useToastStore.getState().addToast({ type: 'success', message: isBanning ? 'Usuario expulsado y congelado' : 'Usuario reincorporado' });
       fetchData(); // Reload standings so the banned user disappears
     } catch (err) {
       useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error de permisos' });
     }
  };

   const handleRecalculate = async (mode) => {
      setRecalculating(true);
      setRecalcResult(null);
      try {
        const url = mode === 'all'
           ? '/fantasy/admin/recalculate-all'
           : `/fantasy/admin/recalculate/${recalcFixtureId}`;
        const res = await api.post(url);
        setRecalcResult(res.data);
        useToastStore.getState().addToast({ type: 'success', message: res.data.message });
        fetchData();
      } catch (err) {
        setRecalcResult({ error: err.response?.data?.error || err.message });
        useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al recalcular' });
      } finally {
        setRecalculating(false);
      }
   };

  if (loading) return <div className="page-container flex items-center justify-center p-20 animate-pulse text-white/50">Cargando torneo...</div>;
  if (!league) return <div className="page-container text-center p-10 text-white font-bold">Torneo 404 No Encontrado</div>;

  const isOwner = league.ownerId === user?.id;

  return (
    <div className="page-container fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
       {/* HEADER */}
       <div className="glass-card rounded-2xl p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10 w-full md:w-3/4">
            <h1 className="text-3xl font-bold text-white mb-2">{league.name} <span className="text-xl text-white/40 font-normal">({league.realLeagueName})</span></h1>
            <p className="text-white/60 mb-1">{league.description || 'Torneo privado y competitivo de amigos.'}</p>
            <p className="text-emerald-400 text-sm font-semibold flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {activeGw ? `Fecha Actual: GW ${activeGw.gameweekNumber}` : 'Pretemporada / Sin torneo activo'}
              {activeGw && <span className="ml-2 px-2 py-0.5 rounded text-xs bg-black/30 border border-white/10 text-white/70">{activeGw.transfersOpen ? '🔓 Transferencias Abiertas' : '🔒 Mercado Cerrado'}</span>}
            </p>
          </div>
          <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto shrink-0">
            <Link to={`/fantasy/team/${id}`} className="bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
               Director Técnico <ArrowRight size={18} />
            </Link>
            {isOwner && (
               <button onClick={() => setAdminTab(!adminTab)} className={`py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${adminTab ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500' : 'bg-transparent border-white/10 text-white/70 hover:bg-white/5'}`}>
                 <ShieldCheck size={18} /> {adminTab ? 'Ocultar Panel' : 'Panel de Admin'}
               </button>
            )}
          </div>
       </div>

       {/* ADMIN PANEL */}
       {isOwner && adminTab && (
          <div className="glass-card rounded-2xl p-6 mb-8 border-indigo-500/20 animate-fade-in bg-gradient-to-br from-indigo-900/30 to-purple-900/10">
             <h2 className="text-xl font-bold text-indigo-400 mb-6 flex items-center gap-2">
               <ShieldCheck /> Herramientas de Administrador
             </h2>

             {/* Sección del Código */}
             <div className="bg-black/30 rounded-xl p-5 border border-white/5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
               <div>
                 <h3 className="text-white font-bold mb-1">Código de Invitación al Vestuario</h3>
                 <p className="text-white/50 text-sm">Copiá y enviá este pase secreto para reclutar rivales. Límite: {league.maxTeams} equipos.</p>
               </div>
               <div className="flex flex-col items-center">
                  <div className="text-3xl tracking-[0.2em] font-black text-amber-400 font-mono bg-white/5 px-6 py-3 rounded-lg border border-amber-400/20 mb-2">
                     {league.code}
                  </div>
                  <button onClick={handleCopyCode} className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                     <Copy size={14}/> Copiar
                  </button>
               </div>
             </div>

             {/* Gestión de Usuarios Baneados */}
             <div>
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><UserX size={18} className="text-red-400"/> Moderación de Participantes</h3>
                <p className="text-white/50 text-sm mb-4">Un equipo cancelado no aparecerá en las tablas generales de posiciones y no podrá ser operado dinámicamente.</p>
                <div className="bg-black/30 rounded-xl overflow-hidden border border-white/5">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="border-b border-white/5 text-xs text-white/50 uppercase">
                         <th className="p-3">Equipo</th>
                         <th className="p-3">Manager</th>
                         <th className="p-3">Estado</th>
                         <th className="p-3 text-right">Acción</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {league?.teams?.map(t => (
                         <tr key={t.id} className="hover:bg-white/5 transition-colors">
                           <td className="p-3 text-sm text-white font-bold">{t.name}</td>
                           <td className="p-3 text-sm text-white/70">@{t.user?.username}</td>
                           <td className="p-3">
                             {t.status === 'active' ? (
                               <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs">Activo</span>
                             ) : (
                               <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-xs">Bloqueado</span>
                             )}
                           </td>
                           <td className="p-3 text-right">
                              {t.status === 'active' ? (
                                <button onClick={() => toggleBan(t.id, t.status)} className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded transition">Bloquear</button>
                              ) : (
                                <button onClick={() => toggleBan(t.id, t.status)} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded transition">Reconectar</button>
                              )}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
             </div>

             {/* Herramientas de Scoring */}
             <div className="mt-6">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Zap size={18} className="text-amber-400"/> Motor de Puntuación</h3>
                <p className="text-white/50 text-sm mb-4">Recalculá puntos de todos los partidos pendientes o de uno específico si hubo correcciones de datos.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                   <button 
                      onClick={() => handleRecalculate('all')}
                      disabled={recalculating}
                      className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold px-4 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                   >
                      <RefreshCw size={16} className={recalculating ? 'animate-spin' : ''} /> {recalculating ? 'Procesando...' : 'Recalcular Todos los Pendientes'}
                   </button>
                   <div className="flex gap-2 flex-1">
                      <input
                         type="text"
                         placeholder="ID Fixture (ej: 19636312)"
                         value={recalcFixtureId}
                         onChange={e => setRecalcFixtureId(e.target.value)}
                         className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 flex-1"
                      />
                      <button 
                         onClick={() => handleRecalculate('single')}
                         disabled={recalculating || !recalcFixtureId}
                         className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-40 whitespace-nowrap"
                      >
                         <RefreshCw size={14} /> Recalcular
                      </button>
                   </div>
                </div>
                {recalcResult && (
                   <div className={`mt-3 p-3 rounded-lg text-sm ${recalcResult.error ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {recalcResult.error || recalcResult.message}
                   </div>
                )}
             </div>
          </div>
       )}

       {/* TABS */}
       <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
         <button onClick={() => setActiveTab('standings')} className={`px-4 py-2 font-bold rounded-xl transition-colors cursor-pointer ${activeTab === 'standings' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>Clasificación Posiciones</button>
         <button onClick={() => setActiveTab('calendar')} className={`px-4 py-2 font-bold rounded-xl transition-colors cursor-pointer ${activeTab === 'calendar' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>Fechas y Partidos</button>
       </div>

       {/* TAB: STANDINGS */}
       {activeTab === 'standings' && (
         <div className="glass-card rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="bg-white/5 p-5 border-b border-white/5">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Trophy className="text-amber-400" /> Clasificación Global
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-black/20 text-white/50 text-xs uppercase tracking-wider">
                     <th className="p-4 font-semibold">Pos</th>
                     <th className="p-4 font-semibold">Comandante</th>
                     <th className="p-4 font-semibold">Pts. Netos</th>
                     <th className="p-4 font-semibold">Billetera</th>
                     {isOwner && adminTab && <th className="p-4 font-semibold text-right">Moderación</th>}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {standings.map((team) => (
                      <tr key={team.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${team.rank === 1 ? 'bg-amber-400/20 text-amber-400 border border-amber-400/50' : team.rank === 2 ? 'bg-gray-300/20 text-gray-300 border border-gray-300/50' : team.rank === 3 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/50' : 'bg-white/5 text-white/70'}`}>
                             {team.rank}
                           </div>
                        </td>
                        <td className="p-4">
                           <div className="font-bold text-white">{team.name}</div>
                           <div className="text-xs text-white/40">@{team.user?.username}</div>
                        </td>
                        <td className="p-4">
                           <div className="text-lg font-black text-emerald-400">{team.totalPoints}</div>
                        </td>
                        <td className="p-4">
                           <div className="text-white/70 font-mono">${team.budgetRemaining?.toFixed(1)}M</div>
                        </td>
                        {isOwner && adminTab && (
                           <td className="p-4 text-right">
                             <button 
                               onClick={() => toggleBan(team.id, 'active')}
                               className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                             >
                               <UserX size={14}/> Descalificar
                             </button>
                           </td>
                        )}
                      </tr>
                   ))}
                 </tbody>
              </table>
              {standings.length === 0 && (
                 <div className="p-10 text-center flex flex-col items-center justify-center">
                    <UserPlus size={48} className="text-white/10 mb-4" />
                    <p className="text-white/50 text-lg">El estadio está vacío.</p>
                    <p className="text-white/30 text-sm mt-1">Comparte el código de incripción {isOwner ? 'arriba' : ''} para llenar las tribunas.</p>
                 </div>
              )}
            </div>
         </div>
       )}

       {/* TAB: CALENDAR */}
       {activeTab === 'calendar' && (
         <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">Calendario de Fechas</h2>
            
            {calendar.length > 0 ? (
              <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                {/* Header Switcher */}
                <div className="flex items-center justify-between p-4 bg-black/40 border-b border-white/5">
                   <button 
                      onClick={() => setSelectedGwNum(Math.max(1, selectedGwNum - 1))}
                      disabled={selectedGwNum === 1}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white font-bold"
                   >
                     &lt;
                   </button>

                   <div className="flex flex-col items-center">
                      <div className="text-white font-black tracking-wide uppercase">
                        Fecha {selectedGwNum}
                      </div>
                      {(() => {
                         const current = calendar.find(g => g.gameweekNumber === selectedGwNum);
                         if (!current) return null;
                         if (current.status === 'FINISHED') return <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded font-bold uppercase mt-1">Terminada</span>;
                         if (current.status === 'IN_PROGRESS') return <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold uppercase mt-1 animate-pulse">En Juego / Cerrado</span>;
                         if (current.status === 'SCHEDULED') return <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase mt-1">Próxima</span>;
                      })()}
                   </div>
                   
                   <button 
                      onClick={() => setSelectedGwNum(Math.min(calendar.length, selectedGwNum + 1))}
                      disabled={selectedGwNum === calendar.length}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white font-bold"
                   >
                     &gt;
                   </button>
                </div>

                {/* Fixtures List */}
                <div className="p-4 bg-black/20">
                  {(() => {
                     const current = calendar.find(g => g.gameweekNumber === selectedGwNum);
                     if (!current || !current.fixtures || current.fixtures.length === 0) {
                        return <div className="text-center text-white/30 text-sm py-8">No hay partidos asignados a esta fecha.</div>;
                     }

                     return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {current.fixtures.map((fix) => {
                            const date = new Date(fix.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                            return (
                              <div key={fix.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors">
                                 {/* HOME TEAM */}
                                 <div className="flex flex-col items-center flex-1 gap-1">
                                    <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full p-1.5 overflow-hidden border border-white/10">
                                       {fix.homeTeamLogo ? <img src={fix.homeTeamLogo} alt={fix.homeTeamName} className="w-full h-full object-contain" loading="lazy" decoding="async" width={40} height={40} /> : <ShieldCheck size={20} className="text-white/20"/>}
                                    </div>
                                    <div className="text-xs font-bold text-white/90 text-center uppercase truncate w-full max-w-[100px] leading-tight" title={fix.homeTeamName}>{fix.homeTeamName}</div>
                                 </div>

                                 {/* SCORE / STATUS */}
                                 <div className="mx-2 flex flex-col items-center min-w-[70px]">
                                    {fix.status === 'finished' || fix.status === 'live' ? (
                                      <div className={`font-black text-2xl tracking-widest ${fix.status === 'live' ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                                        {fix.homeScore ?? '-'}-{fix.awayScore ?? '-'}
                                      </div>
                                    ) : (
                                      <div className="text-white/40 font-bold text-sm bg-black/40 px-3 py-1 rounded border border-white/5">VS</div>
                                    )}
                                    <div className="text-[10px] text-white/50 mt-2 text-center">{date}</div>
                                 </div>

                                 {/* AWAY TEAM */}
                                 <div className="flex flex-col items-center flex-1 gap-1">
                                    <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full p-1.5 overflow-hidden border border-white/10">
                                       {fix.awayTeamLogo ? <img src={fix.awayTeamLogo} alt={fix.awayTeamName} className="w-full h-full object-contain" loading="lazy" decoding="async" width={40} height={40} /> : <ShieldCheck size={20} className="text-white/20"/>}
                                    </div>
                                    <div className="text-xs font-bold text-white/90 text-center uppercase truncate w-full max-w-[100px] leading-tight" title={fix.awayTeamName}>{fix.awayTeamName}</div>
                                 </div>
                              </div>
                            )
                          })}
                        </div>
                     );
                  })()}
                </div>
              </div>
            ) : (
               <div className="text-white/50 text-center py-10 glass-card rounded-2xl">Cronograma no disponible para este torneo aún.</div>
            )}
         </div>
       )}


    </div>
  );
}

export default FantasyLeague;
