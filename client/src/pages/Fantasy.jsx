import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Plus, Lock, Users, Trophy, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import api from '../services/api';
import { getSocket } from '../lib/socket';
import './Fantasy.css';

const AVAILABLE_LEAGUES = [
   { id: 636, name: 'Liga Profesional Argentina', logo: '🇦🇷' },
   { id: 8, name: 'Premier League', logo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
   { id: 564, name: 'La Liga', logo: '🇪🇸' },
   { id: 384, name: 'Serie A', logo: '🇮🇹' }
];

function Fantasy() {
   const user = useAuthStore((state) => state.user);
   const navigate = useNavigate();

   const [myLeagues, setMyLeagues] = useState([]);
   const [joinCode, setJoinCode] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [isInitializing, setIsInitializing] = useState(true);

   // Wizard state
   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
   const [wizardStep, setWizardStep] = useState(1);
   const [newLeagueForm, setNewLeagueForm] = useState({
      leagueId: null,
      name: '',
      description: '',
      maxTeams: 20
   });

   useEffect(() => {
      fetchMyLeagues();

      const socket = getSocket();
      if (!socket.connected) socket.connect();

      const handleTransfersClosed = (data) => {
         useToastStore.getState().addToast({
            type: 'warning',
            message: '¡El mercado de pases cerró en tu liga! Los equipos están blindados.'
         });
         fetchMyLeagues(); // Refresh data just in case statuses changed
      };

      socket.on('fantasy:transfers_closed', handleTransfersClosed);

      return () => {
         socket.off('fantasy:transfers_closed', handleTransfersClosed);
      };
   }, []);

   const fetchMyLeagues = async () => {
      try {
         const res = await fetch('/api/fantasy/my-leagues', {
            headers: {
               'Authorization': `Bearer ${user?.token}`
            }
         });
         if (!res.ok) throw new Error('Error al fetchear mis ligas');
         const data = await res.json();
         setMyLeagues(data);
      } catch (err) {
         console.error(err);
      } finally {
         setIsInitializing(false);
      }
   };

   const handleJoin = async (e) => {
      e.preventDefault();
      if (joinCode.length < 6) return setError('Código inválido, debe tener 6 caracteres numéricos/letras.');

      setLoading(true);
      setError('');
      try {
         const res = await fetch(`/api/fantasy/leagues/${joinCode}/join`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${user?.token}`
            },
            body: JSON.stringify({ teamName: `${user?.username || 'Mi'} Team` })
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error);
         navigate(`/fantasy/league/${data.league.id}`);
      } catch (err) {
         setError(err.message);
      } finally {
         setLoading(false);
      }
   };

   const handleCreate = async () => {
      if (!newLeagueForm.name || !newLeagueForm.leagueId) return;
      setLoading(true);
      setError('');
      try {
         const res = await fetch('/api/fantasy/leagues', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${user?.token}`
            },
            body: JSON.stringify(newLeagueForm)
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error);

         setIsCreateModalOpen(false);
         navigate(`/fantasy/league/${data.league.id}`);
      } catch (err) {
         setError(err.message);
      } finally {
         setLoading(false);
      }
   };

   const startWizard = () => {
      setWizardStep(1);
      setNewLeagueForm({ leagueId: null, name: '', description: '', maxTeams: 20 });
      setIsCreateModalOpen(true);
      setError('');
   };

   return (
      <div className="fantasy-hub page-container fade-in">
         {/* HEADER HERO */}
         <div className="fantasy-header">
            <div className="fantasy-hero-backdrop"></div>
            <h1 className="flex items-center justify-center gap-2 sm:gap-3"><Trophy className="text-amber-400" size={24} /> GranDT</h1>
            <p>Armá tu equipo ideal y jugá con tus amigos.</p>
         </div>

         {error && <div className="error-banner animate-slide-down">{error}</div>}

         <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 px-0 sm:px-4 relative z-10 w-full mb-8 sm:mb-10 mt-3 sm:mt-6">
            {/* MIS LIGAS */}
            <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col">
               <h2 className="text-lg sm:text-2xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2 border-b border-white/10 pb-2 sm:pb-3">
                  <Shield className="text-emerald-400" size={18} /> Mis Ligas
               </h2>
               {isInitializing ? (
                  <div className="text-white/50 text-center py-6">Cargando tus torneos...</div>
               ) : myLeagues.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 border-2 border-dashed border-white/10 rounded-xl">
                     <Users size={36} className="text-white/20 mb-2" />
                     <p className="text-white/60 text-xs sm:text-sm">Aún no participás.<br />Uníte a una liga o creá la tuya.</p>
                  </div>
               ) : (
                  <div className="space-y-2 sm:space-y-3 mt-2">
                     {myLeagues.map(lg => (
                        <Link key={lg.id} to={lg.teamStatus === 'banned' || lg.teamStatus === 'frozen' ? '#' : `/fantasy/league/${lg.id}`}
                           className={`block p-3 sm:p-4 rounded-xl border transition-all ${lg.teamStatus === 'active'
                              ? 'bg-white/5 border-white/10 hover:border-indigo-500 hover:bg-white/10 cursor-pointer'
                              : 'bg-red-900/20 border-red-500/30 opacity-75 cursor-not-allowed'
                              }`}>
                           <div className="flex justify-between items-center">
                              <div className="min-w-0">
                                 <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2 truncate">
                                    {lg.name}
                                    {lg.teamStatus !== 'active' && <span className="bg-red-500 text-[10px] px-1.5 py-0.5 rounded text-white font-bold">BLOQUEADO</span>}
                                 </h3>
                                 <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">{lg.realLeagueName} • {lg.maxTeams} cupos</p>
                              </div>
                              <ChevronRight size={18} className={`shrink-0 ${lg.teamStatus === 'active' ? "text-indigo-400" : "text-red-500/50"}`} />
                           </div>
                        </Link>
                     ))}
                  </div>
               )}
            </div>

            {/* ACCIONES */}
            <div className="space-y-4 sm:space-y-6">
               <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                  <Trophy size={28} className="text-amber-400 mb-3 sm:mb-4" />
                  <h2 className="text-base sm:text-xl font-bold text-white mb-1 sm:mb-2">Crear Torneo Privado</h2>
                  <p className="text-xs sm:text-sm text-white/60 mb-4 sm:mb-6">Elegí una liga real, ponele reglas y compartí el código con tus amigos (máx 3).</p>
                  <button onClick={startWizard} className="w-full hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm border-none cursor-pointer"
                     style={{ background: 'linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)' }}
                  >
                     <Plus size={18} /> Crear Liga
                  </button>
               </div>

               <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                  <Lock size={28} className="text-emerald-400 mb-3 sm:mb-4" />
                  <h2 className="text-base sm:text-xl font-bold text-white mb-1 sm:mb-2">Unirse por Código</h2>
                  <p className="text-xs sm:text-sm text-white/60 mb-3 sm:mb-4">Ingresá el código de 6 dígitos que te pasaron.</p>
                  <form onSubmit={handleJoin} className="flex gap-2">
                     <input
                        type="text"
                        placeholder="ABC123"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 text-white text-sm sm:text-base font-bold tracking-widest uppercase focus:outline-none focus:border-emerald-500 placeholder:normal-case placeholder:tracking-normal min-w-0"
                     />
                     <button disabled={loading} type="submit" className="bg-white/10 hover:bg-white/20 text-emerald-400 font-bold py-2.5 px-4 sm:px-6 rounded-xl transition-all whitespace-nowrap text-sm border-none cursor-pointer">
                        {loading ? '...' : 'Entrar'}
                     </button>
                  </form>
               </div>
            </div>
         </div>

         {/* WIZARD MODAL DE CREACIÓN */}
         {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
               <div className="border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]" style={{ background: 'color-mix(in srgb, var(--bg-start-color, #111827) 95%, white)' }}>
                  {/* HEADER */}
                  <div className="flex justify-between items-center p-4 sm:p-5 border-b border-white/5 bg-white/5">
                     <h3 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2"><Trophy className="text-amber-400" size={18} /> Nuevo Torneo</h3>
                     <button onClick={() => setIsCreateModalOpen(false)} className="text-white/50 hover:text-white transition-colors border-none cursor-pointer bg-transparent"><X size={22} /></button>
                  </div>

                  {/* BODY */}
                  <div className="p-6 overflow-y-auto">
                     {/* Paso 1: Liga */}
                     <div className={`transition-all duration-300 ${wizardStep === 1 ? 'block' : 'hidden'}`}>
                        <h4 className="text-white text-lg font-bold mb-2">1. Selecciona el universo de jugadores</h4>
                        <p className="text-white/50 text-sm mb-6">Todos los usuarios de tu liga formarán sus equipos ÚNICAMENTE con jugadores reales de los clubes pertenecientes a la liga elegida.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {AVAILABLE_LEAGUES.map(league => (
                              <div
                                 key={league.id}
                                 onClick={() => { setNewLeagueForm({ ...newLeagueForm, leagueId: league.id }); setWizardStep(2); }}
                                 className="border border-white/10 rounded-xl p-5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/10 transition-all bg-black/20 group"
                              >
                                 <div className="text-4xl group-hover:scale-110 transition-transform">{league.logo}</div>
                                 <div className="text-white font-semibold text-center">{league.name}</div>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Paso 2: Detalles */}
                     <div className={`transition-all duration-300 ${wizardStep === 2 ? 'block' : 'hidden'}`}>
                        <button onClick={() => setWizardStep(1)} className="text-indigo-400 text-sm mb-4 flex items-center gap-1 hover:underline">← Volver a elegir liga</button>
                        <h4 className="text-white text-lg font-bold mb-6">2. Reglas del Vestuario</h4>

                        <div className="space-y-4">
                           <div>
                              <label className="block text-white/70 text-sm font-bold mb-2">Nombre de tu torneo privado</label>
                              <input
                                 type="text" autoFocus
                                 maxLength={30}
                                 value={newLeagueForm.name}
                                 onChange={e => setNewLeagueForm({ ...newLeagueForm, name: e.target.value })}
                                 placeholder="Ej: Liga de los Jueves"
                                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                              />
                           </div>
                           <div>
                              <label className="block text-white/70 text-sm font-bold mb-2">Descripción o Premio (Opcional)</label>
                              <textarea
                                 rows="2" maxLength={150}
                                 value={newLeagueForm.description}
                                 onChange={e => setNewLeagueForm({ ...newLeagueForm, description: e.target.value })}
                                 placeholder="Ej: El último paga el asado de fin de año..."
                                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 resize-none"
                              />
                           </div>
                           <div>
                              <label className="block text-white/70 text-sm font-bold mb-2">Equipos Máximos Permitidos</label>
                              <select
                                 value={newLeagueForm.maxTeams}
                                 onChange={e => setNewLeagueForm({ ...newLeagueForm, maxTeams: Number(e.target.value) })}
                                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                              >
                                 <option value={10}>10 Equipos</option>
                                 <option value={20}>20 Equipos (Estándar)</option>
                                 <option value={50}>50 Equipos</option>
                                 <option value={500}>Sin límite (Pública Global)</option>
                              </select>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* FOOTER */}
                  {wizardStep === 2 && (
                     <div className="p-5 border-t border-white/5 bg-black/20 flex justify-end">
                        <button
                           disabled={loading || !newLeagueForm.name || !newLeagueForm.leagueId}
                           onClick={handleCreate}
                           className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-baseline gap-2"
                        >
                           {loading ? 'Fundando...' : <><CheckCircle2 size={16} /> Comisionar Torneo</>}
                        </button>
                     </div>
                  )}
               </div>
            </div>
         )}
      </div>
   );
}

export default Fantasy;
