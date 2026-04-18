import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowLeft, Trophy, ChevronDown, GitBranch } from 'lucide-react';
import api from '../services/api';
import { useBracket } from '../hooks/useBracket';
import BracketViewer from '../components/bracket/BracketViewer';

/**
 * Dedicated bracket page at /bracket/:leagueId.
 * Full-screen bracket experience with dark theme and season selector.
 */
export default function BracketPage() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [league, setLeague] = useState(null);
  const [season, setSeason] = useState(null);
  const [leagueLoading, setLeagueLoading] = useState(true);

  const availableSeasons = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

  // Fetch league info
  useEffect(() => {
    async function loadLeague() {
      try {
        const { data } = await api.get(`/explorer/leagues/${leagueId}`);
        setLeague(data);
        const activeSeason = data.seasons?.find(s => s.current)?.year || currentYear;
        setSeason(activeSeason);
      } catch (err) {
        console.error('Error loading league:', err);
      } finally {
        setLeagueLoading(false);
      }
    }
    loadLeague();
  }, [leagueId, currentYear]);

  // Fetch bracket data
  const { bracket, loading, error } = useBracket(leagueId, season);

  const leagueInfo = league?.league;

  if (leagueLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Back button */}
      <button
        onClick={() => navigate(`/liga/${leagueId}`)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white cursor-pointer bg-transparent border-none transition-all"
      >
        <ArrowLeft size={16} /> Volver a la liga
      </button>

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #6366f1)' }}
        />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-5 w-full">
          {leagueInfo?.logo ? (
            <img src={leagueInfo.logo} alt={leagueInfo.name} className="w-16 h-16 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
              <Trophy size={28} className="text-white/40" />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
              <GitBranch size={16} className="text-blue-400" />
              <span className="text-xs text-blue-400 uppercase tracking-wider font-bold">Llaves del Torneo</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {leagueInfo?.name || 'Torneo'}
            </h1>
          </div>

          {/* Season selector */}
          <div className="relative">
            <select
              value={season || currentYear}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="appearance-none bg-white/10 border border-white/20 text-white text-sm font-semibold rounded-xl px-4 py-2 pr-8 cursor-pointer hover:bg-white/15 transition-all focus:outline-none focus:border-indigo-500"
            >
              {availableSeasons.map(s => (
                <option key={s} value={s} className="bg-gray-900 text-white">{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bracket content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card rounded-2xl p-8 text-center text-red-400/70">
          {error}
        </div>
      ) : bracket?.hasKnockout ? (
        <BracketViewer
          columns={bracket.columns}
          thirdPlace={bracket.thirdPlace}
          isFullPage={true}
        />
      ) : (
        <div className="glass-card rounded-2xl p-8 text-center text-white/40">
          No hay fases eliminatorias disponibles para esta temporada.
        </div>
      )}
    </m.div>
  );
}
