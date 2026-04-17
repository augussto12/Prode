import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, Star, BarChart3, List } from 'lucide-react';
import api from '../../services/api';
import MatchCard from './MatchCard';
import PredictionHistory from './PredictionHistory';

export default function ProdeMatches({ competitionId, initialTab = 'matches' }) {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [filter, setFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('upcoming'); // 'upcoming', 'past', 'all'
  const [showFavPicker, setShowFavPicker] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // 'matches', 'history'

  // Sincronizar tab cuando Competition cambia entre tabs matches/predictions
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (competitionId) {
      loadData();
    }
  }, [competitionId]);

  const loadData = async () => {
    try {
      const compParam = `?competitionId=${competitionId}`;
      
      // 1. Get competition info
      const compRes = await api.get(`/competitions/${competitionId}`);
      const leagueId = compRes.data.externalId;
      const season = compRes.data.season;

      // 2. Fetch fixtures, favorites, and predictions in parallel
      const [fixturesRes, favRes, predRes] = await Promise.all([
        api.get(`/explorer/leagues/${leagueId}/fixtures?season=${season}`),
        api.get('/auth/me/favorites'),
        api.get(`/predictions/my${compParam}`),
      ]);

      const fixtures = fixturesRes.data || [];
      const userPreds = predRes.data || [];

      // Mapear status de la API a nuestro enum local
      const statusMap = {
        'NS': 'SCHEDULED', 'TBD': 'SCHEDULED',
        '1H': 'LIVE', '2H': 'LIVE', 'HT': 'LIVE', 'ET': 'LIVE', 'P': 'LIVE', 'BT': 'LIVE', 'LIVE': 'LIVE',
        'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
        'PST': 'POSTPONED', 'SUSP': 'POSTPONED', 'INT': 'POSTPONED',
        'CANC': 'CANCELLED', 'ABD': 'CANCELLED', 'AWD': 'CANCELLED', 'WO': 'CANCELLED',
      };

      // Mapear predictions por externalFixtureId
      const predMap = new Map(userPreds.map(p => [p.externalFixtureId, p]));

      const extractedTeams = new Map();

      // Normalizar datos de fixtures para el MatchCard
      const normalizedMatches = fixtures.map((f) => {
        const fix = f.fixture;
        const teams = f.teams;
        const goals = f.goals;
        const round = f.league.round || '';
        const stage = round.replace('Group Stage - ', 'Grupo ').replace(/ - \d+$/, '');

        // Extract teams for the favorites picker
        if (!extractedTeams.has(teams.home.id)) {
          extractedTeams.set(teams.home.id, { id: teams.home.id, name: teams.home.name, logo: teams.home.logo });
        }
        if (!extractedTeams.has(teams.away.id)) {
          extractedTeams.set(teams.away.id, { id: teams.away.id, name: teams.away.name, logo: teams.away.logo });
        }

        return {
          id: fix.id, // Usamos el externalId como la key / id principal en el frontend
          externalId: fix.id,
          competitionId,
          homeTeam: teams.home.name,
          awayTeam: teams.away.name,
          homeTeamLogo: teams.home.logo,
          awayTeamLogo: teams.away.logo,
          homeTeamId: teams.home.id,
          awayTeamId: teams.away.id,
          matchDate: fix.date,
          status: statusMap[fix.status?.short] || 'SCHEDULED',
          statusShort: fix.status?.short,
          elapsed: fix.status?.elapsed,
          homeGoals: goals.home,
          awayGoals: goals.away,
          stage: stage,
          round: round,
          venue: fix.venue ? `${fix.venue.name}, ${fix.venue.city}` : null,
          prediction: predMap.get(fix.id) || null,
        };
      });

      setMatches(normalizedMatches);
      setTeams(Array.from(extractedTeams.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setFavorites(favRes.data?.map(f => f.teamName) || []);
      setPredictions(userPreds);
    } catch (err) {
      console.error('Error loading matches/predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  const stages = [...new Set(matches.map(m => m.stage))];
  const predictionsMap = new Map(predictions.map(p => [p.externalFixtureId, p]));

  const toggleFavorite = async (teamName) => {
    const updated = favorites.includes(teamName)
      ? favorites.filter((t) => t !== teamName)
      : [...favorites, teamName];
    setFavorites(updated);
    await api.put('/auth/me/favorites', { teams: updated });
  };

  const filteredMatches = matches.filter((m) => {
    // 1. Team/Favorite Filter
    if (filter === 'favorites') {
      if (!favorites.includes(m.homeTeam) && !favorites.includes(m.awayTeam)) return false;
    } else if (filter !== 'all') {
      if (m.stage !== filter) return false;
    }

    // 2. Time/Status Filter
    if (timeFilter === 'upcoming') {
      // Hide finished matches
      if (['FINISHED', 'AET', 'PEN', 'FT'].includes(m.status)) return false;
    } else if (timeFilter === 'past') {
      // Show ONLY finished/past matches
      if (!['FINISHED', 'AET', 'PEN', 'FT'].includes(m.status) && new Date(m.matchDate) > new Date()) return false;
    }

    return true;
  });

  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const aIsFav = favorites.includes(a.homeTeam) || favorites.includes(a.awayTeam);
    const bIsFav = favorites.includes(b.homeTeam) || favorites.includes(b.awayTeam);
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    return new Date(a.matchDate) - new Date(b.matchDate);
  });

  const groupedMatches = {};
  sortedMatches.forEach((m) => {
    const dateKey = new Date(m.matchDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groupedMatches[dateKey]) groupedMatches[dateKey] = [];
    groupedMatches[dateKey].push(m);
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Sub-Tabs: Partidos / Historial */}
      <div className="flex bg-white/5 p-1 rounded-xl w-fit mb-4">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-white/10 text-white shadow-sm'
              : 'bg-transparent text-white/40 hover:text-white/60'
          }`}
        >
          <List size={16} /> Partidos
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white/10 text-white shadow-sm'
              : 'bg-transparent text-white/40 hover:text-white/60'
          }`}
        >
          <BarChart3 size={16} /> Mi Historial / Puntos
        </button>
      </div>

      {activeTab === 'history' ? (
        <PredictionHistory predictions={predictions} matches={matches} />
      ) : (
        <>
          {/* Filters Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
        {/* Time Segmented Control */}
        <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full xl:w-auto overflow-x-auto scrollbar-hide">
          {[
            { id: 'upcoming', label: 'Próximos / En Vivo' },
            { id: 'past', label: 'Terminados' },
            { id: 'all', label: 'Todos' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTimeFilter(t.id)}
              className={`flex-1 xl:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-all border-none cursor-pointer whitespace-nowrap ${
                timeFilter === t.id
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-transparent text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Other Filters (Favorites, Stage) */}
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="relative flex-1 md:flex-none">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-white/10 text-white/70 text-sm px-4 py-2 pr-8 rounded-xl cursor-pointer focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todas las Fases</option>
              <option value="favorites">⭐ Mis Favoritos</option>
              {stages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

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
                        ? 'border-amber-400/50 text-amber-300 bg-amber-400/10'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/30'
                    }`}
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

      {Object.entries(groupedMatches).map(([date, dateMatches]) => {
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
                      hideStage={true}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {sortedMatches.length === 0 && (
        <div className="text-center py-16 text-white/40 glass-card rounded-xl">
          <Calendar size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No hay partidos para mostrar</p>
        </div>
          )}
        </>
      )}
    </div>
  );
}
