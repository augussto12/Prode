import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Trophy, Save, Calculator, ChevronDown, Trash2, RefreshCw, Database, Loader2, CheckCircle, AlertCircle, Clock, Zap, Info } from 'lucide-react';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import useAuthStore from '../store/authStore';
import useCompetitionStore from '../store/competitionStore';

export default function AdminPanel() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [scoringConfig, setScoringConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const { activeCompetition, fetchCompetitions } = useCompetitionStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [userRes, configRes] = await Promise.all([
        api.get('/admin/users').catch(() => ({ data: [] })),
        api.get('/admin/scoring/config').catch(() => ({ data: null })),
      ]);
      setUsers(userRes.data);
      setScoringConfig(configRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const triggerCalculateScores = async () => {
    setSaving(true);
    try {
      const res = await api.post('/admin/scoring/calculate');
      useToastStore.getState().addToast({ type: 'success', message: res.data?.message || 'Puntajes calculados correctamente ✅' });
    } catch (err) { 
      useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al calcular puntajes' }); 
    }
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
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'scoring', label: 'Puntuación', icon: Calculator },
    { id: 'sync', label: 'Config. BD', icon: Database },
  ];

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-red-500/20 text-red-400">
          <Shield size={20} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/50 text-xs sm:text-sm">Gestionar usuarios, puntuación y sincronización</p>
        </div>
      </div>

      {/* Tabs — scroll on mobile */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full sm:w-fit overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border-none whitespace-nowrap ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 bg-transparent'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Quick Action: Force Calculate */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center border-b border-white/5 pb-4">
         <button 
           onClick={triggerCalculateScores}
           disabled={saving}
           className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 cursor-pointer border-none text-xs sm:text-sm"
         >
           {saving ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
           {saving ? 'Calculando...' : 'Forzar Cálculo de Puntos'}
         </button>
         <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-white/30">
           <Clock size={12} />
           <span>Se ejecuta automáticamente a las 00:00 y 06:00 hs</span>
         </div>
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-white">
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
                className={`glass-card rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${isMe ? 'border border-indigo-500/30' : ''}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${
                    u.role === 'SUPERADMIN' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                    'bg-white/10 text-white/60 border-white/20'
                  }`}>
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-medium text-white truncate">{u.displayName}</span>
                      <span className="text-[10px] sm:text-xs text-white/30">@{u.username}</span>
                      {isMe && <span className="px-1 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[9px] sm:text-[10px] font-semibold">TÚ</span>}
                    </div>
                    <div className="text-[10px] sm:text-xs text-white/30 mt-0.5 truncate">{u.email} • {new Date(u.createdAt).toLocaleDateString('es-AR')}</div>
                  </div>
                </div>

                {/* Role Selector */}
                {!isMe ? (
                  <div className="flex items-center gap-2 ml-12 sm:ml-0">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="bg-white/10 border border-white/20 rounded-lg px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium text-white cursor-pointer focus:outline-none focus:border-indigo-500 appearance-none"
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
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <span className={`ml-12 sm:ml-0 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold ${
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

function ScoringConfigEditor({ config, onUpdate }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);

  const activeFields = [
    { 
      key: 'exactScore', 
      label: 'Resultado Exacto', 
      desc: 'Acertar los goles de ambos equipos (ej: 2-1)',
      example: 'Si predecís 2-1 y el resultado es 2-1',
      icon: '🎯',
      color: 'emerald',
    },
    { 
      key: 'correctWinner', 
      label: 'Ganador Correcto', 
      desc: 'Acertar quién gana o si empatan (sin importar goles)',
      example: 'Si predecís 3-0 y el resultado es 1-0 (ambos ganan Local)',
      note: 'Mutuamente excluyente con Resultado Exacto — solo suma uno u otro',
      icon: '✅',
      color: 'blue',
    },
    { 
      key: 'moreShots', 
      label: 'Más Remates al Arco', 
      desc: 'Acertar qué equipo tuvo más remates al arco (shots on goal)',
      example: 'Si elegís "Local" y el Local tuvo 8 remates al arco vs 3 del Visitante',
      icon: '🔫',
      color: 'violet',
    },
    { 
      key: 'moreCorners', 
      label: 'Más Córners', 
      desc: 'Acertar qué equipo sacó más córners',
      example: 'Si elegís "Visitante" y el Visitante tuvo 7 córners vs 3',
      icon: '🚩',
      color: 'amber',
    },
  ];

  const legacyFields = [
    { key: 'doubleChance', label: 'Doble Oportunidad', desc: 'Legacy — No se usa actualmente en el cálculo' },
    { key: 'btts', label: 'Ambos Anotan (BTTS)', desc: 'Legacy — No se usa actualmente en el cálculo' },
    { key: 'overUnder', label: 'Más/Menos 2.5', desc: 'Legacy — No se usa actualmente en el cálculo' },
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

  // Calculate example totals for preview
  const exampleExact = form.exactScore + form.moreShots + form.moreCorners;
  const exampleWinner = form.correctWinner + form.moreShots + form.moreCorners;
  const exampleExactJoker = exampleExact * 2;

  const colorMap = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Info Banner */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-indigo-500/20">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white mb-1">¿Cómo funciona el scoring?</h3>
            <ul className="text-xs sm:text-sm text-white/50 space-y-1">
              <li>• Si acertás el <strong className="text-emerald-400">resultado exacto</strong> sumás esos puntos. Si no, pero acertás el <strong className="text-blue-400">ganador</strong>, sumás esos otros.</li>
              <li>• <strong className="text-violet-400">Remates al Arco</strong> y <strong className="text-amber-400">Córners</strong> son independientes — se suman siempre.</li>
              <li>• El <strong className="text-amber-300">Comodín x2</strong> multiplica TODOS los puntos del partido ×2.</li>
              <li>• Si un mercado tiene <strong>0 pts</strong>, no suma (pero sigue disponible para predecir).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Vista previa — Máximos posibles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{exampleExact}</div>
            <div className="text-[10px] sm:text-xs text-white/40 mt-1">Exacto + Remates + Córners</div>
            <div className="text-[9px] text-white/20 mt-0.5">Mejor caso sin comodín</div>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-black text-blue-400">{exampleWinner}</div>
            <div className="text-[10px] sm:text-xs text-white/40 mt-1">Ganador + Remates + Córners</div>
            <div className="text-[9px] text-white/20 mt-0.5">Caso parcial sin comodín</div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{exampleExactJoker}</div>
            <div className="text-[10px] sm:text-xs text-white/40 mt-1">Todo perfecto + Comodín x2</div>
            <div className="text-[9px] text-white/20 mt-0.5">Máximo absoluto</div>
          </div>
        </div>
      </div>

      {/* Active Scoring Fields */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <h3 className="text-sm sm:text-lg font-semibold text-white mb-4">Configuración de Puntos Activos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {activeFields.map(({ key, label, desc, example, note, icon, color }) => (
            <div key={key} className={`rounded-xl p-3 sm:p-4 border ${colorMap[color]}`} style={{ background: undefined }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm sm:text-base text-white font-semibold">{label}</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/40 mb-1.5">{desc}</p>
                  <p className="text-[10px] sm:text-xs text-white/25 italic">Ej: {example}</p>
                  {note && (
                    <p className="text-[10px] text-amber-400/60 mt-1.5 flex items-start gap-1">
                      <Zap size={10} className="shrink-0 mt-0.5" /> {note}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <input 
                    type="number" min="0" max="99" value={form[key]}
                    onChange={(e) => setForm({...form, [key]: Number(e.target.value)})}
                    className="w-14 sm:w-16 h-10 sm:h-12 text-center bg-black/30 border border-white/20 rounded-xl text-white text-lg sm:text-xl font-black focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                  <div className="text-[9px] text-center text-white/30 mt-1">pts</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legacy Fields (collapsed) */}
      <details className="glass-card rounded-xl sm:rounded-2xl overflow-hidden">
        <summary className="p-4 sm:p-5 cursor-pointer text-xs sm:text-sm text-white/40 font-medium hover:text-white/60 transition-colors flex items-center gap-2">
          <ChevronDown size={14} /> Campos Legacy (no activos en el cálculo)
        </summary>
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-white/5 pt-3">
          <p className="text-[10px] sm:text-xs text-white/25">Estos campos existen en la BD pero no se utilizan en el cálculo actual. Si los activás en el código de scoring, empezarían a puntuar.</p>
          {legacyFields.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between bg-white/[0.02] rounded-xl p-3 opacity-50">
              <div>
                <div className="text-xs sm:text-sm text-white/50 font-medium">{label}</div>
                <div className="text-[10px] sm:text-xs text-white/20">{desc}</div>
              </div>
              <input type="number" min="0" value={form[key]}
                onChange={(e) => setForm({...form, [key]: Number(e.target.value)})}
                className="w-12 sm:w-14 h-8 sm:h-9 text-center bg-white/5 border border-white/10 rounded-lg text-white/50 text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          ))}
        </div>
      </details>

      {/* Save Button */}
      <button onClick={handleSave} disabled={saving}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm cursor-pointer border-none hover:opacity-90 disabled:opacity-50 shadow-lg"
        style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
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
    const syncBody = { ...body };
    if (['teams', 'fixtures', 'results'].includes(action)) {
      syncBody.leagueId = Number(leagueId);
      syncBody.season = Number(season);
    }
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
    { id: 'teams', label: 'Sync Equipos', desc: 'Selecciones con logos y banderas', icon: '🏟️', callsUsed: 1 },
    { id: 'fixtures', label: 'Sync Partidos', desc: 'Calendario, estadios y resultados', icon: '⚽', callsUsed: 1 },
    { id: 'results', label: 'Actualizar Resultados', desc: 'Goles y estados de partidos', icon: '📊', callsUsed: 1 },
  ];

  return (
    <div className="space-y-4">
      {/* API Status Card */}
      {apiStatus && (
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Estado de API</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-white">{apiStatus.requests?.current ?? '—'}</div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Requests hoy</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-white">{apiStatus.requests?.limit_day ?? '—'}</div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Límite diario</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                {apiStatus.requests?.limit_day && apiStatus.requests?.current
                  ? apiStatus.requests.limit_day - apiStatus.requests.current
                  : '—'}
              </div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Restantes</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xs sm:text-sm font-medium text-white/70">{apiStatus.subscription?.plan ?? '—'}</div>
              <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Plan</div>
            </div>
          </div>
        </div>
      )}

      {/* League/Season Selector */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Liga & Temporada</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-[10px] sm:text-xs text-white/40 mb-1">League ID (API-Football)</label>
            <input
              type="number" value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ej: 1 (Mundial)"
            />
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs text-white/40 mb-1">Temporada</label>
            <input
              type="number" value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ej: 2026"
            />
          </div>
          {activeCompetition && (
            <div className="flex items-end">
              <div className="bg-white/[0.03] rounded-lg px-3 py-2 flex items-center gap-2 w-full">
                {activeCompetition.logo && <img src={activeCompetition.logo} alt="" className="w-5 h-5 object-contain shrink-0" />}
                <span className="text-xs sm:text-sm text-white/70 truncate">Activa: <strong className="text-white">{activeCompetition.name}</strong></span>
              </div>
            </div>
          )}
        </div>
        <p className="text-[10px] sm:text-xs text-white/30 mt-2">IDs comunes: 1=Mundial, 128=Liga Argentina, 13=Libertadores, 2=Champions</p>
      </div>

      {/* Sync Actions */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Sincronización</h3>
        <div className="space-y-2 sm:space-y-3">
          {syncActions.map(action => (
            <div key={action.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 bg-white/[0.03] rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">{action.icon}</span>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-white">{action.label}</div>
                  <div className="text-[10px] sm:text-xs text-white/40">{action.desc} • {action.callsUsed} call</div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-8 sm:ml-0">
                {results[action.id] && (
                  results[action.id].success
                    ? <CheckCircle size={14} className="text-emerald-400" />
                    : <AlertCircle size={14} className="text-red-400" />
                )}
                <button
                  onClick={() => runSync(action.id)}
                  disabled={loading[action.id]}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
                >
                  {loading[action.id]
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />
                  }
                  {loading[action.id] ? 'Sync...' : 'Sync'}
                </button>
              </div>
            </div>
          ))}

          {/* Squad sync */}
          <div className="bg-white/[0.03] rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">👤</span>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-white">Sync Planteles</div>
                  <div className="text-[10px] sm:text-xs text-white/40">Jugadores de los equipos • 1 call/equipo</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-8 sm:ml-0">
              <button
                onClick={() => runSync('squads', { batchSize: 10 })}
                disabled={loading.squads}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
              >
                {loading.squads
                  ? <Loader2 size={12} className="animate-spin" />
                  : <RefreshCw size={12} />
                }
                {loading.squads ? 'Sincronizando...' : 'Sync 10 equipos'}
              </button>
              {results.squads?.success && (
                <span className="text-[10px] sm:text-xs text-emerald-400">{results.squads.data.message}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results detail */}
      {Object.entries(results).filter(([, r]) => r?.success && r.data).length > 0 && (
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Últimos resultados</h3>
          <div className="space-y-2 text-xs sm:text-sm text-white/70">
            {Object.entries(results).map(([key, r]) => r?.success && (
              <div key={key} className="flex items-start gap-2 bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
                <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-medium text-white">{key}: </span>
                  <span className="break-all text-[10px] sm:text-xs">{JSON.stringify(r.data).substring(0, 120)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
