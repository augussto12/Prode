import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Trophy, ChevronDown, Star, Zap, Users, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';
import api from '../services/api';
import useCompetitionStore from '../store/competitionStore';
import MatchCard from '../components/matches/MatchCard';
import DreamTeam from './DreamTeam';

const TABS = [
  { id: 'matches', label: 'Partidos', icon: Calendar },
  { id: 'predictions', label: 'Predicciones', icon: BarChart3 },
  { id: 'dreamteam', label: 'Dream Team', icon: Star },
];

export default function Competition() {
  const [tab, setTab] = useState('matches');
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Prode states
  const [predictions, setPredictions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [filter, setFilter] = useState('all');
  const [predFilter, setPredFilter] = useState('all');
  const [showFavPicker, setShowFavPicker] = useState(false);
  const { activeCompetition } = useCompetitionStore();

  useEffect(() => {
    if (activeCompetition?.id) loadData();
  }, [activeCompetition?.id]);

  const loadData = async () => {
    try {
      const compParam = activeCompetition?.id ? `?competitionId=${activeCompetition.id}` : '';
      const [matchRes, teamRes, favRes, predRes] = await Promise.all([
        api.get(`/matches${compParam}`),
        api.get('/matches/teams'),
        api.get('/auth/me/favorites'),
        api.get('/predictions/my'),
      ]);
      setMatches(matchRes.data);
      setTeams(teamRes.data);
      setFavorites(favRes.data?.map(f => f.teamName) || []);
      setPredictions(predRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Stages para el filtro de fixtures
  const stages = [...new Set(matches.map(m => m.stage))];

  // Prode Logic
  const predictionsMap = new Map(predictions.map(p => [p.matchId, p]));

  const toggleFavorite = async (teamName) => {
    const updated = favorites.includes(teamName)
      ? favorites.filter((t) => t !== teamName)
      : [...favorites, teamName];
    setFavorites(updated);
    await api.put('/auth/me/favorites', { teams: updated });
  };

  const filteredProdeMatches = matches.filter((m) => {
    if (filter === 'favorites') {
      return favorites.includes(m.homeTeam) || favorites.includes(m.awayTeam);
    }
    if (filter !== 'all') {
      return m.stage === filter;
    }
    return true;
  });

  const sortedProdeMatches = [...filteredProdeMatches].sort((a, b) => {
    const aIsFav = favorites.includes(a.homeTeam) || favorites.includes(a.awayTeam);
    const bIsFav = favorites.includes(b.homeTeam) || favorites.includes(b.awayTeam);
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    return new Date(a.matchDate) - new Date(b.matchDate);
  });

  const groupByDateProde = (matchList) => {
    const groups = {};
    matchList.forEach((m) => {
      const dateKey = new Date(m.matchDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(m);
    });
    return groups;
  };

  const groupedProde = groupByDateProde(sortedProdeMatches);

  // Predictions stats
  const predsWithMatch = predictions.map(p => {
    const match = matches.find(m => m.id === p.matchId);
    return { ...p, match };
  }).filter(p => p.match);

  const correctPreds = predsWithMatch.filter(p => p.points > 0);
  const wrongPreds = predsWithMatch.filter(p => p.match.status === 'FINISHED' && p.points === 0);
  const pendingPreds = predsWithMatch.filter(p => p.match.status !== 'FINISHED');
  const totalPoints = predsWithMatch.reduce((s, p) => s + (p.points || 0), 0);
  const accuracy = predsWithMatch.filter(p => p.match.status === 'FINISHED').length > 0
    ? Math.round((correctPreds.length / predsWithMatch.filter(p => p.match.status === 'FINISHED').length) * 100)
    : 0;

  const filteredPreds = predFilter === 'correct' ? correctPreds
    : predFilter === 'wrong' ? wrongPreds
    : predFilter === 'pending' ? pendingPreds
    : predsWithMatch;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
          <Zap size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Mi Prode</h1>
          <p className="text-white/50 text-sm">{activeCompetition?.name || 'Hacé tus pronósticos'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer ${
              tab === t.id
                ? 'bg-white/10 text-white shadow-sm'
                : 'bg-transparent text-white/40 hover:text-white/60'
            }`}
          >
            <t.icon size={16} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Partidos Tab */}
      {tab === 'matches' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFavPicker(!showFavPicker)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border-none"
                style={{
                  background: showFavPicker ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                  color: showFavPicker ? '#000' : 'rgba(255,255,255,0.7)',
                }}
              >
                <Star size={16} /> Favoritos
              </button>
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="appearance-none bg-white/5 border border-white/10 text-white/70 text-sm px-4 py-2 pr-8 rounded-xl cursor-pointer focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Todos</option>
                  <option value="favorites">⭐ Mis Favoritos</option>
                  {stages.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Favorite Team Picker */}
          <AnimatePresence>
            {showFavPicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card rounded-2xl p-4">
                  <p className="text-white/60 text-sm mb-3">Seleccioná tus equipos favoritos para verlos primero:</p>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((team) => (
                      <button
                        key={team.name}
                        onClick={() => toggleFavorite(team.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border cursor-pointer ${
                          favorites.includes(team.name)
                            ? 'border-amber-400/50 text-amber-300'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/30'
                        }`}
                        style={favorites.includes(team.name) ? { background: 'rgba(251,191,36,0.1)' } : {}}
                      >
                        {team.logo ? (
                          <img src={team.logo} alt="" className="w-4 h-4 object-contain" />
                        ) : (
                          <span>{team.flag || '⚽'}</span>
                        )}
                        <span>{team.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Matches grouped by date → stage */}
          {Object.entries(groupedProde).map(([date, dateMatches]) => {
            const byStage = {};
            dateMatches.forEach(m => {
              const stage = m.stage || 'Sin fase';
              if (!byStage[stage]) byStage[stage] = [];
              byStage[stage].push(m);
            });

            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-white/40" />
                  <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">{date}</h2>
                </div>
                {Object.entries(byStage).map(([stage, stageMatches]) => (
                  <div key={stage} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 ml-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                      <span className="text-xs font-medium text-white/30">{stage}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stageMatches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isFavorite={favorites.includes(match.homeTeam) || favorites.includes(match.awayTeam)}
                          existingPrediction={predictionsMap.get(match.id)}
                          onPredictionSaved={loadData}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {sortedProdeMatches.length === 0 && (
            <div className="text-center py-16 text-white/40">
              <Calendar size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No hay partidos para mostrar</p>
            </div>
          )}
        </div>
      )}

      {/* Predictions Tab */}
      {tab === 'predictions' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-white">{totalPoints}</div>
              <div className="text-xs text-white/40 mt-1">Puntos Totales</div>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-emerald-400">{accuracy}%</div>
              <div className="text-xs text-white/40 mt-1">Efectividad</div>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-emerald-400">{correctPreds.length}</div>
              <div className="text-xs text-white/40 mt-1">Acertadas</div>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-red-400">{wrongPreds.length}</div>
              <div className="text-xs text-white/40 mt-1">Falladas</div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todas', count: predsWithMatch.length },
              { id: 'correct', label: 'Acertadas', count: correctPreds.length, color: 'text-emerald-400' },
              { id: 'wrong', label: 'Falladas', count: wrongPreds.length, color: 'text-red-400' },
              { id: 'pending', label: 'Pendientes', count: pendingPreds.length, color: 'text-amber-400' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setPredFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer ${
                  predFilter === f.id
                    ? 'bg-white/10 text-white'
                    : 'bg-transparent text-white/40 hover:text-white/60'
                }`}
              >
                {f.label} <span className={f.color || 'text-white/30'}>({f.count})</span>
              </button>
            ))}
          </div>

          {/* Predictions List */}
          <div className="space-y-2">
            {filteredPreds.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
                <p>No hay predicciones para mostrar</p>
              </div>
            ) : (
              filteredPreds.map(pred => {
                const m = pred.match;
                if (!m) return null;
                const isFinished = m.status === 'FINISHED';
                const isCorrect = pred.points > 0;
                const isExact = pred.points >= 5;
                
                return (
                  <motion.div
                    key={pred.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`glass-card rounded-xl p-4 border-l-[3px] ${
                      !isFinished ? 'border-l-amber-500/50' : isCorrect ? 'border-l-emerald-500' : 'border-l-red-500/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      {/* Match Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-white/30 mb-1.5">
                          <span>{m.stage}</span>
                          <span>•</span>
                          <span>{new Date(m.matchDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-white truncate">{m.homeTeam}</span>
                          <span className="text-xs text-white/30">vs</span>
                          <span className="text-sm font-medium text-white truncate">{m.awayTeam}</span>
                        </div>
                      </div>

                      {/* Prediction */}
                      <div className="text-center shrink-0">
                        <div className="text-[10px] text-white/30 mb-0.5">Tu predicción</div>
                        <div className="text-lg font-black text-white font-mono">
                          {pred.homeScore} - {pred.awayScore}
                        </div>
                      </div>

                      {/* Result */}
                      <div className="text-center shrink-0">
                        {isFinished ? (
                          <>
                            <div className="text-[10px] text-white/30 mb-0.5">Resultado</div>
                            <div className="text-lg font-black text-white/60 font-mono">
                              {m.homeScore} - {m.awayScore}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Clock size={14} />
                            <span className="text-xs font-medium">Pendiente</span>
                          </div>
                        )}
                      </div>

                      {/* Points badge */}
                      <div className="shrink-0">
                        {isFinished ? (
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isExact ? 'bg-emerald-500/20 text-emerald-300' :
                            isCorrect ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {pred.points || 0} pts
                          </div>
                        ) : (
                          <div className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 text-white/30">
                            — pts
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Dream Team Tab */}
      {tab === 'dreamteam' && <DreamTeam />}
    </div>
  );
}
