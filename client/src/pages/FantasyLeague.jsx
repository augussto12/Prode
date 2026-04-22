import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Copy, Users, UserX, ShieldCheck, CheckCircle, ArrowRight, ArrowLeft, UserPlus, RefreshCw, Zap, Loader2, Check } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import './Fantasy.css';

function FantasyLeague() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [activeGw, setActiveGw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState(false);
  const [recalcFixtureId, setRecalcFixtureId] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const [activeTab, setActiveTab] = useState('standings');
  const [calendar, setCalendar] = useState([]);
  const [selectedGwNum, setSelectedGwNum] = useState(1);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [resDetails, resStandings, resGw, resCal] = await Promise.all([
        api.get(`/fantasy/leagues/${id}/details`),
        api.get(`/fantasy/leagues/${id}/standings`),
        api.get(`/fantasy/leagues/${id}/gameweeks/active`).catch(() => ({ data: null })),
        api.get(`/fantasy/leagues/${id}/calendar`).catch(() => ({ data: [] }))
      ]);

      setLeague(resDetails.data);
      setStandings(resStandings.data);
      setActiveGw(resGw.data);

      const calData = resCal.data || [];
      setCalendar(calData);

      if (calData.length > 0) {
        const active = calData.find(gw => gw.status === 'IN_PROGRESS' || gw.status === 'SCHEDULED') || calData[calData.length - 1];
        setSelectedGwNum(active ? active.gameweekNumber : calData[0].gameweekNumber);
      }
    } catch (err) {
      console.error(err);
      useToastStore.getState().addToast({ type: 'error', message: 'No se pudo cargar la liga' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!league) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(league.code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = league.code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCodeCopied(true);
      useToastStore.getState().addToast({ type: 'success', message: `Código ${league.code} copiado` });
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (err) {
      useToastStore.getState().addToast({ type: 'error', message: 'No se pudo copiar el código' });
    }
  };

  const toggleBan = async (teamId, currentStatus) => {
    const isBanning = currentStatus === 'active';
    const verb = isBanning ? 'ban' : 'unban';
    try {
      await api.put(`/fantasy/leagues/${id}/teams/${teamId}/${verb}`);
      useToastStore.getState().addToast({ type: 'success', message: isBanning ? 'Usuario expulsado' : 'Usuario reincorporado' });
      fetchData();
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

  if (loading) return (
    <div className="page-container flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 size={32} className="animate-spin text-indigo-500" />
      <span className="text-white/50 text-sm">Cargando torneo...</span>
    </div>
  );
  if (!league) return <div className="page-container text-center p-10 text-white font-bold">Torneo no encontrado</div>;

  const isOwner = league.ownerId === user?.id;

  return (
    <div className="page-container fade-in px-3 sm:px-6 py-4 sm:py-8 max-w-[1000px] mx-auto">
      {/* BACK BUTTON */}
      <button
        onClick={() => navigate('/fantasy')}
        className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs sm:text-sm font-medium mb-3 sm:mb-4 bg-transparent border-none cursor-pointer transition-colors"
      >
        <ArrowLeft size={16} /> Volver a GranDT
      </button>

      {/* HEADER */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-8 flex flex-col gap-3 sm:gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-lg sm:text-2xl font-bold text-white mb-1">
            {league.name}
            <span className="text-xs sm:text-base text-white/40 font-normal ml-2">({league.realLeagueName})</span>
          </h1>
          <p className="text-white/60 text-xs sm:text-sm">{league.description || 'Torneo privado y competitivo.'}</p>
          <p className="text-emerald-400 text-[10px] sm:text-sm font-semibold flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            {activeGw ? `Fecha ${activeGw.gameweekNumber}` : 'Pretemporada'}
            {activeGw && (
              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-xs bg-black/30 border border-white/10 text-white/70">
                {activeGw.transfersOpen ? '🔓 Pases Abiertos' : '🔒 Cerrado'}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 relative z-10">
          <Link to={`/fantasy/team/${id}`} className="bg-white text-black font-bold py-2.5 px-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm">
            Director Técnico <ArrowRight size={16} />
          </Link>
          {isOwner && (
            <button onClick={() => setAdminTab(!adminTab)} className={`py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border text-xs sm:text-sm ${adminTab ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500' : 'bg-transparent border-white/10 text-white/70 hover:bg-white/5'}`}>
              <ShieldCheck size={16} /> {adminTab ? 'Ocultar Admin' : 'Admin'}
            </button>
          )}
        </div>
      </div>

      {/* ADMIN PANEL */}
      {isOwner && adminTab && (
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-8 border-indigo-500/20 animate-fade-in bg-gradient-to-br from-indigo-900/30 to-purple-900/10">
          <h2 className="text-base sm:text-xl font-bold text-indigo-400 mb-4 sm:mb-6 flex items-center gap-2">
            <ShieldCheck size={18} /> Admin
          </h2>

          {/* Código */}
          <div className="bg-black/30 rounded-xl p-3 sm:p-5 border border-white/5 mb-4 sm:mb-6">
            <h3 className="text-white font-bold text-sm mb-1">Código de Invitación</h3>
            <p className="text-white/50 text-[10px] sm:text-xs mb-3">Límite: {league.maxTeams} equipos.</p>
            <div className="flex items-center gap-3">
              <div className="text-xl sm:text-2xl tracking-[0.15em] font-black text-amber-400 font-mono bg-white/5 px-4 py-2 rounded-lg border border-amber-400/20 flex-1 text-center select-all">
                {league.code}
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors border-none cursor-pointer shrink-0 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              >
                {codeCopied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
              </button>
            </div>
          </div>

          {/* Moderación */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2"><UserX size={16} className="text-red-400" /> Moderación</h3>
            {/* Desktop table */}
            <div className="hidden sm:block bg-black/30 rounded-xl overflow-hidden border border-white/5">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-white/50 uppercase">
                    <th className="p-2.5">Equipo</th>
                    <th className="p-2.5">Manager</th>
                    <th className="p-2.5">Estado</th>
                    <th className="p-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {league?.teams?.map(t => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-2.5 text-xs text-white font-bold">{t.name}</td>
                      <td className="p-2.5 text-xs text-white/70">{t.user?.displayName || t.user?.username}</td>
                      <td className="p-2.5">
                        {t.status === 'active' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">Activo</span>
                        ) : (
                          <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px]">Bloqueado</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <button onClick={() => toggleBan(t.id, t.status)} className={`text-[10px] px-2.5 py-1 rounded transition font-bold ${t.status === 'active' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}>
                          {t.status === 'active' ? 'Bloquear' : 'Reconectar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {league?.teams?.map(t => (
                <div key={t.id} className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-white font-bold truncate">{t.name}</div>
                    <div className="text-[10px] text-white/50">{t.user?.displayName || t.user?.username}</div>
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${t.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                      {t.status === 'active' ? 'Activo' : 'Bloqueado'}
                    </span>
                  </div>
                  <button onClick={() => toggleBan(t.id, t.status)} className={`text-[10px] px-2.5 py-1.5 rounded transition font-bold shrink-0 ${t.status === 'active' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}>
                    {t.status === 'active' ? 'Bloquear' : 'Reconectar'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring */}
          <div>
            <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2"><Zap size={16} className="text-amber-400" /> Puntuación</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleRecalculate('all')}
                disabled={recalculating}
                className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold px-3 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-40 text-xs"
              >
                <RefreshCw size={14} className={recalculating ? 'animate-spin' : ''} /> {recalculating ? 'Procesando...' : 'Recalcular Pendientes'}
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ID Fixture"
                  value={recalcFixtureId}
                  onChange={e => setRecalcFixtureId(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 flex-1 min-w-0"
                />
                <button
                  onClick={() => handleRecalculate('single')}
                  disabled={recalculating || !recalcFixtureId}
                  className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap text-xs shrink-0"
                >
                  <RefreshCw size={12} /> Recalcular
                </button>
              </div>
            </div>
            {recalcResult && (
              <div className={`mt-2 p-2.5 rounded-lg text-xs ${recalcResult.error ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                {recalcResult.error || recalcResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 border-b border-white/10 pb-3 overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('standings')} className={`px-3 sm:px-4 py-2 font-bold rounded-xl transition-colors cursor-pointer text-xs sm:text-sm whitespace-nowrap ${activeTab === 'standings' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}>
          Posiciones
        </button>
        <button onClick={() => setActiveTab('calendar')} className={`px-3 sm:px-4 py-2 font-bold rounded-xl transition-colors cursor-pointer text-xs sm:text-sm whitespace-nowrap ${activeTab === 'calendar' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}>
          Fechas y Partidos
        </button>
      </div>

      {/* TAB: STANDINGS */}
      {activeTab === 'standings' && (
        <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
          <div className="bg-white/5 p-3 sm:p-5 border-b border-white/5">
            <h3 className="font-bold text-white text-sm sm:text-lg flex items-center gap-2">
              <Trophy className="text-amber-400" size={18} /> Clasificación
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 text-white/50 text-[10px] sm:text-xs uppercase tracking-wider">
                  <th className="p-2 sm:p-3 font-semibold w-8">#</th>
                  <th className="p-2 sm:p-3 font-semibold">Equipo</th>
                  <th className="p-2 sm:p-3 font-semibold">DT</th>
                  <th className="p-2 sm:p-3 font-semibold text-right">Pts</th>
                  {isOwner && adminTab && <th className="p-2 sm:p-3 font-semibold text-right">Mod.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.map((team) => (
                  <tr key={team.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-2 sm:p-3">
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs ${team.rank === 1 ? 'bg-amber-400/20 text-amber-400 border border-amber-400/50' : team.rank === 2 ? 'bg-gray-300/20 text-gray-300 border border-gray-300/50' : team.rank === 3 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/50' : 'bg-white/5 text-white/70'}`}>
                        {team.rank}
                      </div>
                    </td>
                    <td className="p-2 sm:p-3">
                      <div className="font-bold text-white text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[180px]">{team.name}</div>
                    </td>
                    <td className="p-2 sm:p-3">
                      <div className="text-[10px] sm:text-xs text-white/50 truncate max-w-[80px] sm:max-w-[140px]">{team.user?.displayName || team.user?.username}</div>
                    </td>
                    <td className="p-2 sm:p-3 text-right">
                      <div className="text-sm sm:text-lg font-black text-emerald-400">{team.totalPoints}</div>
                    </td>
                    {isOwner && adminTab && (
                      <td className="p-2 sm:p-3 text-right">
                        <button
                          onClick={() => toggleBan(team.id, 'active')}
                          className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors"
                        >
                          <UserX size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {standings.length === 0 && (
              <div className="p-8 sm:p-10 text-center flex flex-col items-center justify-center">
                <UserPlus size={36} className="text-white/10 mb-3" />
                <p className="text-white/50 text-sm">El estadio está vacío.</p>
                <p className="text-white/30 text-xs mt-1">Comparte el código para llenar las tribunas.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="space-y-4 animate-fade-in">
          {calendar.length > 0 ? (
            <div className="glass-card rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden">
              {/* Header Switcher */}
              <div className="flex items-center justify-between p-3 sm:p-4 bg-black/40 border-b border-white/5">
                <button
                  onClick={() => setSelectedGwNum(Math.max(1, selectedGwNum - 1))}
                  disabled={selectedGwNum === 1}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white font-bold text-sm"
                >
                  &lt;
                </button>

                <div className="flex flex-col items-center">
                  <div className="text-white font-black tracking-wide uppercase text-xs sm:text-sm">
                    Fecha {selectedGwNum}
                  </div>
                  {(() => {
                    const current = calendar.find(g => g.gameweekNumber === selectedGwNum);
                    if (!current) return null;
                    if (current.status === 'FINISHED') return <span className="text-[9px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5">Terminada</span>;
                    if (current.status === 'IN_PROGRESS') return <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 animate-pulse">En Juego</span>;
                    if (current.status === 'SCHEDULED') return <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5">Próxima</span>;
                  })()}
                </div>

                <button
                  onClick={() => setSelectedGwNum(Math.min(calendar.length, selectedGwNum + 1))}
                  disabled={selectedGwNum === calendar.length}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white font-bold text-sm"
                >
                  &gt;
                </button>
              </div>

              {/* Fixtures List */}
              <div className="p-3 sm:p-4 bg-black/20">
                {(() => {
                  const current = calendar.find(g => g.gameweekNumber === selectedGwNum);
                  if (!current || !current.fixtures || current.fixtures.length === 0) {
                    return <div className="text-center text-white/30 text-xs sm:text-sm py-6">No hay partidos asignados.</div>;
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {current.fixtures.map((fix) => {
                        const date = new Date(fix.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                        return (
                          <div key={fix.id} className="bg-white/5 p-2.5 sm:p-3 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors gap-1">
                            {/* HOME */}
                            <div className="flex flex-col items-center flex-1 gap-0.5 min-w-0">
                              <div className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center bg-white/5 rounded-full p-1 overflow-hidden border border-white/10 shrink-0">
                                {fix.homeTeamLogo ? <img src={fix.homeTeamLogo} alt={fix.homeTeamName} className="w-full h-full object-contain" loading="lazy" decoding="async" width={28} height={28} /> : <ShieldCheck size={14} className="text-white/20" />}
                              </div>
                              <div className="text-[9px] sm:text-[11px] font-bold text-white/90 text-center uppercase truncate w-full leading-tight" title={fix.homeTeamName}>{fix.homeTeamName}</div>
                            </div>

                            {/* SCORE */}
                            <div className="flex flex-col items-center min-w-[50px] sm:min-w-[60px] shrink-0">
                              {fix.status === 'finished' || fix.status === 'live' ? (
                                <div className={`font-black text-base sm:text-xl tracking-wider ${fix.status === 'live' ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                                  {fix.homeScore ?? '-'}-{fix.awayScore ?? '-'}
                                </div>
                              ) : (
                                <div className="text-white/40 font-bold text-[10px] sm:text-xs bg-black/40 px-2 py-0.5 rounded border border-white/5">VS</div>
                              )}
                              <div className="text-[8px] sm:text-[10px] text-white/50 mt-1 text-center">{date}</div>
                            </div>

                            {/* AWAY */}
                            <div className="flex flex-col items-center flex-1 gap-0.5 min-w-0">
                              <div className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center bg-white/5 rounded-full p-1 overflow-hidden border border-white/10 shrink-0">
                                {fix.awayTeamLogo ? <img src={fix.awayTeamLogo} alt={fix.awayTeamName} className="w-full h-full object-contain" loading="lazy" decoding="async" width={28} height={28} /> : <ShieldCheck size={14} className="text-white/20" />}
                              </div>
                              <div className="text-[9px] sm:text-[11px] font-bold text-white/90 text-center uppercase truncate w-full leading-tight" title={fix.awayTeamName}>{fix.awayTeamName}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="text-white/50 text-center py-8 glass-card rounded-xl text-sm">Cronograma no disponible aún.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default FantasyLeague;
