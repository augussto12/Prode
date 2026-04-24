import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import useToastStore from '../store/toastStore';
import PitchView from '../components/fantasy/PitchView';
import '../components/fantasy/FantasyTeam.css';
import { Save, Search, UserPlus, Trash2, Calendar, X, ArrowLeft, Loader2, Pencil, Check, Crown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { translatePosition, translateFilterLabel } from '../utils/positionTranslations';

function FantasyTeam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [team, setTeam] = useState(null);
  const [league, setLeague] = useState(null);
  const [activeGw, setActiveGw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");

  // Team name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!activeGw || !activeGw.startDate) return;
    if (!activeGw.transfersOpen) {
      setCountdown("Cerrado");
      return;
    }

    const calculateCountdown = () => {
      const now = new Date();
      const start = new Date(activeGw.startDate);
      const diff = start - now;
      if (diff <= 0) return "Cerrando...";

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
    };

    setCountdown(calculateCountdown());
    const interval = setInterval(() => setCountdown(calculateCountdown()), 60000);
    return () => clearInterval(interval);
  }, [activeGw]);

  // Draft State
  const [draftPicks, setDraftPicks] = useState([]);
  const [budgetRemaining, setBudgetRemaining] = useState(100.0);
  const [isSaving, setIsSaving] = useState(false);

  // Market State
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [positionFilter, setPositionFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextFixtures, setNextFixtures] = useState([]);

  // Drawer State
  const [showFixturesDrawer, setShowFixturesDrawer] = useState(false);
  const [showMarketDrawer, setShowMarketDrawer] = useState(false);

  // Captain selection
  const [selectingCaptain, setSelectingCaptain] = useState(false);

  // GW Points Filter — arrow navigator
  const [playableGws, setPlayableGws] = useState([]); // GWs that are finished or active
  const [gwIndex, setGwIndex] = useState(-1); // current index in playableGws
  const [gwPointsMap, setGwPointsMap] = useState({}); // { playerId: points }
  const [gwTotalPts, setGwTotalPts] = useState(null);
  const [loadingGwPts, setLoadingGwPts] = useState(false);

  useEffect(() => {
    if (showFixturesDrawer || showMarketDrawer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showFixturesDrawer, showMarketDrawer]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [resTeam, resDetails, resGw, resFix] = await Promise.all([
        api.get(`/fantasy/my-team/${id}`),
        api.get(`/fantasy/leagues/${id}/details`),
        api.get(`/fantasy/leagues/${id}/gameweeks/active`).catch(() => ({ data: null })),
        api.get(`/fantasy/leagues/${id}/next-fixtures`).catch(() => ({ data: [] }))
      ]);

      setTeam(resTeam.data);
      setLeague(resDetails.data);
      setActiveGw(resGw.data);
      setNextFixtures(resFix.data);

      const initialPicks = resTeam.data?.picks || [];
      setDraftPicks(initialPicks);

      const spent = initialPicks.reduce((acc, p) => acc + (p.purchasePrice || 0), 0);
      setBudgetRemaining(100.0 - spent);

      api.get(`/fantasy/teams?leagueId=${resDetails.data.leagueId}`).then(r => setLeagueTeams(r.data)).catch(console.error);
      fetchPlayers(resDetails.data.leagueId, '', '');
    } catch (err) {
      console.error(err);
      useToastStore.getState().addToast({ type: 'error', message: 'Hubo un error cargando tus datos. ¿Estás en esta liga?' });
    } finally {
      setLoading(false);
    }
  };

  const [hasFetchedLive, setHasFetchedLive] = useState(false);
  const [viewMode, setViewMode] = useState('current'); // 'current' | 'history'
  const [historicalPicks, setHistoricalPicks] = useState([]);

  // INITIAL LOAD
  useEffect(() => {
    if (!id) return;
    const loadAll = async () => {
      await fetchTeamData();
    };
    loadAll();
    // eslint-disable-next-line
  }, [id]);

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const [resTeam, resDetails, resGw] = await Promise.all([
        api.get(`/fantasy/my-team/${id}`),
        api.get(`/fantasy/leagues/${id}/details`),
        api.get(`/fantasy/leagues/${id}/gameweeks/active`)
      ]);

      const lgId = resDetails.data.leagueId;
      const resFix = await api.get(`/fantasy/leagues/${id}/next-fixtures`);

      setTeam(resTeam.data);
      setLeague(resDetails.data);

      // La lógica del servidor pudo haber calculado mal "el activo" si se pisan fechas,
      // pero el backend ya debería traer el más apto.
      const active = resGw.data;
      setActiveGw(active);
      setNextFixtures(resFix.data);

      const initialPicks = resTeam.data?.picks || [];
      setDraftPicks(initialPicks);

      const spent = initialPicks.reduce((acc, p) => acc + (p.purchasePrice || 0), 0);
      setBudgetRemaining(100.0 - spent);

      api.get(`/fantasy/teams?leagueId=${lgId}`).then(r => setLeagueTeams(r.data)).catch(console.error);
      fetchPlayers(lgId, '', '');

      // Load Gameweeks Navigator
      const resGwsList = await api.get(`/fantasy/leagues/${id}/gameweeks`);
      const playable = resGwsList.data || [];
      setPlayableGws(playable);
      // Por defecto entramos en modo 'current'
      setViewMode('current');

      // Si la fecha principal está en progreso, intentamos cargar puntajes live
      if (active && active.status === 'IN_PROGRESS' && !hasFetchedLive) {
        setHasFetchedLive(true);
        // Usamos el fetch auxiliar para no pisar states si navega rápido
        api.get(`/fantasy/my-team/${id}/gameweeks/${active.id}/points`).then(r => {
          const pointsMap = {};
          let total = 0;
          (r.data || []).forEach(p => {
            pointsMap[p.playerId] = p.points;
            if (!p.isBenched && p.points != null) {
              total += p.points * (p.isCaptain ? 2 : 1);
            }
          });
          setGwPointsMap(pointsMap);
          setGwTotalPts(total);
        }).catch(console.error);
      }

    } catch (err) {
      console.error(err);
      useToastStore.getState().addToast({ type: 'error', message: 'Hubo un error cargando tus datos. ¿Estás en esta liga?' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async (realLeagueId, posObj, teamObj, searchObj) => {
    setLoadingPlayers(true);
    try {
      const query = new URLSearchParams({ leagueId: realLeagueId });
      if (posObj) query.append('position', posObj);
      if (teamObj) query.append('teamId', teamObj);
      if (searchObj) query.append('search', searchObj);
      const { data } = await api.get(`/fantasy/players?${query.toString()}`);
      setPlayers(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handlePositionClick = (pos) => {
    setPositionFilter(pos);
    fetchPlayers(league?.leagueId, pos, teamFilter, searchQuery);
  };

  const handleTeamChange = (e) => {
    const tId = e.target.value;
    setTeamFilter(tId);
    fetchPlayers(league?.leagueId, positionFilter, tId, searchQuery);
  };

  useEffect(() => {
    if (!league) return;
    const delay = setTimeout(() => {
      fetchPlayers(league.leagueId, positionFilter, teamFilter, searchQuery);
    }, 400);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const [selectedFormation, setSelectedFormation] = useState('4-4-2');

  const handlePitchPlayerClick = (p) => {
    if (p.isDummy) {
      const pos = p.playerPosition;
      setPositionFilter(pos);
      // Fetch players for this position immediately
      if (league?.leagueId) {
        fetchPlayers(league.leagueId, pos, teamFilter, searchQuery);
      }
      if (window.innerWidth < 1024) {
        setShowMarketDrawer(true);
      }
      return;
    }

    if (!activeGw?.transfersOpen && draftPicks.length > 0 && team?.picks?.length > 0) {
      useToastStore.getState().addToast({ type: 'error', message: 'Mercado cerrado.' });
      return;
    }

    setDraftPicks(draftPicks.filter(draft => draft.playerId !== p.playerId));
    setBudgetRemaining(prev => prev + p.purchasePrice);
  };

  const handleSignPlayer = (p) => {
    if (draftPicks.find(draft => draft.playerId === p.sportmonksId)) {
      useToastStore.getState().addToast({ type: 'warning', message: 'Ya está en tu equipo.' });
      return;
    }

    // Max 3 from same real team
    const sameTeamCount = draftPicks.filter(d => d.playerTeamId === p.teamId).length;
    if (sameTeamCount >= 3) {
      useToastStore.getState().addToast({ type: 'error', message: `Máximo 3 jugadores del mismo equipo.` });
      return;
    }

    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0, ATT: 0 };
    draftPicks.forEach(draft => {
      counts[draft.playerPosition === 'ATT' ? 'FWD' : draft.playerPosition]++;
    });

    const mappedPos = p.position === 'ATT' ? 'FWD' : p.position;

    const [def, mid, fwd] = selectedFormation.split('-').map(Number);
    const maxLimits = { GK: 1, DEF: def, MID: mid, FWD: fwd };

    if (counts[mappedPos] >= maxLimits[mappedPos]) {
      useToastStore.getState().addToast({ type: 'error', message: `Límite alcanzado para ${mappedPos} en ${selectedFormation}.` });
      return;
    }

    if (draftPicks.length >= 11) {
      useToastStore.getState().addToast({ type: 'error', message: 'Equipo titular completo.' });
      return;
    }

    setDraftPicks([...draftPicks, {
      playerId: p.sportmonksId,
      playerName: p.name,
      fullName: p.name,
      playerPosition: mappedPos,
      playerTeamId: p.teamId,
      purchasePrice: p.price,
      photoUrl: p.photoUrl || null,
      isBenched: false
    }]);
    setBudgetRemaining(prev => prev - p.price);
  };

  const handleCaptainSelect = async (playerId) => {
    // Update local state immediately
    setDraftPicks(prev => prev.map(p => ({
      ...p,
      isCaptain: p.playerId === playerId
    })));
    setSelectingCaptain(false);

    // Save to backend
    try {
      await api.put(`/fantasy/my-team/${id}/captain`, { captainId: playerId });
      useToastStore.getState().addToast({ type: 'success', message: '¡Capitán asignado! ✓' });
    } catch (err) {
      useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al asignar capitán.' });
    }
  };

  const fetchGwPoints = async (gwId) => {
    setLoadingGwPts(true);
    try {
      const { data } = await api.get(`/fantasy/my-team/${id}/gameweeks/${gwId}/points`);
      const picks = data || [];
      setHistoricalPicks(picks);

      const total = picks.filter(p => !p.isBenched).reduce((sum, p) => {
        let pts = p.points || 0;
        if (p.isCaptain) pts *= 2;
        return sum + pts;
      }, 0);
      setGwTotalPts(total);
    } catch {
      setHistoricalPicks([]);
      setGwTotalPts(null);
    } finally {
      setLoadingGwPts(false);
    }
  };

  const handleGwPrev = () => {
    if (viewMode === 'current') {
      if (playableGws.length === 0) return;
      setViewMode('history');
      const lastIdx = playableGws.length - 1;
      setGwIndex(lastIdx);
      fetchGwPoints(playableGws[lastIdx].id);
    } else {
      if (gwIndex <= 0) return;
      const newIdx = gwIndex - 1;
      setGwIndex(newIdx);
      fetchGwPoints(playableGws[newIdx].id);
    }
  };

  const handleGwNext = () => {
    if (viewMode === 'current') return;
    if (gwIndex >= playableGws.length - 1) {
      setViewMode('current');
      setHistoricalPicks([]);
      // Restauramos totalPts al parcial live si existe
      if (activeGw?.status === 'IN_PROGRESS') {
        let total = 0;
        draftPicks.forEach(p => {
          const pts = gwPointsMap[p.playerId];
          if (!p.isBenched && pts != null) {
            total += pts * (p.isCaptain ? 2 : 1);
          }
        });
        setGwTotalPts(total);
      } else {
        setGwTotalPts(null);
      }
      return;
    }
    const newIdx = gwIndex + 1;
    setGwIndex(newIdx);
    fetchGwPoints(playableGws[newIdx].id);
  };

  const currentGw = viewMode === 'history' ? playableGws[gwIndex] : activeGw;

  // Build display picks
  const displayPicks = viewMode === 'history'
    ? historicalPicks
    : draftPicks.map(p => ({
      ...p,
      points: (activeGw?.status === 'IN_PROGRESS') ? gwPointsMap[p.playerId] : null
    }));

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await api.post(`/fantasy/my-team/${id}`, {
        picks: draftPicks.map(p => ({
          playerId: p.playerId,
          isCaptain: p.isCaptain || false,
          isBenched: false
        }))
      });
      useToastStore.getState().addToast({ type: 'success', message: 'Alineación oficializada ✓' });
      fetchData();
    } catch (err) {
      useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al guardar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRename = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      useToastStore.getState().addToast({ type: 'error', message: 'Mínimo 2 caracteres.' });
      return;
    }
    setSavingName(true);
    try {
      const res = await api.put(`/fantasy/my-team/${id}/name`, { name: editName.trim() });
      setTeam(prev => ({ ...prev, name: res.data.name }));
      setIsEditingName(false);
      useToastStore.getState().addToast({ type: 'success', message: 'Nombre actualizado ✓' });
    } catch (err) {
      useToastStore.getState().addToast({ type: 'error', message: err.response?.data?.error || 'Error al renombrar.' });
    } finally {
      setSavingName(false);
    }
  };

  if (loading) return (
    <div className="page-container flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 size={32} className="animate-spin text-indigo-500" />
      <span className="text-white/50 text-sm">Cargando vestuario...</span>
    </div>
  );
  if (!team) return (
    <div className="page-container flex flex-col items-center justify-center p-10 gap-4">
      <h2 className="text-white font-bold text-lg">No tenés equipo en esta liga</h2>
      <button onClick={() => navigate(`/fantasy/league/${id}`)} className="text-indigo-400 text-sm hover:underline flex items-center gap-1">
        <ArrowLeft size={14} /> Volver a la liga
      </button>
    </div>
  );

  const isComplete = draftPicks.length === 11;

  return (
    <div className="page-container fade-in px-2 sm:px-4 py-3 sm:py-4 max-w-[1600px] mx-auto">
      {/* BACK BUTTON */}
      <button
        onClick={() => navigate(`/fantasy/league/${id}`)}
        className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-medium mb-2 sm:mb-3 bg-transparent border-none cursor-pointer transition-colors"
      >
        <ArrowLeft size={14} /> Volver a la liga
      </button>

      {/* HUD */}
      <div className="glass-card bg-black/20 p-3 sm:p-4 mb-3 sm:mb-4 rounded-xl sm:rounded-2xl">
        <div className="flex flex-wrap justify-between items-center gap-2 sm:gap-4">
          {activeGw && (
            <div className="flex flex-col items-center sm:items-start w-full sm:w-auto order-2 sm:order-1">
              <span className="text-white/50 text-[10px] sm:text-xs uppercase tracking-widest font-bold mb-0.5">
                Fecha {activeGw.gameweekNumber}
              </span>
              <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 border ${activeGw.transfersOpen ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${activeGw.transfersOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                {activeGw.transfersOpen ? `Cierra: ${countdown}` : 'Cerrado'}
              </div>
            </div>
          )}

          {/* Team Name — editable */}
          <div className="flex flex-col items-center flex-1 min-w-0 order-1 sm:order-2">
            <span className="text-white/50 text-[10px] sm:text-xs uppercase tracking-widest font-bold">Mi Equipo</span>
            {isEditingName ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={30}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsEditingName(false); }}
                  className="bg-black/40 border border-indigo-500/50 rounded-lg px-2 py-1 text-white text-sm sm:text-base font-bold text-center focus:outline-none w-[160px] sm:w-[200px]"
                />
                <button
                  onClick={handleRename}
                  disabled={savingName}
                  className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/40 transition border-none cursor-pointer disabled:opacity-50"
                >
                  {savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 text-white/50 flex items-center justify-center hover:bg-white/10 transition border-none cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <strong className="text-base sm:text-xl text-white font-black truncate max-w-[160px] sm:max-w-[250px]">{team.name}</strong>
                <button
                  onClick={() => { setEditName(team.name); setIsEditingName(true); }}
                  className="w-6 h-6 rounded-md bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition border-none cursor-pointer shrink-0"
                  title="Editar nombre"
                >
                  <Pencil size={11} />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center sm:items-end w-full sm:w-auto order-3">
            <span className="text-white/50 text-[10px] sm:text-xs uppercase tracking-widest font-bold">Pts Totales</span>
            <strong className="text-xl sm:text-2xl text-emerald-400 font-mono font-black">{team.totalPoints}</strong>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-white/40 text-[9px] uppercase font-bold tracking-wider">
                {viewMode === 'current'
                  ? (activeGw?.status === 'IN_PROGRESS' ? `Parcial F${activeGw?.gameweekNumber}` : 'Próxima')
                  : `Fecha ${currentGw?.gameweekNumber}`}
              </span>
              <span className="text-indigo-300 font-mono font-black text-sm">
                {viewMode === 'current' && activeGw?.status !== 'IN_PROGRESS'
                  ? '–'
                  : (loadingGwPts ? '...' : (gwTotalPts != null ? gwTotalPts : '–'))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 sm:gap-6 items-start w-full">
        {/* BOTÓN MÓVIL PARA FIXTURES */}
        <button
          onClick={() => setShowFixturesDrawer(true)}
          className="lg:hidden fixed left-0 top-[60%] -translate-y-1/2 z-40 bg-black/60 backdrop-blur-md text-white/70 p-2 rounded-r-xl shadow-lg border border-l-0 border-white/10 hover:text-white transition-all hover:bg-black/90 flex items-center justify-center"
          title="Partidos de la Fecha"
        >
          <Calendar size={14} />
        </button>

        {/* OVERLAY Y DRAWER MÓVIL PARA FIXTURES */}
        {showFixturesDrawer && (
          <div className="lg:hidden fixed inset-0 bg-black/80 z-50 flex" onClick={() => setShowFixturesDrawer(false)}>
            <div
              className="w-[80vw] max-w-[300px] h-full glass-card bg-black/60 shadow-2xl animate-fade-in p-3 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  Fecha {activeGw?.gameweekNumber}
                </h3>
                <button onClick={() => setShowFixturesDrawer(false)} className="bg-white/5 p-1 rounded-lg text-white/50 hover:text-white border-none cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1 pr-1">
                {nextFixtures && nextFixtures.length > 0 ? (
                  nextFixtures.map(f => {
                    const hTeam = leagueTeams.find(t => t.teamId === f.homeTeamId)?.teamName || `Local`;
                    const aTeam = leagueTeams.find(t => t.teamId === f.awayTeamId)?.teamName || `Visitante`;
                    return (
                      <div key={f.id} className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[11px] font-bold text-white/90">
                          <span className="truncate w-2/5 text-left" title={hTeam}>{hTeam}</span>
                          <span className="bg-black/40 text-white/50 px-1 py-0.5 rounded text-[9px] font-black border border-white/5">VS</span>
                          <span className="truncate w-2/5 text-right" title={aTeam}>{aTeam}</span>
                        </div>
                        <div className="text-[9px] text-white/40 text-center font-mono bg-black/20 rounded p-0.5">
                          {new Date(f.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-white/30 text-xs py-4">Sin partidos.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COLUMNA 1: FIXTURES (Desktop Solo) */}
        <div className="hidden lg:flex w-full lg:w-[380px] flex-shrink-0 glass-card bg-black/20 rounded-2xl flex-col h-[800px] overflow-hidden sticky top-4">
          <div className="p-4 border-b border-white/5 bg-black/20 h-[72px] flex items-center justify-center sm:justify-start">
            <h3 className="font-bold text-white text-sm m-0">Fixture Fecha {activeGw?.gameweekNumber}</h3>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 p-4">
            {nextFixtures && nextFixtures.length > 0 ? (
              nextFixtures.map(f => {
                const hTeam = leagueTeams.find(t => t.teamId === f.homeTeamId)?.teamName || `Local (${f.homeTeamId})`;
                const aTeam = leagueTeams.find(t => t.teamId === f.awayTeamId)?.teamName || `Visitante (${f.awayTeamId})`;
                return (
                  <div key={f.id} className="bg-white/5 hover:bg-white/10 transition-colors p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold text-white/90">
                      <span className="truncate w-2/5 text-left" title={hTeam}>{hTeam}</span>
                      <span className="bg-black/40 text-white/50 px-1.5 py-0.5 rounded text-[10px] font-black border border-white/5 shadow-inner">VS</span>
                      <span className="truncate w-2/5 text-right" title={aTeam}>{aTeam}</span>
                    </div>
                    <div className="text-[10px] text-white/40 text-center font-mono bg-black/20 rounded p-1">
                      {new Date(f.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-white/30 text-sm py-4">Sin partidos programados.</div>
            )}
          </div>
        </div>

        {/* COLUMNA 2: PITCH */}
        <div className="w-full lg:w-[480px] flex-shrink-0 flex flex-col gap-3 sm:gap-4">
          <div className="glass-card bg-black/20 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl relative flex flex-col pitch-wrapper">
            {/* Save Header / View Mode Controls */}
            <div className="flex items-center justify-between gap-2 p-2.5 sm:p-4 border-b border-white/5 bg-black/20">
              {viewMode === 'current' ? (
                <>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-white/70 text-[11px] sm:text-sm font-semibold">
                      {draftPicks.length}/11
                    </div>
                    <select
                      value={selectedFormation}
                      onChange={(e) => {
                        if (draftPicks.length > 0) {
                          useToastStore.getState().addToast({ type: 'warning', message: 'Vaciá tu equipo para cambiar táctica.' });
                        } else {
                          setSelectedFormation(e.target.value);
                        }
                      }}
                      className="bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-[10px] sm:text-xs font-bold"
                    >
                      <option value="4-4-2">4-4-2</option>
                      <option value="4-3-3">4-3-3</option>
                      <option value="3-5-2">3-5-2</option>
                      <option value="3-4-3">3-4-3</option>
                      <option value="5-3-2">5-3-2</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {draftPicks.length === 11 && activeGw?.status !== 'IN_PROGRESS' && (
                      <button
                        onClick={() => setSelectingCaptain(!selectingCaptain)}
                        className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold flex items-center gap-1.5 transition border-none cursor-pointer ${selectingCaptain
                            ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                          }`}
                      >
                        <Crown size={14} />
                        <span className="hidden sm:inline">{selectingCaptain ? 'Cancelar' : 'Capitán'}</span>
                      </button>
                    )}
                    {activeGw?.status !== 'IN_PROGRESS' && (
                      <button
                        disabled={isSaving || draftPicks.length !== 11}
                        onClick={handleSaveDraft}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-1.5 transition border-none cursor-pointer"
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span className="hidden sm:inline">{isSaving ? 'Guardando...' : 'Guardar'}</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center w-full gap-2">
                  <span className="text-emerald-400 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                    <History size={16} /> Modo Historial (Solo lectura)
                  </span>
                </div>
              )}
            </div>

            {/* GW Arrow Navigator */}
            <div className="flex items-center justify-center gap-3 px-2.5 sm:px-4 py-1.5 border-b border-white/5 bg-black/10">
              <button
                onClick={handleGwPrev}
                disabled={gwIndex <= 0}
                className="w-6 h-6 rounded-md bg-white/5 text-white/50 flex items-center justify-center hover:bg-white/10 hover:text-white transition border-none cursor-pointer disabled:opacity-20 disabled:cursor-default"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-white text-xs font-bold min-w-[80px] text-center">
                {loadingGwPts ? (
                  <Loader2 size={12} className="animate-spin inline text-indigo-400" />
                ) : currentGw ? (
                  `Fecha ${currentGw.gameweekNumber}`
                ) : (
                  'Sin fechas'
                )}
              </span>
              <button
                onClick={handleGwNext}
                disabled={gwIndex >= playableGws.length - 1}
                className="w-6 h-6 rounded-md bg-white/5 text-white/50 flex items-center justify-center hover:bg-white/10 hover:text-white transition border-none cursor-pointer disabled:opacity-20 disabled:cursor-default"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Leyenda */}
            {draftPicks.length < 11 && (
              <div className="bg-indigo-500/10 border-b border-indigo-500/20 py-1.5 flex items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wide relative">
                  👆 Tocá un hueco para reclutar
                </span>
              </div>
            )}
            {selectingCaptain && (
              <div className="bg-yellow-500/10 border-b border-yellow-500/20 py-1.5 flex items-center justify-center gap-2">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-wide">
                  Tocá un jugador para hacerlo capitán
                </span>
                <button onClick={() => setSelectingCaptain(false)} className="ml-2 text-white/50 hover:text-white bg-transparent border-none cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* The Pitch — shows points for selected GW */}
            <PitchView
              squad={displayPicks}
              onPlayerClick={handlePitchPlayerClick}
              onCaptainSelect={handleCaptainSelect}
              selectingCaptain={selectingCaptain}
              activeGameweek={activeGw}
              formation={selectedFormation}
            />
          </div>
        </div>

        {/* COLUMNA 3: MARKET PANEL */}
        <div
          className={`${showMarketDrawer ? 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 animate-fade-in' : 'hidden lg:flex flex-1 min-w-[280px] flex-col'}`}
          onClick={() => showMarketDrawer && setShowMarketDrawer(false)}
        >
          <div
            className={`glass-card rounded-xl sm:rounded-2xl flex flex-col overflow-hidden ${showMarketDrawer ? 'w-full max-w-[380px] h-[85vh] relative bg-black/80' : 'h-[800px] bg-black/20'}`}
            onClick={e => e.stopPropagation()}
          >
            {viewMode === 'current' && activeGw?.status !== 'IN_PROGRESS' ? (
              <>
                {showMarketDrawer && (
                  <button onClick={() => setShowMarketDrawer(false)} className="lg:hidden absolute top-3 right-3 z-50 bg-white/10 p-1.5 rounded-lg text-white/50 hover:text-white border-none cursor-pointer">
                    <X size={18} />
                  </button>
                )}
                <div className="p-3 sm:p-4 border-b border-white/5 bg-black/20 flex items-center">
                  <h3 className="font-bold text-white text-xs sm:text-sm m-0 flex items-center gap-2">
                    🛒 Director Deportivo
                  </h3>
                </div>

                <div className="p-3 sm:p-4 border-b border-white/5">
                  <div className="relative mb-2 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2 text-white/40" size={16} />
                      <input id="marketSearchInput"
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 sm:py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <select
                      value={teamFilter}
                      onChange={handleTeamChange}
                      className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500 w-[90px] sm:w-1/3"
                    >
                      <option value="">Club</option>
                      {leagueTeams.map(t => (
                        <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between gap-0.5 bg-black/40 p-0.5 rounded-lg">
                    {['', 'GK', 'DEF', 'MID', 'FWD'].map(pos => (
                      <button
                        key={pos}
                        onClick={() => handlePositionClick(pos)}
                        className={`flex-1 text-[10px] sm:text-xs font-bold py-1 sm:py-1.5 rounded-md transition border-none cursor-pointer ${positionFilter === pos ? 'bg-indigo-500 text-white shadow-md' : 'text-white/50 hover:bg-white/5 hover:text-white bg-transparent'}`}
                      >
                        {pos === '' ? 'Todos' : translateFilterLabel(pos)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 custom-scrollbar">
                  {loadingPlayers ? (
                    <div className="text-center text-white/40 py-8 animate-pulse text-xs">
                      <Loader2 size={20} className="animate-spin mx-auto mb-2 text-indigo-400" />
                      Buscando jugadores...
                    </div>
                  ) : players.length === 0 ? (
                    <div className="text-center text-white/40 py-8 text-xs">No se encontraron jugadores.</div>
                  ) : (
                    <React.Fragment>
                      {(!searchQuery.trim() && players.length > 10) && (
                        <div className="text-center text-[10px] font-bold text-indigo-300 bg-indigo-500/20 py-1.5 rounded-lg mb-2">
                          Usá el buscador para ver más
                        </div>
                      )}
                      {(searchQuery.trim() ? players : players.slice(0, 10)).map(p => {
                        const inDraft = draftPicks.find(d => d.playerId === p.sportmonksId);

                        let matchBadge = null;
                        if (activeGw?.fixtures && activeGw.transfersOpen) {
                          const f = activeGw.fixtures.find(fix => fix.homeTeamId === p.teamId || fix.awayTeamId === p.teamId);
                          if (f) {
                            const isHome = f.homeTeamId === p.teamId;
                            const oppId = isHome ? f.awayTeamId : f.homeTeamId;
                            const oppName = leagueTeams.find(t => t.teamId === oppId)?.teamName || 'Rival';
                            matchBadge = <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 py-0.5 rounded border border-indigo-500/30 ml-1" title={`vs ${oppName}`}>vs {oppName.substring(0, 3).toUpperCase()} {isHome ? '(L)' : '(V)'}</span>;
                          } else {
                            matchBadge = <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded border border-red-500/30 ml-1 font-bold">SIN</span>;
                          }
                        }

                        return (
                          <div key={p.sportmonksId} className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${inDraft ? 'bg-white/5 border-emerald-500/30' : 'bg-black/20 border-white/5 hover:bg-white/10'}`}>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-white font-bold text-[11px] sm:text-sm leading-tight flex items-center flex-wrap">{p.name} {matchBadge}</h4>
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold mt-0.5">
                                <span className="px-1.5 py-0.5 rounded text-white/90 bg-white/5 border border-white/10">{translatePosition(p.position)}</span>
                              </div>
                            </div>
                            {inDraft ? (
                              <button onClick={() => {
                                handlePitchPlayerClick({ playerId: p.sportmonksId, purchasePrice: p.price, isDummy: false });
                              }} className="h-7 w-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition group border-none cursor-pointer shrink-0 ml-2">
                                <Trash2 size={13} className="group-hover:scale-110" />
                              </button>
                            ) : (
                              <button onClick={() => {
                                handleSignPlayer(p);
                                if (window.innerWidth < 1024) setShowMarketDrawer(false);
                              }} disabled={isComplete} className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white disabled:opacity-30 transition group border-none cursor-pointer shrink-0 ml-2">
                                <UserPlus size={13} className="group-hover:scale-110" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center">
                <History size={48} className="text-white/20 mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">Modo Espectador</h3>
                <p className="text-white/40 text-sm max-w-xs mb-6">
                  {viewMode === 'current' && activeGw?.status === 'IN_PROGRESS'
                    ? 'La fecha se está jugando actualmente. El mercado está cerrado.'
                    : 'Estás viendo información histórica. El mercado solo abre en tu Equipo Actual.'}
                </p>
                {viewMode === 'history' && (
                  <button
                    onClick={() => { setViewMode('current'); setHistoricalPicks([]); }}
                    className="px-6 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition font-bold outline-none cursor-pointer border border-emerald-500/30"
                  >
                    Volver a Mi Equipo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FantasyTeam;
