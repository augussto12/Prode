import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Star, Filter, ChevronDown } from 'lucide-react';
import api from '../services/api';
import MatchCard from '../components/matches/MatchCard';

export default function Dashboard() {
  const [matches, setMatches] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'favorites' | stage name
  const [loading, setLoading] = useState(true);
  const [showFavPicker, setShowFavPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [matchRes, favRes, teamRes] = await Promise.all([
        api.get('/matches'),
        api.get('/auth/favorites'),
        api.get('/matches/teams'),
      ]);
      setMatches(matchRes.data);
      setFavorites(favRes.data.map((f) => f.teamName));
      setTeams(teamRes.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (teamName) => {
    const updated = favorites.includes(teamName)
      ? favorites.filter((t) => t !== teamName)
      : [...favorites, teamName];
    setFavorites(updated);
    await api.put('/auth/favorites', { teams: updated });
  };

  const stages = [...new Set(matches.map((m) => m.stage))];

  const filteredMatches = matches.filter((m) => {
    if (filter === 'favorites') {
      return favorites.includes(m.homeTeam) || favorites.includes(m.awayTeam);
    }
    if (filter !== 'all') {
      return m.stage === filter;
    }
    return true;
  });

  // Sort: favorites first, then by date
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const aIsFav = favorites.includes(a.homeTeam) || favorites.includes(a.awayTeam);
    const bIsFav = favorites.includes(b.homeTeam) || favorites.includes(b.awayTeam);
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    return new Date(a.matchDate) - new Date(b.matchDate);
  });

  // Group by date
  const groupByDate = (matches) => {
    const groups = {};
    matches.forEach((m) => {
      const dateKey = new Date(m.matchDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(m);
    });
    return groups;
  };

  const grouped = groupByDate(sortedMatches);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Partidos</h1>
          <p className="text-white/50 text-sm mt-1">Hacé tus pronósticos antes de que comience cada partido</p>
        </div>

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
              <p className="text-white/60 text-sm mb-3">Seleccioná tus selecciones favoritas para verlas primero:</p>
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
                    <span>{team.flag}</span>
                    <span>{team.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Matches grouped by date */}
      {Object.entries(grouped).map(([date, dateMatches]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">{date}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dateMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                isFavorite={favorites.includes(match.homeTeam) || favorites.includes(match.awayTeam)}
                onPredictionSaved={loadData}
              />
            ))}
          </div>
        </div>
      ))}

      {sortedMatches.length === 0 && (
        <div className="text-center py-16 text-white/40">
          <Calendar size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No hay partidos para mostrar</p>
        </div>
      )}
    </div>
  );
}
