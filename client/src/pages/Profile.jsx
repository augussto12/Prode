import { useState, useEffect } from 'react';
import { User, Mail, Save, Palette, Download, LogOut } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import api from '../services/api';

export default function Profile() {
  const user = useAuthStore(state => state.user);
  const fetchProfile = useAuthStore(state => state.fetchProfile);
  const logout = useAuthStore(state => state.logout);
  const { setPersonalTheme } = useThemeStore();
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    themePrimary: user?.themePrimary || '#6366f1',
    themeSecondary: user?.themeSecondary || '#8b5cf6',
    themeAccent: user?.themeAccent || '#f59e0b',
    themeBgFrom: user?.themeBgFrom || '#0f172a',
    themeBgTo: user?.themeBgTo || '#1e1b4b',
  });

  const [players, setPlayers] = useState([]);
  const [outrights, setOutrights] = useState({
    championTeam: '', runnerUpTeam: '', topScorerId: '', bestPlayerId: ''
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOutrights, setSavingOutrights] = useState(false);
  const [msg, setMsg] = useState(null);

  const [canInstall, setCanInstall] = useState(!!window.deferredPwaPrompt);

  useEffect(() => {
    loadOutrightsData();
    const handleReady = () => setCanInstall(true);
    window.addEventListener('pwaPromptReady', handleReady);
    return () => window.removeEventListener('pwaPromptReady', handleReady);
  }, []);

  const loadOutrightsData = async () => {
    try {
      const [playersRes, outrightsRes] = await Promise.all([
        api.get('/dreamteam/players'),
        api.get('/outrights')
      ]);
      setPlayers(playersRes.data);
      if (outrightsRes.data) {
        setOutrights({
          championTeam: outrightsRes.data.championTeam || '',
          runnerUpTeam: outrightsRes.data.runnerUpTeam || '',
          topScorerId: outrightsRes.data.topScorerId || '',
          bestPlayerId: outrightsRes.data.bestPlayerId || '',
        });
      }
    } catch (e) { console.error('Failed to load outrights', e); }
  };

  const handleInstall = async () => {
    if (!window.deferredPwaPrompt) return;
    window.deferredPwaPrompt.prompt();
    const { outcome } = await window.deferredPwaPrompt.userChoice;
    if (outcome === 'accepted') {
      window.deferredPwaPrompt = null;
      setCanInstall(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setMsg(null);
    try {
      await api.put('/auth/me', form);
      await fetchProfile();
      setPersonalTheme(form);
      setMsg({ type: 'success', text: '¡Perfil actualizado y tema aplicado ✅!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Error al guardar' });
    }
    finally { setSavingProfile(false); }
  };

  const handleSaveOutrights = async (e) => {
    e.preventDefault();
    setSavingOutrights(true);
    setMsg(null);
    try {
      await api.post('/outrights', outrights);
      setMsg({ type: 'success', text: '¡Tus apuestas globales de la Fase 3 fueron confirmadas! 🏆' });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Error al guardar apuestas' });
    } finally {
      setSavingOutrights(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-white/10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
            <User size={32} />
          </div>
          <div>
            <div className="text-lg font-semibold text-white">{user?.displayName}</div>
            <div className="text-sm text-white/40">@{user?.username}</div>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${user?.role === 'SUPERADMIN' ? 'bg-red-500/20 text-red-400' :
              user?.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' :
                'bg-indigo-500/20 text-indigo-400'
              }`}>{user?.role}</span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div>
            <label className="block text-white/60 text-sm mb-1.5">Nombre para mostrar</label>
            <input type="text" value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-1.5">Email</label>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white/40 text-sm cursor-not-allowed">
              <Mail size={14} /> {user?.email}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <label className="text-white text-sm font-medium mb-3 flex items-center gap-2"><Palette size={16} /> Tema Personal</label>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Primario', key: 'themePrimary' },
                { label: 'Secundario', key: 'themeSecondary' },
                { label: 'Acento', key: 'themeAccent' },
                { label: 'Fondo desde', key: 'themeBgFrom' },
                { label: 'Fondo hasta', key: 'themeBgTo' },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center gap-2">
                  <input type="color" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer bg-transparent p-0" />
                  <span className="text-xs text-white/40">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/30 mt-2">Estos colores afectarán tu vista a menos que entres a un grupo específico.</p>
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-1.5">Estadísticas</label>
          </div>

          <button type="submit" disabled={savingProfile} className="w-full sm:w-auto px-8 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-4 border-none cursor-pointer ms-auto">
            <Save size={18} /> {savingProfile ? 'Guardando Ajustes...' : 'Guardar Perfil'}
          </button>
        </form>
      </div>

      <div className="glass-card rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mx-20 -my-20 pointer-events-none"></div>
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <span className="text-2xl">🔮</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Pronósticos Globales</h2>
            <p className="text-white/50 text-sm">Estas predicciones suman puntos al finalizar todo el mundial</p>
          </div>
        </div>

        <form onSubmit={handleSaveOutrights} className="space-y-6 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/40 font-bold mb-2 ml-1">🏆 Campeón (Copa)</label>
              <input type="text"
                value={outrights.championTeam}
                onChange={e => setOutrights({ ...outrights, championTeam: e.target.value })}
                placeholder="Ej: Argentina" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-amber-500/50 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/40 font-bold mb-2 ml-1">🥈 Subcampeón</label>
              <input type="text"
                value={outrights.runnerUpTeam}
                onChange={e => setOutrights({ ...outrights, runnerUpTeam: e.target.value })}
                placeholder="Ej: Francia" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-amber-500/50 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/40 font-bold mb-2 ml-1">⚽ Bota de Oro</label>
              <select
                value={outrights.topScorerId}
                onChange={e => setOutrights({ ...outrights, topScorerId: e.target.value })}
                className="w-full bg-[#1e1b4b] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">Seleccionar Jugador...</option>
                {players.map(p => <option key={`ts-${p.id}`} value={p.id}>{p.name} ({p.country})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/40 font-bold mb-2 ml-1">⭐ Balón de Oro</label>
              <select
                value={outrights.bestPlayerId}
                onChange={e => setOutrights({ ...outrights, bestPlayerId: e.target.value })}
                className="w-full bg-[#1e1b4b] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">Seleccionar Jugador...</option>
                {players.map(p => <option key={`bp-${p.id}`} value={p.id}>{p.name} ({p.country})</option>)}
              </select>
            </div>
          </div>

          <button type="submit" disabled={savingOutrights} className="w-full sm:w-auto px-8 py-3 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-4 border-none cursor-pointer ms-auto shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Save size={18} /> {savingOutrights ? 'Confirmando...' : 'Fijar Apuestas Globales'}
          </button>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {canInstall && (
          <button
            onClick={handleInstall}
            className="flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all border-none"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}
          >
            <Download size={20} /> Instalar la Aplicación (PC/Android)
          </button>
        )}

        <button
          onClick={logout}
          className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-red-500/30 text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-500/10 cursor-pointer transition-all"
        >
          <LogOut size={20} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
