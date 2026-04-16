import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Trophy, Save, Calculator, ChevronDown, Trash2, UserCog, RefreshCw, Database, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import useAuthStore from '../store/authStore';
import useCompetitionStore from '../store/competitionStore';

export default function AdminPanel() {
  const [tab, setTab] = useState('matches');
  const [matches, setMatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [scoringConfig, setScoringConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const { activeCompetition, fetchCompetitions } = useCompetitionStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const compParam = activeCompetition?.id ? `?competitionId=${activeCompetition.id}` : '';
      const [matchRes, userRes, configRes] = await Promise.all([
        api.get(`/matches${compParam}`),
        api.get('/admin/users').catch(() => ({ data: [] })),
        api.get('/admin/scoring/config').catch(() => ({ data: null })),
      ]);
      setMatches(matchRes.data);
      setUsers(userRes.data);
      setScoringConfig(configRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveResult = async (matchId, result) => {
    setSaving(true);
    try {
      await api.put(`/admin/matches/${matchId}/result`, result);
      await api.post('/admin/scoring/calculate', { matchId });
      loadData();
      useToastStore.getState().addToast({ type: 'success', message: 'Resultado guardado y puntos calculados ✅' });
    } catch (err) { useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error' }); }
    finally { setSaving(false); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === data.id ? data : u));
      useToastStore.getState().addToast({ type: 'success', message: `Rol actualizado a ${newRole}` });
    } catch (err) {
      useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al cambiar rol' });
    }
  };

  const handleDeleteUser = (userId, displayName) => {
    useToastStore.getState().askConfirm({
      title: 'Eliminar Usuario',
      message: `¿Estás seguro de que querés eliminar a "${displayName}"? Se borrarán sus predicciones, grupos, dream team y todo su progreso. Esta acción es irreversible.`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users/${userId}`);
          setUsers(prev => prev.filter(u => u.id !== userId));
          useToastStore.getState().addToast({ type: 'success', message: `Usuario "${displayName}" eliminado` });
        } catch (err) {
          useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al eliminar' });
        }
      }
    });
  };

  const tabs = [
    { id: 'matches', label: 'Resultados', icon: Trophy },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'scoring', label: 'Puntuación', icon: Calculator },
    { id: 'sync', label: 'API Sync', icon: Database },
  ];

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/20 text-red-400">
          <Shield size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/50 text-sm">Gestionar resultados, usuarios y puntuación</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border-none ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 bg-transparent'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Matches Tab */}
      {tab === 'matches' && (
        <div className="space-y-3">
          {matches.map((match) => (
            <MatchResultEditor key={match.id} match={match} onSave={saveResult} saving={saving} />
          ))}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {users.length} usuarios registrados
            </h2>
          </div>

          {users.map((u) => {
            const isMe = u.id === currentUser?.id;
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-xl p-4 flex items-center gap-4 ${isMe ? 'border border-indigo-500/30' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${
                  u.role === 'SUPERADMIN' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-white/10 text-white/60 border-white/20'
                }`}>
                  {u.displayName.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{u.displayName}</span>
                    <span className="text-xs text-white/30">@{u.username}</span>
                    {isMe && <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[10px] font-semibold">TÚ</span>}
                  </div>
                  <div className="text-xs text-white/30 mt-0.5">{u.email} • Registrado {new Date(u.createdAt).toLocaleDateString('es-AR')}</div>
                </div>

                {/* Role Selector */}
                {!isMe ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-medium text-white cursor-pointer focus:outline-none focus:border-indigo-500 appearance-none"
                      style={{ backgroundImage: 'none' }}
                    >
                      <option value="PLAYER" className="bg-slate-800">PLAYER</option>
                      <option value="ADMIN" className="bg-slate-800">ADMIN</option>
                      <option value="SUPERADMIN" className="bg-slate-800">SUPERADMIN</option>
                    </select>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.displayName)}
                      className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all bg-transparent border-none cursor-pointer"
                      title="Eliminar usuario"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    u.role === 'SUPERADMIN' ? 'bg-red-500/20 text-red-400' :
                    u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-white/10 text-white/50'
                  }`}>{u.role}</span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Scoring Config Tab */}
      {tab === 'scoring' && scoringConfig && (
        <ScoringConfigEditor config={scoringConfig} onUpdate={loadData} />
      )}

      {/* API Sync Tab */}
      {tab === 'sync' && (
        <SyncPanel onSyncComplete={() => { loadData(); fetchCompetitions(); }} />
      )}
    </div>
  );
}

function MatchResultEditor({ match, onSave, saving }) {
  const [result, setResult] = useState({
    homeGoals: match.homeGoals ?? '',
    awayGoals: match.awayGoals ?? '',
    homeShots: match.homeShots ?? '',
    awayShots: match.awayShots ?? '',
    homeCorners: match.homeCorners ?? '',
    awayCorners: match.awayCorners ?? '',
  });
  const [expanded, setExpanded] = useState(false);

  const isFinished = match.status === 'FINISHED';

  return (
    <div className={`glass-card rounded-xl p-4 ${isFinished ? 'border-l-4 border-l-green-500/50' : ''}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-2 w-full sm:flex-1 min-w-0 justify-center sm:justify-start">
          <span className="text-base sm:text-lg">{match.homeFlag}</span>
          <span className="text-xs sm:text-sm text-white font-medium truncate max-w-[80px] sm:max-w-none">{match.homeTeam}</span>
          <div className="flex items-center gap-1">
            <input type="number" min="0" value={result.homeGoals}
              onChange={(e) => setResult({...result, homeGoals: e.target.value})}
              className="w-10 h-8 text-center bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <span className="text-white/30">-</span>
            <input type="number" min="0" value={result.awayGoals}
              onChange={(e) => setResult({...result, awayGoals: e.target.value})}
              className="w-10 h-8 text-center bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <span className="text-xs sm:text-sm text-white font-medium truncate max-w-[80px] sm:max-w-none">{match.awayTeam}</span>
          <span className="text-base sm:text-lg">{match.awayFlag}</span>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button onClick={() => setExpanded(!expanded)}
            className="text-white/30 hover:text-white/60 bg-transparent border-none cursor-pointer">
            <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => onSave(match.id, {
              homeGoals: Number(result.homeGoals), awayGoals: Number(result.awayGoals),
              homeShots: result.homeShots !== '' ? Number(result.homeShots) : null,
              awayShots: result.awayShots !== '' ? Number(result.awayShots) : null,
              homeCorners: result.homeCorners !== '' ? Number(result.homeCorners) : null,
              awayCorners: result.awayCorners !== '' ? Number(result.awayCorners) : null,
            })}
            disabled={saving || result.homeGoals === '' || result.awayGoals === ''}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none text-white disabled:opacity-30 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
            <Save size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40 w-20">Remates</label>
            <input type="number" min="0" value={result.homeShots} onChange={(e) => setResult({...result, homeShots: e.target.value})}
              className="w-12 h-7 text-center bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <span className="text-white/20">-</span>
            <input type="number" min="0" value={result.awayShots} onChange={(e) => setResult({...result, awayShots: e.target.value})}
              className="w-12 h-7 text-center bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40 w-20">Córners</label>
            <input type="number" min="0" value={result.homeCorners} onChange={(e) => setResult({...result, homeCorners: e.target.value})}
              className="w-12 h-7 text-center bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <span className="text-white/20">-</span>
            <input type="number" min="0" value={result.awayCorners} onChange={(e) => setResult({...result, awayCorners: e.target.value})}
              className="w-12 h-7 text-center bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
        </div>
      )}
    </div>
  );
}

function ScoringConfigEditor({ config, onUpdate }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);

  const fields = [
    { key: 'exactScore', label: 'Resultado Exacto', desc: 'Acertar goles de local y visitante' },
    { key: 'correctWinner', label: 'Ganador / Empate', desc: 'Acertar quién gana o empata' },
    { key: 'doubleChance', label: 'Doble Oportunidad', desc: '1X, 2X, 12 - menos riesgo' },
    { key: 'btts', label: 'Ambos Anotan (BTTS)', desc: '¿Los dos equipos hacen gol?' },
    { key: 'overUnder', label: 'Más/Menos 2.5', desc: 'Total de goles over o under' },
    { key: 'moreShots', label: 'Más Remates', desc: 'Quién remata más al arco' },
    { key: 'moreCorners', label: 'Más Córners', desc: 'Quién saca más córners' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, ...data } = form;
      await api.put('/admin/scoring/config', data);
      useToastStore.getState().addToast({ type: 'success', message: 'Configuración guardada ✅' });
      onUpdate();
    } catch (err) { useToastStore.getState().addToast({ type: 'error', message: 'Error al guardar configuración' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Configuración de Puntos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3">
            <div>
              <div className="text-sm text-white font-medium">{label}</div>
              <div className="text-xs text-white/30">{desc}</div>
            </div>
            <input type="number" min="0" value={form[key]}
              onChange={(e) => setForm({...form, [key]: Number(e.target.value)})}
              className="w-14 h-9 text-center bg-white/10 border border-white/20 rounded-lg text-white font-semibold focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
        ))}
      </div>
      <button onClick={handleSave} disabled={saving}
        className="px-6 py-2.5 rounded-xl text-white font-medium text-sm cursor-pointer border-none hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </button>
    </div>
  );
}

function SyncPanel({ onSyncComplete }) {
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  const [apiStatus, setApiStatus] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [leagueId, setLeagueId] = useState('1');
  const [season, setSeason] = useState('2022');
  const { activeCompetition } = useCompetitionStore();

  useEffect(() => {
    loadApiStatus();
    loadTeams();
  }, []);

  const loadApiStatus = async () => {
    try {
      const { data } = await api.get('/admin/sync/status');
      setApiStatus(data);
    } catch (err) { console.error('Error loading API status:', err); }
  };

  const loadTeams = async () => {
    try {
      const { data } = await api.get('/matches/teams');
      setTeams(data);
    } catch (err) { console.error(err); }
  };

  const runSync = async (action, body = {}) => {
    // Para teams, fixtures, results: pasar leagueId y season
    const syncBody = { ...body };
    if (['teams', 'fixtures', 'results'].includes(action)) {
      syncBody.leagueId = Number(leagueId);
      syncBody.season = Number(season);
    }
    // Para squads: pasar competitionId del último sync
    if (['squads'].includes(action) && activeCompetition?.id) {
      syncBody.competitionId = activeCompetition.id;
    }

    setLoading(prev => ({ ...prev, [action]: true }));
    setResults(prev => ({ ...prev, [action]: null }));
    try {
      const { data } = await api.post(`/admin/sync/${action}`, syncBody);
      setResults(prev => ({ ...prev, [action]: { success: true, data } }));
      useToastStore.getState().addToast({ type: 'success', message: data.message || 'Sincronizado ✅' });
      loadApiStatus();
      if (['teams', 'fixtures', 'results'].includes(action)) onSyncComplete();
    } catch (err) {
      setResults(prev => ({ ...prev, [action]: { success: false, error: err.response?.data?.error || err.message } }));
      useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error en sync' });
    } finally {
      setLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const syncActions = [
    { id: 'teams', label: 'Sync Equipos', desc: 'Descarga selecciones con logos y banderas', icon: '🏟️', callsUsed: 1 },
    { id: 'fixtures', label: 'Sync Partidos', desc: 'Descarga calendario, estadios y resultados', icon: '⚽', callsUsed: 1 },
    { id: 'results', label: 'Actualizar Resultados', desc: 'Actualiza goles y estados de partidos', icon: '📊', callsUsed: 1 },
  ];

  return (
    <div className="space-y-4">
      {/* API Status Card */}
      {apiStatus && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Estado de API</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{apiStatus.requests?.current ?? '—'}</div>
              <div className="text-xs text-white/40 mt-1">Requests hoy</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{apiStatus.requests?.limit_day ?? '—'}</div>
              <div className="text-xs text-white/40 mt-1">Límite diario</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {apiStatus.requests?.limit_day && apiStatus.requests?.current
                  ? apiStatus.requests.limit_day - apiStatus.requests.current
                  : '—'}
              </div>
              <div className="text-xs text-white/40 mt-1">Restantes</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-sm font-medium text-white/70">{apiStatus.subscription?.plan ?? '—'}</div>
              <div className="text-xs text-white/40 mt-1">Plan</div>
            </div>
          </div>
        </div>
      )}

      {/* League/Season Selector */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Liga & Temporada</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1">League ID (API-Football)</label>
            <input
              type="number" value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ej: 1 (Mundial), 128 (Liga Arg)"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Temporada</label>
            <input
              type="number" value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ej: 2026"
            />
          </div>
          {activeCompetition && (
            <div className="flex items-end">
              <div className="bg-white/[0.03] rounded-lg px-3 py-2 flex items-center gap-2">
                {activeCompetition.logo && <img src={activeCompetition.logo} alt="" className="w-5 h-5 object-contain" />}
                <span className="text-sm text-white/70">Activa: <strong className="text-white">{activeCompetition.name}</strong></span>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-white/30 mt-2">IDs comunes: 1=Mundial, 128=Liga Argentina, 13=Libertadores, 2=Champions</p>
      </div>

      {/* Sync Actions */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Sincronización</h3>
        <div className="space-y-3">
          {syncActions.map(action => (
            <div key={action.id} className="flex items-center justify-between bg-white/[0.03] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{action.icon}</span>
                <div>
                  <div className="text-sm font-medium text-white">{action.label}</div>
                  <div className="text-xs text-white/40">{action.desc} • {action.callsUsed} call</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {results[action.id] && (
                  results[action.id].success
                    ? <CheckCircle size={16} className="text-emerald-400" />
                    : <AlertCircle size={16} className="text-red-400" />
                )}
                <button
                  onClick={() => runSync(action.id)}
                  disabled={loading[action.id]}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
                >
                  {loading[action.id]
                    ? <Loader2 size={14} className="animate-spin" />
                    : <RefreshCw size={14} />
                  }
                  {loading[action.id] ? 'Sincronizando...' : 'Sync'}
                </button>
              </div>
            </div>
          ))}

          {/* Squad sync with team selector */}
          <div className="bg-white/[0.03] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👤</span>
                <div>
                  <div className="text-sm font-medium text-white">Sync Planteles</div>
                  <div className="text-xs text-white/40">Descarga jugadores de los equipos • 1 call por equipo</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => runSync('squads', { batchSize: 10 })}
                disabled={loading.squads}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
              >
                {loading.squads
                  ? <Loader2 size={14} className="animate-spin" />
                  : <RefreshCw size={14} />
                }
                {loading.squads ? 'Sincronizando...' : 'Sync 10 equipos'}
              </button>
              {results.squads?.success && (
                <span className="text-xs text-emerald-400">{results.squads.data.message}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results detail */}
      {Object.entries(results).filter(([, r]) => r?.success && r.data).length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Últimos resultados</h3>
          <div className="space-y-2 text-sm text-white/70">
            {Object.entries(results).map(([key, r]) => r?.success && (
              <div key={key} className="flex items-center gap-2 bg-white/[0.03] rounded-lg p-3">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="font-medium text-white">{key}:</span>
                <span>{JSON.stringify(r.data).substring(0, 120)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
