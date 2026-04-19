import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { Plus, Users, LogIn, Copy, Check, Globe, Loader2 } from 'lucide-react';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import useCompetitionStore from '../store/competitionStore';

export default function GroupList() {
  const [myGroups, setMyGroups] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', isPublic: false, competitionId: '',
    primaryColor: '#6366f1', secondaryColor: '#8b5cf6', accentColor: '#f59e0b',
    bgGradientFrom: '#0f172a', bgGradientTo: '#1e1b4b',
    allowMoreShots: true, allowMoreCorners: true, allowMorePossession: true,
    allowMoreFouls: true, allowMoreCards: true, allowMoreOffsides: true, allowMoreSaves: true,
  });
  const navigate = useNavigate();
  const activeCompetition = useCompetitionStore(state => state.activeCompetition);
  const competitions = useCompetitionStore(state => state.competitions);

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      const [myRes, pubRes] = await Promise.all([
        api.get('/groups'),
        api.get('/groups/public'),
      ]);
      setMyGroups(myRes.data);
      setPublicGroups(pubRes.data.filter(pg => !myRes.data.some(mg => mg.id === pg.id)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const compId = createForm.competitionId || activeCompetition?.id;
    if (!compId) {
      useToastStore.getState().addToast({ type: 'error', message: 'Seleccioná un torneo para el prode' });
      return;
    }
    try {
      setIsCreating(true);
      const { data } = await api.post('/groups', { ...createForm, competitionId: Number(compId) });
      navigate(`/groups/${data.id}`);
    } catch (err) { 
      useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al crear grupo' }); 
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/groups/join', { inviteCode: joinCode });
      navigate(`/groups/${data.id}`);
    } catch (err) { useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Código inválido' }); }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Grupos</h1>
          <p className="text-white/50 text-sm mt-1">Creá o unite a grupos para competir con amigos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer border-none text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
            <Plus size={16} /> Crear Grupo
          </button>
          <button onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer border border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent transition-all">
            <LogIn size={16} /> Unirme
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Nuevo Grupo</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Tournament Selector */}
            <div>
              <label className="block text-white/60 text-sm mb-2">Torneo del Prode *</label>
              {competitions.length === 0 ? (
                <div className="text-sm text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  ⚠️ No hay torneos sincronizados. Pedile al admin que sincronice desde el Admin Panel.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {competitions.map(comp => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setCreateForm({...createForm, competitionId: comp.id})}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        createForm.competitionId === comp.id
                          ? 'bg-indigo-500/15 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]'
                      }`}
                    >
                      {comp.logo && <img src={comp.logo} alt="" width={32} height={32} className="w-8 h-8 object-contain shrink-0" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${createForm.competitionId === comp.id ? 'text-indigo-300' : 'text-white/80'}`}>{comp.name}</div>
                        <div className="text-[10px] text-white/40">Temporada {comp.season}</div>
                      </div>
                      {createForm.competitionId === comp.id && (
                        <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/60 text-sm mb-1">Nombre del grupo *</label>
                <input type="text" value={createForm.name} onChange={(e) => setCreateForm({...createForm, name: e.target.value})} required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Ej: Los Pibes del Barrio" />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1">Descripción</label>
                <input type="text" value={createForm.description} onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Opcional" />
              </div>
            </div>

            <div>
              <label className="block text-white/60 text-sm mb-2">Módulos de Juego (Extras)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'allowMoreCorners', label: '⛳ Más Córners' },
                  { key: 'allowMoreFouls', label: '🦵 Más Faltas' },
                  { key: 'allowMoreShots', label: '🎯 Más Remates' },
                  { key: 'allowMoreCards', label: '🟨 Más Tarjetas' },
                  { key: 'allowMorePossession', label: '⚽ Más Posesión' },
                  { key: 'allowMoreOffsides', label: '🏁 Más Offsides' },
                  { key: 'allowMoreSaves', label: '🧤 Más Atajadas' },
                ].map(m => (
                  <div key={m.key} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                       onClick={() => setCreateForm(prev => ({ ...prev, [m.key]: !prev[m.key] }))}>
                    <span className="text-xs text-white/80 font-medium">{m.label}</span>
                    <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${createForm[m.key] ? 'bg-indigo-500' : 'bg-black/60 shadow-inner'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-[2px] shadow-sm transition-all ${createForm[m.key] ? 'left-[18px]' : 'left-[2px]'}`} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/40 mt-1.5 ml-1">* El resultado de goles y ganador siempre estarán activos.</p>
            </div>

            <div>
              <label className="block text-white/60 text-sm mb-2">Colores del tema</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Primario', key: 'primaryColor' },
                  { label: 'Secundario', key: 'secondaryColor' },
                  { label: 'Acento', key: 'accentColor' },
                  { label: 'Fondo desde', key: 'bgGradientFrom' },
                  { label: 'Fondo hasta', key: 'bgGradientTo' },
                ].map(({ label, key }) => (
                  <div key={key} className="flex items-center gap-2">
                    <input type="color" value={createForm[key]} onChange={(e) => setCreateForm({...createForm, [key]: e.target.value})}
                      className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer bg-transparent" />
                    <span className="text-xs text-white/40">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPublic" checked={createForm.isPublic} onChange={(e) => setCreateForm({...createForm, isPublic: e.target.checked})}
                className="rounded cursor-pointer" />
              <label htmlFor="isPublic" className="text-sm text-white/60 cursor-pointer">Grupo público (visible para todos)</label>
            </div>

            <button type="submit" disabled={isCreating} className="px-6 py-2.5 rounded-xl text-white font-medium text-sm cursor-pointer border-none hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
              {isCreating && <Loader2 size={16} className="animate-spin" />}
              {isCreating ? 'Creando...' : 'Crear Grupo'}
            </button>
          </form>
        </m.div>
      )}

      {/* Join Form */}
      {showJoin && (
        <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Unirme con código</h3>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} required placeholder="Pegar código de invitación"
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500" />
            <button type="submit" className="px-6 py-2.5 rounded-xl text-white font-medium text-sm cursor-pointer border-none hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>Unirme</button>
          </form>
        </m.div>
      )}

      {/* My Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myGroups.map((group, i) => (
          <m.div key={group.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/groups/${group.id}`} className="block glass-card rounded-2xl p-5 hover:bg-white/[0.08] transition-all no-underline group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${group.primaryColor}, ${group.secondaryColor})` }}>
                  <Users size={20} />
                </div>
                <button onClick={(e) => { e.preventDefault(); copyCode(group.inviteCode, group.id); }}
                  className="text-white/30 hover:text-white/60 bg-transparent border-none cursor-pointer p-1" title="Copiar código" aria-label="Copiar código de invitación">
                  {copiedId === group.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <h3 className="text-white font-semibold text-base mb-1 group-hover:text-indigo-300 transition-colors">{group.name}</h3>
              <p className="text-white/40 text-xs mb-3 line-clamp-1">{group.description || 'Sin descripción'}</p>
              <div className="flex items-center justify-between text-xs text-white/40">
                <span className="flex items-center gap-1"><Users size={12} /> {group.memberCount} miembros</span>
                <span className="font-semibold text-amber-400">{group.totalPoints} pts</span>
              </div>
              {group.competition && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                  {group.competition.logo && <img src={group.competition.logo} alt="" width={16} height={16} className="w-4 h-4 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />}
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">{group.competition.name}</span>
                </div>
              )}
            </Link>
          </m.div>
        ))}
      </div>

      {myGroups.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p>Todavía no estás en ningún grupo</p>
          <p className="text-sm mt-1">Creá uno o unite con un código de invitación</p>
        </div>
      )}

      {/* Public Groups */}
      {publicGroups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Globe size={18} className="text-white/40" /> Grupos Públicos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicGroups.map((group) => (
              <div key={group.id} className="glass-card rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-1">{group.name}</h3>
                <p className="text-white/40 text-xs mb-3">{group.description || 'Sin descripción'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 flex items-center gap-1"><Users size={12} /> {group._count?.groupUsers} miembros</span>
                  <button onClick={async () => { await api.post('/groups/join', { inviteCode: group.inviteCode }); loadGroups(); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 border border-indigo-400/30 bg-indigo-500/10 cursor-pointer hover:bg-indigo-500/20 transition-all">
                    Unirme
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
