import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

export default function PredictionHistory({ predictions, matches }) {
  const [predFilter, setPredFilter] = useState('all');

  const predsWithMatch = predictions.map(p => {
    const match = matches.find(m => m.id === p.matchId);
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

  return (
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
            const isCorrect = pred.pointsEarned > 0;
            const isExact = pred.pointsEarned >= 5;
            
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
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Tu Pronóstico</div>
                    <div className="inline-block px-3 py-1.5 bg-white/5 rounded-lg text-sm font-bold text-white border border-white/10">
                      {pred.homeGoals} - {pred.awayGoals}
                      {pred.isJoker && <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]">x2</span>}
                    </div>
                  </div>

                  {/* Result */}
                  <div className="text-center shrink-0 w-20">
                    {isFinished ? (
                      <>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Resultado</div>
                        <div className="text-sm font-bold text-white mb-1.5">{m.homeGoals} - {m.awayGoals}</div>
                        <div className={`text-[10px] font-bold ${isExact ? 'text-emerald-400' : isCorrect ? 'text-blue-400' : 'text-red-400'}`}>
                          {isExact ? 'EXACTO' : isCorrect ? 'ACIERTO' : 'FALLÓ'}
                          <span className="ml-1 opacity-70">+{pred.pointsEarned}pts</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-white/30 mt-3 italic">{m.status === 'SCHEDULED' ? 'Por jugar' : 'En vivo'}</div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
