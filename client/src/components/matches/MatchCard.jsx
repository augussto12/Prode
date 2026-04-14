import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, Clock, Check, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';

export default function MatchCard({ match, isFavorite, onPredictionSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [prediction, setPrediction] = useState({
    homeGoals: '', awayGoals: '', winner: '', doubleChance: '',
    btts: null, overUnder25: '', moreShots: '', moreCorners: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingPrediction, setExistingPrediction] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const isSavingRef = useRef(false);

  const matchDate = new Date(match.matchDate);
  const isPast = matchDate <= new Date() || match.status !== 'SCHEDULED';
  const isLive = match.status === 'LIVE';
  const isFinished = match.status === 'FINISHED';

  useEffect(() => {
    loadMyPrediction();
  }, [match.id]);

  const loadMyPrediction = async () => {
    try {
      const { data } = await api.get('/predictions/my');
      const existing = data.find((p) => p.matchId === match.id);
      if (existing) {
        setExistingPrediction(existing);
        setPrediction({
          homeGoals: existing.homeGoals ?? '',
          awayGoals: existing.awayGoals ?? '',
          winner: existing.winner || '',
          doubleChance: existing.doubleChance || '',
          btts: existing.btts,
          overUnder25: existing.overUnder25 || '',
          moreShots: existing.moreShots || '',
          moreCorners: existing.moreCorners || '',
          isJoker: existing.isJoker || false,
        });
      }
    } catch (err) {}
  };

  const handleSave = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    setErrorMsg(null);
    try {
      // Clean up values for API
      const payload = {
        homeGoals: prediction.homeGoals !== '' ? Number(prediction.homeGoals) : null,
        awayGoals: prediction.awayGoals !== '' ? Number(prediction.awayGoals) : null,
        winner: prediction.winner || null,
        doubleChance: prediction.doubleChance || null,
        btts: prediction.btts,
        overUnder25: prediction.overUnder25 || null,
        moreShots: prediction.moreShots || null,
        moreCorners: prediction.moreCorners || null,
        isJoker: prediction.isJoker || false
      };
      
      await api.post(`/matches/${match.id}/predict`, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onPredictionSaved) onPredictionSaved();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Error al guardar. Tal vez ya usaste tu comodín x2 hoy.');
      if (err.response?.data?.error?.includes('comodín')) {
        setPrediction(prev => ({...prev, isJoker: false}));
      }
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const statusBadge = () => {
    if (isFinished) return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">Finalizado</span>;
    if (isLive) return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium animate-pulse">EN VIVO</span>;
    return <span className="px-2 py-0.5 bg-white/10 text-white/50 rounded-full text-xs">{matchDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>;
  };

  const WinnerButton = ({ value, label }) => (
    <button
      type="button"
      onClick={() => !isPast && setPrediction({ ...prediction, winner: value })}
      disabled={isPast}
      className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
        prediction.winner === value
          ? 'border-indigo-400/50 text-indigo-300'
          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
      style={prediction.winner === value ? { background: 'rgba(99,102,241,0.15)' } : {}}
    >
      {label}
    </button>
  );

  const ToggleButton = ({ field, value, label }) => (
    <button
      type="button"
      onClick={() => !isPast && setPrediction({ ...prediction, [field]: value })}
      disabled={isPast}
      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
        prediction[field] === value
          ? 'border-violet-400/50 text-violet-300'
          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
      style={prediction[field] === value ? { background: 'rgba(139,92,246,0.15)' } : {}}
    >
      {label}
    </button>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-2xl overflow-hidden transition-all ${isFavorite ? 'ring-1 ring-amber-400/30' : ''}`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/40 font-medium">{match.stage}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrediction({...prediction, isJoker: !prediction.isJoker})}
              disabled={isPast}
              className={`flex items-center justify-center px-1.5 py-0.5 rounded cursor-pointer transition-all border ${
                prediction.isJoker 
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Comodín x2 (Uno por día)"
            >
              x2
            </button>
            {isFavorite && <Star size={14} className="text-amber-400 fill-amber-400" />}
            {statusBadge()}
          </div>
        </div>

        {/* Teams & Score */}
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-2xl mb-1">{match.homeFlag || '🏳️'}</div>
            <div className="text-sm font-semibold text-white truncate">{match.homeTeam}</div>
          </div>

          <div className="px-4 text-center">
            {isFinished || isLive ? (
              <div className="text-2xl font-bold text-white">
                {match.homeGoals} <span className="text-white/30">-</span> {match.awayGoals}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="20"
                  value={prediction.homeGoals}
                  onChange={(e) => setPrediction({ ...prediction, homeGoals: e.target.value })}
                  disabled={isPast}
                  placeholder="-"
                  className="w-10 h-10 text-center bg-white/10 border border-white/20 rounded-lg text-white font-bold text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-white/30 font-bold">-</span>
                <input
                  type="number" min="0" max="20"
                  value={prediction.awayGoals}
                  onChange={(e) => setPrediction({ ...prediction, awayGoals: e.target.value })}
                  disabled={isPast}
                  placeholder="-"
                  className="w-10 h-10 text-center bg-white/10 border border-white/20 rounded-lg text-white font-bold text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="text-2xl mb-1">{match.awayFlag || '🏳️'}</div>
            <div className="text-sm font-semibold text-white truncate">{match.awayTeam}</div>
          </div>
        </div>

        {/* Existing prediction indicator */}
        {existingPrediction && (
          <div className="mt-2 text-center">
            <span className="inline-flex items-center gap-1 text-xs text-green-400/70">
              <Check size={12} /> Predicción guardada ({existingPrediction.homeGoals ?? '?'}-{existingPrediction.awayGoals ?? '?'})
              {existingPrediction.pointsEarned > 0 && (
                <span className="ml-1 text-amber-400">+{existingPrediction.pointsEarned} pts</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Expand Toggle */}
      {!isPast && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-white/40 hover:text-white/60 bg-white/[0.02] border-t border-white/5 cursor-pointer border-x-0 border-b-0 bg-transparent transition-all"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Menos mercados' : 'Más mercados'}
        </button>
      )}

      {/* Expanded Markets */}
      {expanded && !isPast && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3"
        >
          {/* Winner */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Ganador / Empate</label>
            <div className="flex gap-2">
              <WinnerButton value="HOME" label={match.homeTeam} />
              <WinnerButton value="DRAW" label="Empate" />
              <WinnerButton value="AWAY" label={match.awayTeam} />
            </div>
          </div>

          {/* Double Chance */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Doble Oportunidad</label>
            <div className="flex gap-2">
              <ToggleButton field="doubleChance" value="1X" label="1X" />
              <ToggleButton field="doubleChance" value="12" label="12" />
              <ToggleButton field="doubleChance" value="2X" label="2X" />
            </div>
          </div>

          {/* BTTS */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Ambos Anotan (BTTS)</label>
            <div className="flex gap-2">
              <ToggleButton field="btts" value={true} label="Sí" />
              <ToggleButton field="btts" value={false} label="No" />
            </div>
          </div>

          {/* Over/Under */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Más/Menos 2.5 Goles</label>
            <div className="flex gap-2">
              <ToggleButton field="overUnder25" value="OVER" label="Más (+2.5)" />
              <ToggleButton field="overUnder25" value="UNDER" label="Menos (-2.5)" />
            </div>
          </div>

          {/* More Shots */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Más Remates</label>
            <div className="flex gap-2">
              <ToggleButton field="moreShots" value="HOME" label={match.homeTeam} />
              <ToggleButton field="moreShots" value="EQUAL" label="Igual" />
              <ToggleButton field="moreShots" value="AWAY" label={match.awayTeam} />
            </div>
          </div>

          {/* More Corners */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Más Córners</label>
            <div className="flex gap-2">
              <ToggleButton field="moreCorners" value="HOME" label={match.homeTeam} />
              <ToggleButton field="moreCorners" value="EQUAL" label="Igual" />
              <ToggleButton field="moreCorners" value="AWAY" label={match.awayTeam} />
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer border-none shadow-lg"
            style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Predicción'}
          </button>
        </motion.div>
      )}

      {/* Quick save for score-only */}
      {!expanded && !isPast && (prediction.homeGoals !== '' || prediction.awayGoals !== '') && (
        <div className="px-4 pb-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 rounded-xl text-white font-medium text-xs transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer border-none"
            style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar resultado'}
          </button>
        </div>
      )}
    </motion.div>
  );
}
