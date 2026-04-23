import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Star, Trophy, ChevronLeft, ChevronRight, Shirt, Shield } from 'lucide-react';
import api from '../../services/api';

// ── Posiciones en la cancha según formación ──
// Layouts para 11 jugadores reales (formaciones de fútbol 11)
const PITCH_LAYOUTS = {
    '4-3-3': {
        GK: [{ top: '88%', left: '50%' }],
        DEF: [
            { top: '70%', left: '15%' },
            { top: '70%', left: '38%' },
            { top: '70%', left: '62%' },
            { top: '70%', left: '85%' },
        ],
        MID: [
            { top: '48%', left: '25%' },
            { top: '45%', left: '50%' },
            { top: '48%', left: '75%' },
        ],
        FWD: [
            { top: '22%', left: '20%' },
            { top: '18%', left: '50%' },
            { top: '22%', left: '80%' },
        ],
    },
    '4-4-2': {
        GK: [{ top: '88%', left: '50%' }],
        DEF: [
            { top: '70%', left: '15%' },
            { top: '70%', left: '38%' },
            { top: '70%', left: '62%' },
            { top: '70%', left: '85%' },
        ],
        MID: [
            { top: '48%', left: '15%' },
            { top: '45%', left: '38%' },
            { top: '45%', left: '62%' },
            { top: '48%', left: '85%' },
        ],
        FWD: [
            { top: '20%', left: '35%' },
            { top: '20%', left: '65%' },
        ],
    },
    '3-5-2': {
        GK: [{ top: '88%', left: '50%' }],
        DEF: [
            { top: '70%', left: '25%' },
            { top: '70%', left: '50%' },
            { top: '70%', left: '75%' },
        ],
        MID: [
            { top: '48%', left: '10%' },
            { top: '45%', left: '30%' },
            { top: '42%', left: '50%' },
            { top: '45%', left: '70%' },
            { top: '48%', left: '90%' },
        ],
        FWD: [
            { top: '20%', left: '35%' },
            { top: '20%', left: '65%' },
        ],
    },
    '3-4-3': {
        GK: [{ top: '88%', left: '50%' }],
        DEF: [
            { top: '70%', left: '25%' },
            { top: '70%', left: '50%' },
            { top: '70%', left: '75%' },
        ],
        MID: [
            { top: '48%', left: '15%' },
            { top: '45%', left: '38%' },
            { top: '45%', left: '62%' },
            { top: '48%', left: '85%' },
        ],
        FWD: [
            { top: '22%', left: '20%' },
            { top: '18%', left: '50%' },
            { top: '22%', left: '80%' },
        ],
    },
    '5-3-2': {
        GK: [{ top: '88%', left: '50%' }],
        DEF: [
            { top: '70%', left: '10%' },
            { top: '70%', left: '30%' },
            { top: '70%', left: '50%' },
            { top: '70%', left: '70%' },
            { top: '70%', left: '90%' },
        ],
        MID: [
            { top: '47%', left: '25%' },
            { top: '44%', left: '50%' },
            { top: '47%', left: '75%' },
        ],
        FWD: [
            { top: '20%', left: '35%' },
            { top: '20%', left: '65%' },
        ],
    },
    '5-4-1': {
        GK: [{ top: '88%', left: '50%' }],
        DEF: [
            { top: '70%', left: '10%' },
            { top: '70%', left: '30%' },
            { top: '70%', left: '50%' },
            { top: '70%', left: '70%' },
            { top: '70%', left: '90%' },
        ],
        MID: [
            { top: '48%', left: '15%' },
            { top: '45%', left: '38%' },
            { top: '45%', left: '62%' },
            { top: '48%', left: '85%' },
        ],
        FWD: [
            { top: '20%', left: '50%' },
        ],
    },
};

const POS_COLORS = {
    GK: 'border-amber-400 shadow-amber-400/30',
    DEF: 'border-blue-400 shadow-blue-400/30',
    MID: 'border-emerald-400 shadow-emerald-400/30',
    FWD: 'border-red-400 shadow-red-400/30',
};

const POS_BADGE = {
    GK: 'bg-amber-500/20 text-amber-400',
    DEF: 'bg-blue-500/20 text-blue-400',
    MID: 'bg-emerald-500/20 text-emerald-400',
    FWD: 'bg-red-500/20 text-red-400',
};

const POS_LABEL = { GK: 'ARQ', DEF: 'DEF', MID: 'MED', FWD: 'DEL' };

export default function IdealTeamTab({ leagueId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [selectedGwId, setSelectedGwId] = useState(null);

    const fetchIdealTeam = useCallback(async (gwId = null) => {
        setLoading(true);
        setError(null);
        try {
            const params = gwId ? `?gwId=${gwId}` : '';
            const res = await api.get(`/fantasy/leagues/${leagueId}/ideal-team${params}`);
            setData(res.data);
            if (res.data.gameweek) {
                setSelectedGwId(res.data.gameweek.id);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar el equipo ideal.');
        } finally {
            setLoading(false);
            setHasFetched(true);
        }
    }, [leagueId]);

    // Lazy load: solo cuando se monta
    useEffect(() => {
        if (!hasFetched) {
            fetchIdealTeam();
        }
    }, [hasFetched, fetchIdealTeam]);

    const handleGwChange = (gwId) => {
        setSelectedGwId(gwId);
        fetchIdealTeam(gwId);
    };

    // ── Navegación de fecha con flechas ──
    const navigateGw = (direction) => {
        if (!data?.gameweeks) return;
        const finishedGws = data.gameweeks.filter(gw => gw.status === 'FINISHED');
        const currentIdx = finishedGws.findIndex(gw => gw.id === selectedGwId);
        const nextIdx = currentIdx + direction;
        if (nextIdx >= 0 && nextIdx < finishedGws.length) {
            handleGwChange(finishedGws[nextIdx].id);
        }
    };

    // ── Render states ──
    if (loading && !hasFetched) {
        return (
            <div className="glass-card rounded-xl sm:rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center gap-4 animate-fade-in">
                <Loader2 size={32} className="animate-spin text-amber-400" />
                <span className="text-white/50 text-sm">Calculando el 11 ideal...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card rounded-xl sm:rounded-2xl p-8 text-center animate-fade-in">
                <p className="text-red-400 text-sm">{error}</p>
            </div>
        );
    }

    if (hasFetched && (!data || data.players?.length === 0)) {
        return (
            <div className="glass-card rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center animate-fade-in">
                <Shield size={48} className="text-white/10 mx-auto mb-4" />
                <p className="text-white/50 text-sm font-semibold">
                    {data?.message || 'No hay datos para mostrar.'}
                </p>
                <p className="text-white/30 text-xs mt-2">Los datos estarán disponibles una vez que se jueguen partidos en esta liga.</p>
            </div>
        );
    }

    if (!data) return null;

    const { players, formation, totalPoints, gameweek, gameweeks = [] } = data;
    const layout = PITCH_LAYOUTS[formation] || PITCH_LAYOUTS['4-3-3'];

    // Map players into pitch positions
    const byRole = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of players) {
        if (byRole[p.role]) byRole[p.role].push(p);
    }

    const finishedGws = gameweeks.filter(gw => gw.status === 'FINISHED');
    const currentGwIdx = finishedGws.findIndex(gw => gw.id === selectedGwId);
    const canGoBack = currentGwIdx > 0;
    const canGoForward = currentGwIdx < finishedGws.length - 1;

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header con selector de fecha y total */}
            <div className="glass-card rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between p-3 sm:p-4 bg-black/40 border-b border-white/5">
                    <button
                        onClick={() => navigateGw(-1)}
                        disabled={!canGoBack || loading}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white shrink-0"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="flex flex-col items-center">
                        <div className="text-white font-black tracking-wide uppercase text-xs sm:text-sm flex items-center gap-2">
                            <Star size={14} className="text-amber-400" />
                            11 Ideal — Fecha {gameweek?.number}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] sm:text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded font-semibold">
                                {formation}
                            </span>
                            <span className="text-[10px] sm:text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold">
                                {totalPoints} pts
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => navigateGw(1)}
                        disabled={!canGoForward || loading}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white shrink-0"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Loading overlay for gameweek switching */}
                {loading && (
                    <div className="flex items-center justify-center p-6 gap-2">
                        <Loader2 size={20} className="animate-spin text-amber-400" />
                        <span className="text-white/40 text-xs">Cargando...</span>
                    </div>
                )}

                {/* Pitch */}
                {!loading && (
                    <div className="p-3 sm:p-5">
                        <div
                            className="w-full max-w-[540px] mx-auto rounded-3xl overflow-hidden shadow-2xl relative border-[6px] sm:border-8 border-green-900/50 bg-[#2d5a27]"
                            style={{
                                aspectRatio: '3/4',
                                backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                                backgroundSize: '100% 10%',
                            }}
                        >
                            {/* Pasto alternado */}
                            <div className="absolute inset-0 opacity-20 pointer-events-none flex flex-col">
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-black/20' : 'bg-transparent'}`} />
                                ))}
                            </div>

                            {/* Líneas de la cancha */}
                            <div className="absolute inset-0 pointer-events-none p-3 sm:p-4 opacity-70">
                                <div className="w-full h-full border-2 border-white/50 relative">
                                    <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/50" />
                                    <div className="absolute top-1/2 left-1/2 w-16 h-16 sm:w-24 sm:h-24 border-2 border-white/50 rounded-full -translate-x-1/2 -translate-y-1/2" />
                                    <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white/50 rounded-full -translate-x-1/2 -translate-y-1/2" />
                                    <div className="absolute top-0 left-1/2 w-32 sm:w-48 h-16 sm:h-24 border-2 border-t-0 border-white/50 -translate-x-1/2" />
                                    <div className="absolute top-0 left-1/2 w-16 sm:w-24 h-6 sm:h-8 border-2 border-t-0 border-white/50 -translate-x-1/2" />
                                    <div className="absolute bottom-0 left-1/2 w-32 sm:w-48 h-16 sm:h-24 border-2 border-b-0 border-white/50 -translate-x-1/2" />
                                    <div className="absolute bottom-0 left-1/2 w-16 sm:w-24 h-6 sm:h-8 border-2 border-b-0 border-white/50 -translate-x-1/2" />
                                </div>
                            </div>

                            {/* Jugadores */}
                            {['GK', 'DEF', 'MID', 'FWD'].map(role => {
                                const posPlayers = byRole[role] || [];
                                const posLayout = layout[role] || [];
                                return posPlayers.map((player, idx) => {
                                    const pos = posLayout[idx];
                                    if (!pos) return null;
                                    return (
                                        <div
                                            key={`${role}-${idx}`}
                                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
                                            style={{ top: pos.top, left: pos.left, zIndex: 10 }}
                                        >
                                            {/* Foto */}
                                            <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 shadow-lg bg-slate-800/90 ${POS_COLORS[role]} overflow-hidden transition-transform group-hover:scale-110`}>
                                                <img
                                                    src={player.photoUrl || 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png'}
                                                    alt={player.displayName}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                    onError={(e) => { e.target.src = '/placeholder-team.svg'; }}
                                                />
                                            </div>

                                            {/* Nombre + Puntos */}
                                            <div className="mt-0.5 sm:mt-1 bg-[#0f172a]/90 backdrop-blur-sm border border-white/10 rounded-md px-1 sm:px-1.5 py-0.5 text-center shadow-lg max-w-[65px] sm:max-w-[90px]">
                                                <div className="text-[8px] sm:text-[10px] text-white font-bold truncate leading-tight">
                                                    {(player.displayName || player.playerName || '').split(' ').pop()}
                                                </div>
                                                <div className="text-[8px] sm:text-[10px] font-black text-amber-400 leading-tight">
                                                    {player.pointsTotal} pts
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de jugadores detallada */}
            {!loading && players.length > 0 && (
                <div className="glass-card rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-3 sm:p-4 bg-black/40 border-b border-white/5">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            <Trophy size={16} className="text-amber-400" />
                            Detalle — Fecha {gameweek?.number}
                        </h3>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20 text-white/50 text-[10px] uppercase tracking-wider">
                                    <th className="p-2.5 font-semibold w-8">#</th>
                                    <th className="p-2.5 font-semibold">Jugador</th>
                                    <th className="p-2.5 font-semibold">Equipo</th>
                                    <th className="p-2.5 font-semibold text-center">Pos</th>
                                    <th className="p-2.5 font-semibold text-center">⚽</th>
                                    <th className="p-2.5 font-semibold text-center">🅰️</th>
                                    <th className="p-2.5 font-semibold text-right">Pts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {players.map((p, i) => (
                                    <tr key={p.playerId} className="hover:bg-white/5 transition-colors">
                                        <td className="p-2.5 text-white/40 text-xs font-mono">{i + 1}</td>
                                        <td className="p-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <img
                                                    src={p.photoUrl || 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png'}
                                                    alt={p.displayName}
                                                    className="w-8 h-8 rounded-full bg-black/50 border border-white/20 object-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                    onError={(e) => { e.target.src = '/placeholder-team.svg'; }}
                                                />
                                                <span className="text-xs font-bold text-white/90">{p.displayName || p.playerName}</span>
                                            </div>
                                        </td>
                                        <td className="p-2.5 text-xs text-white/50">{p.teamName}</td>
                                        <td className="p-2.5 text-center">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${POS_BADGE[p.role]}`}>
                                                {POS_LABEL[p.role]}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-center text-xs text-white/70">{p.goals || 0}</td>
                                        <td className="p-2.5 text-center text-xs text-white/70">{p.assists || 0}</td>
                                        <td className="p-2.5 text-right">
                                            <span className="text-sm font-black text-amber-400">{p.pointsTotal}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-black/30 border-t border-white/10">
                                    <td colSpan={6} className="p-2.5 text-xs font-bold text-white/60 text-right uppercase tracking-wider">Total</td>
                                    <td className="p-2.5 text-right">
                                        <span className="text-base font-black text-amber-400">{totalPoints}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-white/5">
                        {players.map((p, i) => (
                            <div key={p.playerId} className="flex items-center gap-2.5 p-2.5 hover:bg-white/5 transition-colors">
                                <span className="text-white/30 text-[10px] font-mono w-4 shrink-0 text-center">{i + 1}</span>
                                <img
                                    src={p.photoUrl || 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png'}
                                    alt={p.displayName}
                                    className="w-9 h-9 rounded-full bg-black/50 border border-white/20 object-cover shrink-0"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => { e.target.src = '/placeholder-team.svg'; }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-white/90 truncate">{p.displayName || p.playerName}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`text-[9px] font-bold px-1 py-0 rounded ${POS_BADGE[p.role]}`}>{POS_LABEL[p.role]}</span>
                                        <span className="text-[9px] text-white/40 truncate">{p.teamName}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="text-sm font-black text-amber-400">{p.pointsTotal}</span>
                                    <div className="flex gap-1.5 text-[9px] text-white/40">
                                        {p.goals > 0 && <span>⚽{p.goals}</span>}
                                        {p.assists > 0 && <span>🅰️{p.assists}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Total mobile */}
                        <div className="flex items-center justify-between p-3 bg-black/30">
                            <span className="text-xs font-bold text-white/50 uppercase">Total</span>
                            <span className="text-base font-black text-amber-400">{totalPoints} pts</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
