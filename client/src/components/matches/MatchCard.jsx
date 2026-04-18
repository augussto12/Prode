import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { Star, Clock, Check, ChevronDown, ChevronUp, Lock, Crosshair, Flag } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useToastStore from '../../store/toastStore';

const MARKET_LABELS = { HOME: 'Local', AWAY: 'Visitante', EQUAL: 'Igual' };

export default memo(function MatchCard({ match, isFavorite, existingPrediction: existingProp, onPredictionSaved, hideStage = false }) {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const addToast = useToastStore(state => state.addToast);
  const [expanded, setExpanded] = useState(false);
  const [prediction, setPrediction] = useState({
    homeGoals: '', awayGoals: '', winner: '', doubleChance: '',
    btts: null, overUnder25: '', moreShots: '', moreCorners: '',
    morePossession: '', moreFouls: '', moreCards: '', moreOffsides: '', moreSaves: '',
    isJoker: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingPrediction, setExistingPrediction] = useState(existingProp || null);
  const [errorMsg, setErrorMsg] = useState(null);
  const isSavingRef = useRef(false);

  const matchDate = new Date(match.matchDate);
  const isPast = matchDate <= new Date() || match.status !== 'SCHEDULED';
  const isLive = match.status === 'LIVE';
  const isFinished = match.status === 'FINISHED';

  // Initialize from prop when it changes
  useEffect(() => {
    if (existingProp) {
      setExistingPrediction(existingProp);
      setPrediction({
        homeGoals: existingProp.homeGoals ?? '',
        awayGoals: existingProp.awayGoals ?? '',
        winner: existingProp.winner || '',
        doubleChance: existingProp.doubleChance || '',
        btts: existingProp.btts,
        overUnder25: existingProp.overUnder25 || '',
        moreShots: existingProp.moreShots || '',
        moreCorners: existingProp.moreCorners || '',
        morePossession: existingProp.morePossession || '',
        moreFouls: existingProp.moreFouls || '',
        moreCards: existingProp.moreCards || '',
        moreOffsides: existingProp.moreOffsides || '',
        moreSaves: existingProp.moreSaves || '',
        isJoker: existingProp.isJoker || false,
      });
    }
  }, [existingProp]);

  // Detect if the user has changed anything from the saved/initial state
  const hasChanges = useMemo(() => {
    // If no existing prediction, any data entered counts as a change
    if (!existingProp) {
      return prediction.homeGoals !== '' || prediction.awayGoals !== '' || 
             prediction.moreShots !== '' || prediction.moreCorners !== '' ||
             prediction.morePossession !== '' || prediction.moreFouls !== '' ||
             prediction.moreCards !== '' || prediction.moreOffsides !== '' ||
             prediction.moreSaves !== '' ||
             prediction.isJoker;
    }
    // If there's an existing prediction, compare each field
    const ep = existingProp;
    return (
      String(prediction.homeGoals) !== String(ep.homeGoals ?? '') ||
      String(prediction.awayGoals) !== String(ep.awayGoals ?? '') ||
      (prediction.moreShots || '') !== (ep.moreShots || '') ||
      (prediction.moreCorners || '') !== (ep.moreCorners || '') ||
      (prediction.morePossession || '') !== (ep.morePossession || '') ||
      (prediction.moreFouls || '') !== (ep.moreFouls || '') ||
      (prediction.moreCards || '') !== (ep.moreCards || '') ||
      (prediction.moreOffsides || '') !== (ep.moreOffsides || '') ||
      (prediction.moreSaves || '') !== (ep.moreSaves || '') ||
      (prediction.isJoker || false) !== (ep.isJoker || false)
    );
  }, [prediction, existingProp]);

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
        moreShots: prediction.moreShots || null,
        moreCorners: prediction.moreCorners || null,
        morePossession: prediction.morePossession || null,
        moreFouls: prediction.moreFouls || null,
        moreCards: prediction.moreCards || null,
        moreOffsides: prediction.moreOffsides || null,
        moreSaves: prediction.moreSaves || null,
        isJoker: prediction.isJoker || false
      };
      
      await api.post('/predictions', { 
        externalFixtureId: match.externalId, 
        competitionId: match.competitionId,
        ...payload 
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onPredictionSaved) onPredictionSaved();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al guardar. Tal vez ya usaste tu comodín x2 hoy.';
      addToast({ type: 'error', message: msg });
      if (msg.toLowerCase().includes('comodín')) {
        setPrediction(prev => ({...prev, isJoker: false}));
      }
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const statusBadge = () => {
    if (isFinished) return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">Finalizado</span>;
    if (isLive) {
      const ss = match.statusShort;
      let liveLabel = 'EN VIVO';
      if (ss === 'HT') liveLabel = 'Entretiempo';
      else if (ss === 'ET') liveLabel = 'Tiempo Extra';
      else if (ss === 'P' || ss === 'PEN') liveLabel = 'Penales';
      else if (ss === 'BT') liveLabel = 'Descanso TE';
      else if (match.elapsed) liveLabel = `${match.elapsed}'`;

      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          {liveLabel}
        </span>
      );
    }
    return <span className="px-2 py-0.5 bg-white/10 text-white/50 rounded-full text-xs">{matchDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>;
  };

  // Helper to show market label with team name
  const getMarketLabel = (value) => {
    if (value === 'HOME') return match.homeTeam;
    if (value === 'AWAY') return match.awayTeam;
    if (value === 'EQUAL') return 'Igual';
    return '—';
  };

  // Whether the card has existing extra market predictions to show on past matches
  const hasExtraMarkets = existingPrediction && (existingPrediction.moreShots || existingPrediction.moreCorners || existingPrediction.morePossession || existingPrediction.moreFouls || existingPrediction.moreCards || existingPrediction.moreOffsides || existingPrediction.moreSaves);

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-xl sm:rounded-2xl overflow-hidden transition-all ${isFavorite ? 'ring-1 ring-amber-400/30' : ''}`}
    >
      {/* Header */}
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {!hideStage && match.stage && <span className="text-[10px] sm:text-xs text-white/40 font-medium truncate">{match.stage}</span>}
            {match.round && /2nd\s*Leg/i.test(match.round) && (
              <span className="px-1 sm:px-1.5 py-0.5 bg-indigo-500/15 text-indigo-400 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider border border-indigo-500/20 shrink-0">Vuelta</span>
            )}
            {match.round && /1st\s*Leg/i.test(match.round) && (
              <span className="px-1 sm:px-1.5 py-0.5 bg-white/5 text-white/40 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider border border-white/10 shrink-0">Ida</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user && (
              <button
                onClick={() => !isPast && setPrediction({...prediction, isJoker: !prediction.isJoker})}
                disabled={isPast}
                className={`flex items-center justify-center px-1.5 py-0.5 rounded cursor-pointer transition-all border text-xs ${
                  prediction.isJoker 
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                  : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title="Comodín x2 (Uno por día)"
              >
                x2
              </button>
            )}
            {isFavorite && <Star size={12} className="text-amber-400 fill-amber-400" />}
            {statusBadge()}
          </div>
        </div>

        {/* Teams & Score */}
        <div className="flex items-center justify-between">
          <div 
            className={`flex-1 text-center min-w-0 ${match.homeTeamId ? 'cursor-pointer group' : ''}`} 
            onClick={() => match.homeTeamId && navigate(`/equipo/${match.homeTeamId}`)}
          >
            {match.homeTeamLogo
              ? <img src={match.homeTeamLogo} alt={match.homeTeam} className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain ${match.homeTeamId ? 'group-hover:scale-110 transition-transform' : ''}`} loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
              : <div className="text-xl sm:text-2xl mb-1">{match.homeFlag || '🏳️'}</div>
            }
            <div className={`text-[11px] sm:text-sm font-semibold text-white truncate px-0.5 ${match.homeTeamId ? 'group-hover:text-indigo-300 transition-colors' : ''}`}>{match.homeTeam}</div>
          </div>

          <div className="px-2 sm:px-4 text-center">
            {isFinished || isLive ? (
              <div className="text-lg sm:text-2xl font-bold text-white">
                {match.homeGoals} <span className="text-white/30">-</span> {match.awayGoals}
              </div>
            ) : !user ? (
              <button 
                onClick={() => {
                  addToast({ type: 'warning', message: 'Iniciá sesión para hacer predicciones' });
                  navigate('/login');
                }}
                className="flex flex-col items-center justify-center mx-auto text-white/50 hover:text-white/90 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all border border-white/10 cursor-pointer shadow-none"
              >
                <Lock size={14} className="mb-1" />
                <span className="text-[10px] uppercase font-bold leading-none">Predecir</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <input
                  type="number" min="0" max="20"
                  value={prediction.homeGoals}
                  onChange={(e) => setPrediction({ ...prediction, homeGoals: e.target.value })}
                  disabled={isPast}
                  placeholder="-"
                  className="w-9 h-9 sm:w-10 sm:h-10 text-center bg-white/10 border border-white/20 rounded-lg text-white font-bold text-base sm:text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-white/30 font-bold">-</span>
                <input
                  type="number" min="0" max="20"
                  value={prediction.awayGoals}
                  onChange={(e) => setPrediction({ ...prediction, awayGoals: e.target.value })}
                  disabled={isPast}
                  placeholder="-"
                  className="w-9 h-9 sm:w-10 sm:h-10 text-center bg-white/10 border border-white/20 rounded-lg text-white font-bold text-base sm:text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}
          </div>

          <div 
            className={`flex-1 text-center min-w-0 ${match.awayTeamId ? 'cursor-pointer group' : ''}`} 
            onClick={() => match.awayTeamId && navigate(`/equipo/${match.awayTeamId}`)}
          >
            {match.awayTeamLogo
              ? <img src={match.awayTeamLogo} alt={match.awayTeam} className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain ${match.awayTeamId ? 'group-hover:scale-110 transition-transform' : ''}`} loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
              : <div className="text-xl sm:text-2xl mb-1">{match.awayFlag || '🏳️'}</div>
            }
            <div className={`text-[11px] sm:text-sm font-semibold text-white truncate px-0.5 ${match.awayTeamId ? 'group-hover:text-indigo-300 transition-colors' : ''}`}>{match.awayTeam}</div>
          </div>
        </div>

        {/* Existing prediction indicator */}
        {existingPrediction && (
          <div className="mt-1.5 sm:mt-2 text-center">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-green-400/70">
              <Check size={10} /> Guardado ({existingPrediction.homeGoals ?? '?'}-{existingPrediction.awayGoals ?? '?'})
              {existingPrediction.pointsEarned > 0 && (
                <span className="ml-1 text-amber-400">+{existingPrediction.pointsEarned} pts</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Expand Toggle — show for both past (read-only) and future (editable) if user exists */}
      {user && (isPast ? hasExtraMarkets : true) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-white/40 hover:text-white/60 bg-white/[0.02] border-t border-white/5 cursor-pointer border-x-0 border-b-0 bg-transparent transition-all"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isPast 
            ? (expanded ? 'Ocultar Mercados' : 'Ver Mercados Extra') 
            : (expanded ? 'Ocultar Extras' : 'Pronósticos Extra')
          }
        </button>
      )}

      {/* Expanded Markets — EDITABLE (future matches) */}
      {expanded && !isPast && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2.5 sm:space-y-3 border-t border-white/5 pt-2.5 sm:pt-3"
        >
          {/* More Shots */}
          <div>
            <label className="text-[10px] sm:text-xs text-white/40 mb-1 sm:mb-1.5 block">Más Remates al Arco</label>
            <div className="flex gap-1.5 sm:gap-2">
              <ToggleButton field="moreShots" value="HOME" label={match.homeTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              <ToggleButton field="moreShots" value="EQUAL" label="Igual" prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              <ToggleButton field="moreShots" value="AWAY" label={match.awayTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
            </div>
          </div>

          {/* More Corners */}
          <div>
            <label className="text-[10px] sm:text-xs text-white/40 mb-1 sm:mb-1.5 block">Más Córners</label>
            <div className="flex gap-1.5 sm:gap-2">
              <ToggleButton field="moreCorners" value="HOME" label={match.homeTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              <ToggleButton field="moreCorners" value="EQUAL" label="Igual" prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              <ToggleButton field="moreCorners" value="AWAY" label={match.awayTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Possession */}
            <div>
              <label className="text-[10px] sm:text-xs text-white/40 mb-1 sm:mb-1.5 block">Más Posesión</label>
              <div className="flex gap-1.5 sm:gap-2">
                <ToggleButton field="morePossession" value="HOME" label={match.homeTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="morePossession" value="EQUAL" label="=" prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="morePossession" value="AWAY" label={match.awayTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              </div>
            </div>

            {/* Fouls */}
            <div>
              <label className="text-[10px] sm:text-xs text-white/40 mb-1 sm:mb-1.5 block">Más Faltas</label>
              <div className="flex gap-1.5 sm:gap-2">
                <ToggleButton field="moreFouls" value="HOME" label={match.homeTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreFouls" value="EQUAL" label="=" prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreFouls" value="AWAY" label={match.awayTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              </div>
            </div>

            {/* Cards */}
            <div>
              <label className="text-[10px] sm:text-xs text-white/40 mb-1 sm:mb-1.5 block">Más Tarjetas (Am+R)</label>
              <div className="flex gap-1.5 sm:gap-2">
                <ToggleButton field="moreCards" value="HOME" label={match.homeTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreCards" value="EQUAL" label="=" prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreCards" value="AWAY" label={match.awayTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              </div>
            </div>

            {/* Offsides */}
            <div>
              <label className="text-[10px] sm:text-xs text-white/40 mb-1 sm:mb-1.5 block">Más Offsides</label>
              <div className="flex gap-1.5 sm:gap-2">
                <ToggleButton field="moreOffsides" value="HOME" label={match.homeTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreOffsides" value="EQUAL" label="=" prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreOffsides" value="AWAY" label={match.awayTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              </div>
            </div>

            {/* Saves */}
            <div>
              <label className="text-[10px] sm:text-xs text-white/40 mb-1 sm:mb-1.5 block">Más Atajadas</label>
              <div className="flex gap-1.5 sm:gap-2">
                <ToggleButton field="moreSaves" value="HOME" label={match.homeTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreSaves" value="EQUAL" label="=" prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
                <ToggleButton field="moreSaves" value="AWAY" label={match.awayTeam} prediction={prediction} setPrediction={setPrediction} isPast={isPast} />
              </div>
            </div>
          </div>

          {/* Save button — only show when there are changes */}
          {hasChanges && (
            <m.button
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 sm:py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer border-none shadow-lg"
              style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
            >
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Predicción'}
            </m.button>
          )}
        </m.div>
      )}

      {/* Expanded Markets — READ-ONLY (past/live matches with existing predictions) */}
      {expanded && isPast && hasExtraMarkets && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 border-t border-white/5 pt-2.5 sm:pt-3"
        >
          {existingPrediction.moreShots && (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Crosshair size={13} className="text-violet-400/60" />
                <span className="text-[10px] sm:text-xs text-white/40">Más Remates al Arco</span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                {getMarketLabel(existingPrediction.moreShots)}
              </span>
            </div>
          )}
          {existingPrediction.moreCorners && (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Flag size={13} className="text-amber-400/60" />
                <span className="text-[10px] sm:text-xs text-white/40">Más Córners</span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {getMarketLabel(existingPrediction.moreCorners)}
              </span>
            </div>
          )}
          {existingPrediction.morePossession && (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-emerald-400/60 text-[13px]">⚽</span>
                <span className="text-[10px] sm:text-xs text-white/40">Más Posesión</span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {getMarketLabel(existingPrediction.morePossession)}
              </span>
            </div>
          )}
          {existingPrediction.moreFouls && (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-blue-400/60 text-[13px]">🦵</span>
                <span className="text-[10px] sm:text-xs text-white/40">Más Faltas</span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {getMarketLabel(existingPrediction.moreFouls)}
              </span>
            </div>
          )}
          {existingPrediction.moreCards && (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-yellow-400/60 text-[13px]">🟨</span>
                <span className="text-[10px] sm:text-xs text-white/40">Más Tarjetas</span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                {getMarketLabel(existingPrediction.moreCards)}
              </span>
            </div>
          )}
          {existingPrediction.moreOffsides && (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-violet-400/60 text-[13px]">🏁</span>
                <span className="text-[10px] sm:text-xs text-white/40">Más Offsides</span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                {getMarketLabel(existingPrediction.moreOffsides)}
              </span>
            </div>
          )}
          {existingPrediction.moreSaves && (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-emerald-400/60 text-[13px]">🧤</span>
                <span className="text-[10px] sm:text-xs text-white/40">Más Atajadas</span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {getMarketLabel(existingPrediction.moreSaves)}
              </span>
            </div>
          )}
        </m.div>
      )}

      {/* Quick save for score-only — only when NOT expanded and there are changes */}
      {!expanded && !isPast && hasChanges && (
        <div className="px-3 sm:px-4 pb-2.5 sm:pb-3">
          <m.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleSave}
            disabled={saving}
            className="w-full py-1.5 sm:py-2 rounded-xl text-white font-medium text-[11px] sm:text-xs transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer border-none"
            style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar resultado'}
          </m.button>
        </div>
      )}
    </m.div>
  );
});

// Extraído fuera de MatchCard para evitar re-mount en cada render del padre
function ToggleButton({ field, value, label, prediction, setPrediction, isPast }) {
  return (
    <button
      type="button"
      onClick={() => !isPast && setPrediction(prev => ({ ...prev, [field]: value }))}
      disabled={isPast}
      className={`flex-1 py-1.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border cursor-pointer truncate min-w-0 ${
        prediction[field] === value
          ? 'border-violet-400/50 text-violet-300'
          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
      style={prediction[field] === value ? { background: 'rgba(139,92,246,0.15)' } : {}}
    >
      {label}
    </button>
  );
}
