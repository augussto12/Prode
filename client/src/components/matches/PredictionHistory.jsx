import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Crosshair, Flag } from 'lucide-react';

export default function PredictionHistory({ predictions, matches }) {
  const [predFilter, setPredFilter] = useState('all');

  const predsWithMatch = predictions.map(p => {
    const match = matches.find(m => m.id === p.externalFixtureId);
    return { ...p, match };
  }).filter(p => p.match);

  const correctPreds = predsWithMatch.filter(p => p.pointsEarned > 0);
  const wrongPreds = predsWithMatch.filter(p => p.match.status === 'FINISHED' && p.pointsEarned === 0);
  const pendingPreds = predsWithMatch.filter(p => p.match.status !== 'FINISHED');
  const totalPoints = predsWithMatch.reduce((s, p) => s + (p.pointsEarned || 0), 0);
  const accuracy = predsWithMatch.filter(p => p.match.status === 'FINISHED').length > 0
    ? Math.round((correctPreds.length / predsWithMatch.filter(p => p.match.status === 'FINISHED').length) * 100)
    : 0;

  const filteredPreds = predFilter === 'correct' ? correctPreds
    : predFilter === 'wrong' ? wrongPreds
    : predFilter === 'pending' ? pendingPreds
    : predsWithMatch;

  // Helper to show market label with team name
  const getMarketLabel = (value, match) => {
    if (value === 'HOME') return match.homeTeam;
    if (value === 'AWAY') return match.awayTeam;
    if (value === 'EQUAL') return 'Igual';
    return '—';
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-white">{totalPoints}</div>
          <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Puntos Totales</div>
        </div>
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-emerald-400">{accuracy}%</div>
          <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Efectividad</div>
        </div>
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-emerald-400">{correctPreds.length}</div>
          <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Acertadas</div>
        </div>
        <div className="glass-card rounded-xl p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-black text-red-400">{wrongPreds.length}</div>
          <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">Falladas</div>
        </div>
      </div>

      {/* Filter — scrollable on mobile */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-0.5 -mx-1 px-1">
        {[
          { id: 'all', label: 'Todas', count: predsWithMatch.length },
          { id: 'correct', label: 'Acertadas', count: correctPreds.length, color: 'text-emerald-400' },
          { id: 'wrong', label: 'Falladas', count: wrongPreds.length, color: 'text-red-400' },
          { id: 'pending', label: 'Pendientes', count: pendingPreds.length, color: 'text-amber-400' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setPredFilter(f.id)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
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
          <div className="text-center py-10 sm:py-12 text-white/40">
            <BarChart3 size={40} className="mx-auto mb-3 sm:mb-4 opacity-30" />
            <p className="text-sm">No hay predicciones para mostrar</p>
          </div>
        ) : (
          filteredPreds.map(pred => {
            const m = pred.match;
            if (!m) return null;
            const isFinished = m.status === 'FINISHED';
            const isCorrect = pred.pointsEarned > 0;
            const isExact = pred.pointsEarned >= 5;
            const hasExtras = pred.moreShots || pred.moreCorners;
            
            return (
              <motion.div
                key={pred.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-xl p-3 sm:p-4 border-l-[3px] ${
                  !isFinished ? 'border-l-amber-500/50' : isCorrect ? 'border-l-emerald-500' : 'border-l-red-500/50'
                }`}
              >
                {/* Top row: Match info + Score Prediction + Result */}
                <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:justify-between">
                  {/* Match Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/30 mb-1 sm:mb-1.5">
                      <span className="truncate">{m.stage}</span>
                      <span>•</span>
                      <span className="shrink-0">{new Date(m.matchDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {m.homeTeamLogo && <img src={m.homeTeamLogo} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0" />}
                      <span className="text-xs sm:text-sm font-medium text-white truncate">{m.homeTeam}</span>
                      <span className="text-[10px] sm:text-xs text-white/30 shrink-0">vs</span>
                      <span className="text-xs sm:text-sm font-medium text-white truncate">{m.awayTeam}</span>
                      {m.awayTeamLogo && <img src={m.awayTeamLogo} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0" />}
                    </div>
                  </div>

                  {/* Prediction + Result row */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-1 sm:pt-0 border-t border-white/5 sm:border-none">
                    {/* Prediction */}
                    <div className="text-center shrink-0">
                      <div className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider mb-0.5 sm:mb-1">Pronóstico</div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-lg text-xs sm:text-sm font-bold text-white border border-white/10">
                        {pred.homeGoals} - {pred.awayGoals}
                        {pred.isJoker && <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]">x2</span>}
                      </div>
                    </div>

                    {/* Result */}
                    <div className="text-center shrink-0 min-w-[60px] sm:w-20">
                      {isFinished ? (
                        <>
                          <div className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider mb-0.5 sm:mb-1">Resultado</div>
                          <div className="text-xs sm:text-sm font-bold text-white mb-1">{m.homeGoals} - {m.awayGoals}</div>
                          <div className={`text-[9px] sm:text-[10px] font-bold ${isExact ? 'text-emerald-400' : isCorrect ? 'text-blue-400' : 'text-red-400'}`}>
                            {isExact ? 'EXACTO' : isCorrect ? 'ACIERTO' : 'FALLÓ'}
                            <span className="ml-1 opacity-70">+{pred.pointsEarned}pts</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] sm:text-xs text-white/30 italic">{m.status === 'SCHEDULED' ? 'Por jugar' : 'En vivo'}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Extra Markets Row — shown below when moreShots or moreCorners exist */}
                {hasExtras && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 pt-2 border-t border-white/5">
                    {pred.moreShots && (
                      <div className="flex items-center gap-1.5">
                        <Crosshair size={11} className="text-violet-400/60 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-white/30">Remates:</span>
                        <span className="text-[9px] sm:text-[10px] font-semibold text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                          {getMarketLabel(pred.moreShots, m)}
                        </span>
                      </div>
                    )}
                    {pred.moreCorners && (
                      <div className="flex items-center gap-1.5">
                        <Flag size={11} className="text-amber-400/60 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-white/30">Córners:</span>
                        <span className="text-[9px] sm:text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {getMarketLabel(pred.moreCorners, m)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
