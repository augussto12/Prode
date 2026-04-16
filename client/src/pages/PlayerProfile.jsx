import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, ArrowRightLeft, BarChart3, Calendar } from 'lucide-react';
import api from '../services/api';
import { tCountry } from '../utils/translations';

const TABS = [
  { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
  { id: 'trophies', label: 'Trofeos', icon: Trophy },
  { id: 'transfers', label: 'Transferencias', icon: ArrowRightLeft },
];

export default function PlayerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    try {
      const { data: result } = await api.get(`/explorer/players/${id}`);
      setData(result);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  if (!data?.stats) {
    return <div className="text-center py-10 text-white/40">Jugador no encontrado</div>;
  }

  const player = data.stats.player;
  const allStats = data.stats.statistics || [];
  const trophies = data.trophies || [];
  const transfers = data.transfers || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white cursor-pointer bg-transparent border-none transition-all">
        <ArrowLeft size={16} /> Volver
      </button>

      {/* Player Header */}
      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-r from-indigo-600 to-purple-600" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 w-full">
          {player?.photo ? (
            <img src={player.photo} alt={player.name} className="w-28 h-28 rounded-2xl object-cover bg-white/10 border-2 border-white/20" />
          ) : (
            <div className="w-28 h-28 rounded-2xl bg-white/10 flex items-center justify-center text-4xl font-bold text-white/30">
              {player?.name?.charAt(0)}
            </div>
          )}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-black text-white">{player?.firstname} {player?.lastname}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
              <span className="text-sm text-white/50">{tCountry(player?.nationality)}</span>
              {player?.age && <span className="text-sm text-white/50">{player.age} años</span>}
              {player?.height && <span className="text-sm text-white/50">{player.height}</span>}
              {player?.weight && <span className="text-sm text-white/50">{player.weight}</span>}
            </div>
            {player?.birth?.date && (
              <div className="flex items-center justify-center md:justify-start gap-1 mt-1 text-xs text-white/30">
                <Calendar size={10} />
                Nacido el {new Date(player.birth.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {player.birth.place && ` en ${player.birth.place}, ${player.birth.country}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border-none whitespace-nowrap shrink-0 ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 bg-transparent'
            }`}>
            <t.icon size={16} /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {allStats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                {s.team?.logo && <img src={s.team.logo} alt="" className="w-8 h-8 object-contain" />}
                <div>
                  <div className="text-sm font-semibold text-white">{s.team?.name}</div>
                  <div className="text-xs text-white/30">{s.league?.name} — {s.league?.season}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {[
                  { label: 'Partidos', value: s.games?.appearences },
                  { label: 'Titular', value: s.games?.lineups },
                  { label: 'Minutos', value: s.games?.minutes },
                  { label: 'Goles', value: s.goals?.total, color: 'text-emerald-400' },
                  { label: 'Asistencias', value: s.goals?.assists, color: 'text-blue-400' },
                  { label: 'Tiros', value: s.shots?.total },
                  { label: 'Tiros al arco', value: s.shots?.on },
                  { label: 'Pases clave', value: s.passes?.key },
                  { label: 'Duelos ganados', value: s.duels?.won },
                  { label: 'Regates', value: s.dribbles?.success },
                  { label: 'Amarillas', value: s.cards?.yellow, color: 'text-yellow-400' },
                  { label: 'Rojas', value: s.cards?.red, color: 'text-red-400' },
                ].filter(x => x.value != null).map(stat => (
                  <div key={stat.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
                    <div className={`text-lg font-bold ${stat.color || 'text-white'}`}>{stat.value}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Trophies Tab */}
      {tab === 'trophies' && (
        <div className="glass-card rounded-2xl p-5">
          {trophies.length === 0 ? (
            <div className="text-center py-8 text-white/40">Sin trofeos registrados</div>
          ) : (
            <div className="space-y-2">
              {trophies.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    t.place === 'Winner' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/40'
                  }`}>
                    <Trophy size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{t.league}</div>
                    <div className="text-xs text-white/30">{t.country} — {t.season}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    t.place === 'Winner' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/50'
                  }`}>
                    {t.place === 'Winner' ? '🏆 Campeón' : t.place}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transfers Tab */}
      {tab === 'transfers' && (
        <div className="glass-card rounded-2xl p-5">
          {transfers.length === 0 ? (
            <div className="text-center py-8 text-white/40">Sin transferencias registradas</div>
          ) : (
            <div className="space-y-3">
              {transfers.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02]">
                  <div className="text-xs text-white/30 w-16 shrink-0 text-center">
                    {t.date ? new Date(t.date).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }) : '—'}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {t.teams?.out?.logo && <img src={t.teams.out.logo} alt="" className="w-6 h-6 object-contain" />}
                    <span className="text-xs text-white/60 truncate">{t.teams?.out?.name}</span>
                  </div>
                  <ArrowRightLeft size={14} className="text-white/20 shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {t.teams?.in?.logo && <img src={t.teams.in.logo} alt="" className="w-6 h-6 object-contain" />}
                    <span className="text-xs text-white font-medium truncate">{t.teams?.in?.name}</span>
                  </div>
                  <span className={`text-xs shrink-0 px-2 py-1 rounded ${
                    t.type === 'Free' ? 'text-green-400 bg-green-500/10' :
                    t.type === 'Loan' ? 'text-blue-400 bg-blue-500/10' :
                    'text-white/40 bg-white/5'
                  }`}>
                    {t.type === 'Free' ? 'Libre' : t.type === 'Loan' ? 'Préstamo' : t.type || '—'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
