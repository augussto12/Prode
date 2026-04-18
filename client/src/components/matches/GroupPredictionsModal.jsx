import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Loader2, Users } from 'lucide-react';
import api from '../../services/api';

export default function GroupPredictionsModal({ isOpen, onClose, groupId, match }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && groupId && match) {
      loadPredictions();
    }
  }, [isOpen, groupId, match]);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/matches/${match.externalId || match.id}/predictions`);
      setData(res.data);
    } catch (err) {
      console.error("Error loading group predictions", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <m.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="glass-card rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-indigo-400" /> Predicciones del Grupo
              </h3>
              {match && (
                <div className="text-[10px] sm:text-xs text-white/50 mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="flex items-center gap-1 font-medium text-white/80">
                    {match.homeTeamLogo && <img src={match.homeTeamLogo} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" onError={(e) => e.target.src='/placeholder-team.svg'} />}
                    {match.homeTeam}
                  </span>
                  {(match.status === 'FINISHED' || match.status === 'LIVE' || typeof match.homeGoals === 'number') ? (
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold text-[11px] shadow-sm">
                      {match.homeGoals} - {match.awayGoals}
                    </span>
                  ) : (
                    <span className="text-white/30 text-[10px]">vs</span>
                  )}
                  <span className="flex items-center gap-1 font-medium text-white/80">
                    {match.awayTeamLogo && <img src={match.awayTeamLogo} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" onError={(e) => e.target.src='/placeholder-team.svg'} />}
                    {match.awayTeam}
                  </span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors cursor-pointer border-none bg-transparent">
              <X size={18} />
            </button>
          </div>

          {/* List */}
          <div className="p-2 sm:p-4 overflow-y-auto flex-1 space-y-2">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 size={24} className="animate-spin text-white/40" /></div>
            ) : data.length === 0 ? (
              <div className="text-center p-6 text-white/40 text-sm">Nadie apostó en este partido.</div>
            ) : (
              data.map((item, idx) => {
                const { user, prediction } = item;
                const pH = (prediction && prediction.homeGoals !== null) ? Number(prediction.homeGoals) : null;
                const pA = (prediction && prediction.awayGoals !== null) ? Number(prediction.awayGoals) : null;
                
                const mH = Number(match.homeGoals);
                const mA = Number(match.awayGoals);

                let badge = null;
                let badgeColor = "text-white/30";
                
                const getMarketLabel = (value) => {
                  if (value === 'HOME') return match.homeTeam.substring(0, 3).toUpperCase();
                  if (value === 'AWAY') return match.awayTeam.substring(0, 3).toUpperCase();
                  if (value === 'EQUAL') return '=';
                  return '?';
                };
                
                if (prediction) {
                  const isExact = pH === mH && pA === mA;
                  const predResult = pH > pA ? 'HOME' : pH < pA ? 'AWAY' : 'DRAW';
                  const actualResult = mH > mA ? 'HOME' : mH < mA ? 'AWAY' : 'DRAW';
                  const isWinnerCorrect = !isExact && predResult === actualResult;

                  if (isExact) { badge = "EXACTO"; badgeColor = "text-emerald-400"; }
                  else if (isWinnerCorrect) { badge = "GANADOR"; badgeColor = "text-blue-400"; }
                  else if (prediction.pointsEarned > 0) { badge = "BONUS"; badgeColor = "text-violet-400"; }
                  else { badge = "FALLÓ"; badgeColor = "text-red-400"; }
                } else {
                  badge = "SIN PRONÓSTICO";
                }

                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-white truncate">{user.displayName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] sm:text-[10px] font-bold ${badgeColor}`}>{badge}</span>
                          {prediction && prediction.pointsEarned > 0 && <span className="text-[9px] text-white/50">+{prediction.pointsEarned}pts</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 mt-1 sm:mt-0">
                      {prediction ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="px-2 py-1 bg-black/30 rounded-lg text-xs sm:text-sm font-bold text-white border border-white/10 text-center min-w-[50px] shadow-inner inline-block">
                            {pH} - {pA}
                          </div>
                          {/* list extras horizontally or vertically? Vertically maybe too much gap. Horizontally right aligned? */}
                          <div className="flex items-center gap-1 flex-wrap justify-end max-w-[130px]">
                            {prediction.moreShots && <span className="text-[9px] px-1 bg-violet-500/10 text-violet-300 rounded border border-violet-500/20" title="Más Remates">🔫 {getMarketLabel(prediction.moreShots)}</span>}
                            {prediction.moreCorners && <span className="text-[9px] px-1 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20" title="Más Córners">🚩 {getMarketLabel(prediction.moreCorners)}</span>}
                            {prediction.morePossession && <span className="text-[9px] px-1 bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20" title="Más Posesión">⚽ {getMarketLabel(prediction.morePossession)}</span>}
                            {prediction.moreFouls && <span className="text-[9px] px-1 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20" title="Más Faltas">🦵 {getMarketLabel(prediction.moreFouls)}</span>}
                            {prediction.moreCards && <span className="text-[9px] px-1 bg-yellow-500/10 text-yellow-300 rounded border border-yellow-500/20" title="Más Tarjetas">🟨 {getMarketLabel(prediction.moreCards)}</span>}
                            {prediction.moreOffsides && <span className="text-[9px] px-1 bg-fuchsia-500/10 text-fuchsia-300 rounded border border-fuchsia-500/20" title="Más Offsides">🏁 {getMarketLabel(prediction.moreOffsides)}</span>}
                            {prediction.moreSaves && <span className="text-[9px] px-1 bg-teal-500/10 text-teal-300 rounded border border-teal-500/20" title="Más Atajadas">🧤 {getMarketLabel(prediction.moreSaves)}</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-white/20 italic mt-2">-</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
}
