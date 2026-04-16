import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Check, Users, Settings, LogOut, Trophy, Trash2, ShieldBan, ShieldCheck } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import GroupChat from '../components/chat/GroupChat';

export default function GroupView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setTheme, resetTheme } = useThemeStore();

  const [group, setGroup] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [bannedList, setBannedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'banned'

  useEffect(() => {
    loadGroup();
    return () => resetTheme();
  }, [id]);

  const loadGroup = async () => {
    try {
      const { data: gData } = await api.get(`/groups/${id}`);
      setGroup(gData);

      if (gData.primaryColor) {
        setTheme({ primary: gData.primaryColor, secondary: gData.secondaryColor, accent: gData.accentColor, bgFrom: gData.bgGradientFrom, bgTo: gData.bgGradientTo });
      }

      const { data: lbData } = await api.get(`/groups/${id}/leaderboard`);
      setLeaderboard(lbData);

      // Load banned list if admin
      if (gData.isAdmin) {
        try {
          const { data: bData } = await api.get(`/groups/${id}/banned`);
          setBannedList(bData);
        } catch (e) { /* silently fail for non-admins */ }
      }
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        navigate('/groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    useToastStore.getState().askConfirm({
      title: 'Abandonar grupo',
      message: '¿Seguro quieres salir? Tus puntajes dejarán de ser visibles aquí.',
      confirmText: 'Salir',
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}/leave`);
          navigate('/groups');
          useToastStore.getState().addToast({ type: 'info', message: 'Has abandonado el grupo' });
        } catch (err) { 
          useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error' }); 
        }
      }
    });
  };

  const handleKick = async (userIdToKick) => {
    useToastStore.getState().askConfirm({
      title: 'Banear Miembro',
      message: 'El usuario será baneado del grupo y no podrá volver a unirse hasta que lo desbanees.',
      confirmText: 'Banear',
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}/members/${userIdToKick}`);
          loadGroup();
          useToastStore.getState().addToast({ type: 'success', message: 'Miembro baneado del grupo' });
        } catch (err) { 
          useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al banear' }); 
        }
      }
    });
  };

  const handleUnban = async (userIdToUnban) => {
    useToastStore.getState().askConfirm({
      title: 'Desbanear Miembro',
      message: 'El usuario podrá volver a unirse al grupo con el código de invitación.',
      confirmText: 'Desbanear',
      onConfirm: async () => {
        try {
          await api.post(`/groups/${id}/unban/${userIdToUnban}`);
          loadGroup();
          useToastStore.getState().addToast({ type: 'success', message: 'Miembro desbaneado' });
        } catch (err) { 
          useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error' }); 
        }
      }
    });
  };

  const handleDelete = async () => {
    useToastStore.getState().askConfirm({
      title: 'Eliminar Grupo',
      message: 'Esta acción es irreversible y eliminará a todos los miembros y chats. ¿Borrar?',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}`);
          navigate('/groups');
          useToastStore.getState().addToast({ type: 'success', message: 'Grupo eliminado' });
        } catch (err) { 
          useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al eliminar' }); 
        }
      }
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-8 text-center text-white/50 animate-pulse">Cargando grupo...</div>;
  if (!group) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
             style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }} />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{group.name}</h1>
            <p className="text-white/60 text-sm max-w-xl">{group.description}</p>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <span className="flex items-center gap-1.5 text-white/80 bg-white/5 px-3 py-1 rounded-full">
                <Users size={16} /> {group.memberCount} miembros
              </span>
              {group.isAdmin && (
                <span className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full font-medium">
                  <Settings size={16} /> Admin
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[200px]">
            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center">
              <div className="text-xs text-white/40 mb-1">Código de Invitación</div>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-lg text-white font-bold tracking-wider">{group.inviteCode}</span>
                <button 
                  onClick={copyCode}
                  className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                  title="Copiar código"
                >
                  {copied ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              onClick={handleLeave}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-red-400 text-sm font-medium hover:bg-red-400/10 transition-colors border-none bg-transparent cursor-pointer"
            >
              <LogOut size={16} /> Salir del grupo
            </button>
            
            {group.isAdmin && (
              <button 
                onClick={handleDelete}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors border-none bg-transparent cursor-pointer relative z-10"
              >
                <Trash2 size={16} /> Eliminar Grupo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEADERBOARD / BANNED (Ocupa 2 de las 3 columnas en desktop) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-none cursor-pointer ${
                activeTab === 'leaderboard' 
                  ? 'bg-white/10 text-white' 
                  : 'bg-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <Trophy size={16} /> Tabla de Posiciones
            </button>
            {group.isAdmin && (
              <button 
                onClick={() => setActiveTab('banned')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-none cursor-pointer ${
                  activeTab === 'banned' 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-transparent text-white/40 hover:text-white/60'
                }`}
              >
                <ShieldBan size={16} /> Baneados {bannedList.length > 0 && `(${bannedList.length})`}
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'leaderboard' && (
              <motion.div
                key="leaderboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {leaderboard.map((entry) => {
                  const isMe = entry.userId === user.id;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={entry.userId}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                        isMe 
                        ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                        : 'bg-white/[0.02] border-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <div className={`w-8 text-center font-bold text-lg ${
                        entry.rank === 1 ? 'text-amber-400' :
                        entry.rank === 2 ? 'text-slate-300' :
                        entry.rank === 3 ? 'text-amber-700' :
                        'text-white/30'
                      }`}>
                        #{entry.rank}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold border border-white/20">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>

                      {/* User */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                            {entry.displayName}
                          </span>
                          {entry.isAdmin && (
                            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-semibold">ADMIN</span>
                          )}
                          {isMe && (
                            <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[10px] font-semibold">TÚ</span>
                          )}
                        </div>
                        <div className="text-xs text-white/30">@{entry.username}</div>
                      </div>

                      {/* Score & Actions */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>{entry.totalPoints}</div>
                          <div className="text-[10px] text-white/30 uppercase tracking-wider">pts</div>
                        </div>
                        
                        {/* Admin Actions */}
                        {group.isAdmin && !isMe && (
                          <button 
                            onClick={() => handleKick(entry.userId)}
                            className="ml-2 p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all bg-transparent border-none cursor-pointer"
                            title="Banear usuario">
                            <ShieldBan size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {leaderboard.length === 0 && (
                  <div className="py-12 text-center text-white/40 glass-card rounded-xl">
                    <Trophy size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Todavía no hay puntajes</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'banned' && group.isAdmin && (
              <motion.div
                key="banned"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {bannedList.length === 0 ? (
                  <div className="py-12 text-center text-white/40 glass-card rounded-xl">
                    <ShieldCheck size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No hay usuarios baneados</p>
                    <p className="text-xs text-white/20 mt-1">Todos en paz ⚽</p>
                  </div>
                ) : (
                  bannedList.map((entry) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-red-500/10 bg-red-500/[0.03]"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 font-bold border border-red-500/20">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>

                      {/* User */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{entry.displayName}</div>
                        <div className="text-xs text-white/30">@{entry.username}</div>
                        <div className="text-[10px] text-red-400/60 mt-0.5">
                          Baneado {entry.bannedAt ? new Date(entry.bannedAt).toLocaleDateString('es-AR') : ''}
                        </div>
                      </div>

                      {/* Unban */}
                      <button
                        onClick={() => handleUnban(entry.userId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors border-none cursor-pointer"
                      >
                        <ShieldCheck size={14} /> Desbanear
                      </button>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CHAT (Ocupa 1 columna) */}
        <div className="h-[400px] sm:h-[500px] lg:h-auto pb-10">
           <GroupChat groupId={id} initialMessages={group.messages || []} />
        </div>

      </div>
    </div>
  );
}
