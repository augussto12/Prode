import React, { useState, useEffect } from "react";
import { Zap, Loader2, Play, Users, Trophy, Flag, Shield, Lock, Activity, Server, Database, Calculator, Globe, Download, RefreshCw } from "lucide-react";
import api from "../../services/api";
import useToastStore from "../../store/toastStore";

export default function AdminFantasy() {
  const [status, setStatus] = useState(null);
  const [rateLimits, setRateLimits] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [syncing, setSyncing] = useState({});
  const [gwForceId, setGwForceId] = useState("");
  const [fixtureIdTarget, setFixtureIdTarget] = useState("");

  const leagues = [
    { id: 636, name: "Liga Profesional Argentina", country: "AR" },
    { id: 8, name: "Premier League", country: "EN" },
    { id: 564, name: "La Liga", country: "ES" },
    { id: 384, name: "Serie A", country: "IT" },
  ];

  const fetchStatus = async () => {
    try {
      const res = await api.get("/admin/fantasy/status");
      setStatus(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRateLimits = async () => {
    try {
      const res = await api.get("/admin/rate-limits");
      setRateLimits(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRateLimits();
    const interval = setInterval(fetchRateLimits, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSeedPlayers = async (league) => {
    setLoadingAction(`players_${league.id}`);
    try {
      const { data } = await api.post(`/admin/fantasy/seed-players/${league.id}`, {}, { timeout: 120000 });
      useToastStore.getState().addToast({
        type: "success",
        message: data.message || `Jugadores importados de ${league.name} ✅`,
      });
      fetchStatus();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || err.message || "Error al importar jugadores",
      });
    } finally {
      setLoadingAction("");
    }
  };

  // --- SYNC SEASON (Paso 1) ---
  const handleSyncSeason = async (league) => {
    const confirmed = window.confirm(
      `Esto descargará todos los partidos de la temporada de ${league.name} (~380 fixtures) y puede tardar 30-60 segundos.\n\n¿Continuar?`
    );
    if (!confirmed) return;

    setSyncing(prev => ({ ...prev, [league.id]: true }));
    try {
      const { data } = await api.post(`/admin/fantasy/sync-season/${league.id}`, {}, { timeout: 300000 });
      useToastStore.getState().addToast({
        type: "success",
        message: `✓ ${data.total} fixtures | ${data.created} creados | ${data.updated} actualizados | ${data.pagesProcessed} páginas | Duración: ${data.duration}`,
      });
      fetchStatus();
    } catch (err) {
      const partial = err.response?.data?.partialResult;
      let msg = err.response?.data?.error || err.message || "Error en sync";
      if (partial) {
        msg += `\n⚠️ Parcial: ${partial.created} creados, ${partial.updated} actualizados, ${partial.pagesProcessed} páginas procesadas antes del error (${partial.duration})`;
      }
      useToastStore.getState().addToast({ type: "error", message: msg });
    } finally {
      setSyncing(prev => ({ ...prev, [league.id]: false }));
    }
  };

  // --- SEED GAMEWEEKS (Paso 2) ---
  const handleSeedGameweeks = async (league) => {
    setSyncing(prev => ({ ...prev, [`gws_${league.id}`]: true }));
    try {
      const { data } = await api.post(`/admin/fantasy/seed-gameweeks/${league.id}`, {}, { timeout: 120000 });
      let msg = data.message || `Gameweeks importados de ${league.name} ✅`;
      if (data.stats) {
        msg = `GWs importados de ${league.name}\nNuevos: ${data.stats.created}\nCurados (roundId nulo): ${data.stats.updatedNull}\nActualizados: ${data.stats.updatedExisting}`;
      }
      useToastStore.getState().addToast({ type: "success", message: msg });
      fetchStatus();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || err.message || "Error al importar Gameweeks",
      });
    } finally {
      setSyncing(prev => ({ ...prev, [`gws_${league.id}`]: false }));
    }
  };

  const handleForceActivateGameweek = async () => {
    if (!gwForceId) return;
    setLoadingAction("force_gw");
    try {
      const { data } = await api.put(`/admin/fantasy/gameweeks/${gwForceId}/activate`);
      useToastStore.getState().addToast({
        type: "success",
        message: "Gameweek forzado y activado",
      });
      setGwForceId("");
      fetchStatus();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al forzar gameweek",
      });
    } finally {
      setLoadingAction("");
    }
  };

  const handleTriggerCron = async (endpoint, label) => {
    setLoadingAction(`cron_${endpoint}`);
    try {
      const { data } = await api.post(`/admin/${endpoint}`);
      useToastStore.getState().addToast({
        type: "success",
        message: data.message || `${label} ejecutado ✅`,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || err.message || `Error en ${label}`,
      });
    } finally {
      setLoadingAction("");
    }
  };

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1 - Estado del Sistema Fantasy */}
      <div className="glass-card rounded-2xl p-5 border border-indigo-500/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="text-amber-400" /> Estado del Servidor
        </h3>
        {status ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <Users className="mx-auto mb-2 text-indigo-400" />
              <div className="text-2xl font-bold text-white">{status.playersCount}</div>
              <div className="text-xs text-white/50">Jugadores Indexados</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <Shield className="mx-auto mb-2 text-emerald-400" />
              <div className="text-2xl font-bold text-white">{status.totalTeams}</div>
              <div className="text-xs text-white/50">Equipos de Usuarios</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <Trophy className="mx-auto mb-2 text-amber-400" />
              <div className="text-2xl font-bold text-white">{status.totalLeagues}</div>
              <div className="text-xs text-white/50">Ligas Activas</div>
            </div>
            <div className={`rounded-xl p-4 text-center border ${status.activeGameweek?.transfersOpen ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
               <Lock className="mx-auto mb-2" />
               <div className="text-sm font-bold truncate">GW {status.activeGameweek?.gameweekNumber || '?'}</div>
               <div className="text-xs mt-1">{status.activeGameweek?.transfersOpen ? "Mercado Abierto" : "Mercado Cerrado"}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-white/50">Cargando estado...</div>
        )}
      </div>

      {/* ESTADO POR LIGA */}
      {status?.leaguesContext && status.leaguesContext.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="text-emerald-400" size={16}/> Estado por Liga
          </h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {status.leaguesContext.map((lCtx, idx) => {
              const { leagueDetails, context, fixtures } = lCtx;
              const gw = context.gameweek;
              const isOpen = context.transfersOpen;
              return (
                <div key={idx} className="glass-card rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-white text-lg">{leagueDetails.name}</h4>
                    {isOpen ? (
                       <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-md font-bold uppercase flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Transferencias Abiertas
                       </span>
                    ) : (
                       <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-md font-bold uppercase flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Fecha en Curso
                       </span>
                    )}
                  </div>

                  {gw ? (
                    <div className="space-y-2">
                      <div className="text-sm text-white/80">
                         {context.status === 'IN_PROGRESS' ? (
                           <><strong>Transferencias cerradas hasta:</strong> {new Date(gw.endDate).toLocaleString()}</>
                         ) : context.status === 'OPEN' ? (
                           <><strong>Próxima fecha:</strong> GW {gw.gameweekNumber} — {context.opensUntil ? `inicia ${new Date(context.opensUntil).toLocaleString()}` : ''}</>
                         ) : (
                           <><strong>Temporada finalizada</strong></>
                         )}
                      </div>
                      
                      {fixtures && fixtures.length > 0 && (
                         <div className="mt-3 bg-black/20 rounded-lg p-3">
                           <div className="text-xs text-white/50 mb-2 font-bold uppercase">Partidos {context.status === 'IN_PROGRESS' ? 'en juego' : 'próximos'}:</div>
                           <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                              {fixtures.map((f, fIdx) => (
                                 <div key={fIdx} className="text-xs flex justify-between text-white/70">
                                   <span>{f.homeTeamId} vs {f.awayTeamId}</span>
                                   <span className="text-white/40">{new Date(f.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                 </div>
                              ))}
                           </div>
                         </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-white/50 mt-2">No hay gameweeks configurados.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monitor de Rate Limits */}
      {rateLimits && (
        <div className="glass-card rounded-2xl p-5">
           <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
             <Activity className="text-indigo-400" size={16}/> Monitor Rate Limits
           </h3>
           <div className="grid grid-cols-2 gap-4">
             <div className="bg-black/20 rounded-xl p-3 border border-white/5 flex justify-between items-center">
                <div>
                   <div className="text-xs text-white/50">Sportmonks API (Remaining)</div>
                   <div className="text-lg font-black text-emerald-400">{rateLimits.sportmonks?.remaining ?? 'N/A'}</div>
                </div>
                <Globe size={24} className="text-white/20"/>
             </div>
             <div className="bg-black/20 rounded-xl p-3 border border-white/5 flex justify-between items-center">
                <div>
                   <div className="text-xs text-white/50">API-Football (Remaining / Limit)</div>
                   <div className="text-lg font-black text-blue-400">{rateLimits.apiFootball?.remaining ?? 'N/A'} <span className="text-sm text-white/30">/ {rateLimits.apiFootball?.limit ?? 'N/A'}</span></div>
                </div>
                <Server size={24} className="text-white/20"/>
             </div>
           </div>
           <p className="text-[10px] text-white/40 mt-2 text-right">Se actualiza automáticamente cada 30 segundos usando Polling.</p>
        </div>
      )}

      {/* SECCIÓN SYNC — Sincronización de Temporada (Paso 1) + Gameweeks (Paso 2) */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Download className="text-cyan-400" size={18} /> Sincronización de Datos
        </h3>
        <p className="text-xs text-white/50 mb-5">Ejecutar en orden: primero sincronizar la temporada (descarga fixtures), luego importar gameweeks (calcula fechas desde BD local).</p>
        
        <div className="space-y-4">
          {leagues.map(l => {
            const isSyncingThis = syncing[l.id];
            const isSyncingGws = syncing[`gws_${l.id}`];
            return (
              <div key={l.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Flag size={14} className="text-white/50" />
                  <span className="font-bold text-white text-sm">{l.name}</span>
                  <span className="text-[10px] text-white/30 ml-auto">League {l.id}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Paso 1: Sync Season */}
                  <button
                    disabled={isSyncingThis}
                    onClick={() => handleSyncSeason(l)}
                    className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition border border-cyan-500/20 text-sm text-left disabled:opacity-60 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-cyan-400">
                      <span className="bg-cyan-500/30 text-[10px] rounded px-1.5 py-0.5 font-bold text-cyan-300">PASO 1</span>
                      Sync Temporada
                    </span>
                    {isSyncingThis ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : <Download size={14} className="text-cyan-400" />}
                  </button>
                  {/* Paso 2: Seed Gameweeks */}
                  <button
                    disabled={isSyncingGws}
                    onClick={() => handleSeedGameweeks(l)}
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition border border-amber-500/20 text-sm text-left disabled:opacity-60 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-amber-400">
                      <span className="bg-amber-500/30 text-[10px] rounded px-1.5 py-0.5 font-bold text-amber-300">PASO 2</span>
                      Importar Gameweeks
                    </span>
                    {isSyncingGws ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <RefreshCw size={14} className="text-amber-400" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Importar Jugadores */}
      <div className="glass-card rounded-2xl p-5">
         <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
           <Trophy className="text-emerald-400" size={18} /> Importar Jugadores
         </h3>
         <p className="text-xs text-white/50 mb-4">Sincroniza la API de Sportmonks y guarda los equipos actuales disponibles para que los usuarios puedan ficharlos.</p>
         
         <div className="space-y-3">
           {leagues.map(l => (
              <button
                key={`P-${l.id}`}
                disabled={loadingAction !== ""}
                onClick={() => handleSeedPlayers(l)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10 text-sm text-left disabled:opacity-50 cursor-pointer"
              >
                <span className="flex items-center gap-2"><Flag size={14}/> {l.name}</span>
                {loadingAction === `players_${l.id}` ? <Loader2 size={14} className="animate-spin text-indigo-400" /> : <Play size={14} className="text-indigo-400" />}
              </button>
           ))}
         </div>
      </div>

      {/* Acciones Manuales y Crons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Recálculo Manual de Partido</h3>
            <p className="text-xs text-white/50 mb-4">Ingresa el ID del Fixture para gatillar el recalculador manual de puntos. Si un puntaje se atoró, esto lo fuerza a nivel BD.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                 type="text" 
                 value={fixtureIdTarget}
                 onChange={e => setFixtureIdTarget(e.target.value)}
                 className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                 placeholder="ID interno (cuid)..."
              />
              <button 
                 onClick={() => handleTriggerCron(`fantasy/recalculate-fixture/${fixtureIdTarget}`, "Recalcular partido")}
                 disabled={!fixtureIdTarget || loadingAction !== ""}
                 className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 disabled:opacity-50 transition-colors border border-emerald-500/50 font-bold py-3 px-6 rounded-xl cursor-pointer flex items-center justify-center gap-2"
              >
                 {loadingAction === `cron_fantasy/recalculate-fixture/${fixtureIdTarget}` ? <Loader2 size={16} className="animate-spin"/> : <Calculator size={16}/>} Procesar
              </button>
            </div>
          </div>
          
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Forzar Gameweek Activa</h3>
            <p className="text-xs text-white/50 mb-4">Si el cron automático se atascó, ingresá el ID único (cuid) del gameweek que deseás activar o mutar (abrir transferencias libremente).</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                 type="text" 
                 value={gwForceId}
                 onChange={e => setGwForceId(e.target.value)}
                 className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                 placeholder="Gameweek ID..."
              />
              <button 
                 onClick={handleForceActivateGameweek}
                 disabled={!gwForceId || loadingAction !== ""}
                 className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-colors border-none text-white font-bold py-3 px-6 rounded-xl cursor-pointer flex items-center justify-center gap-2"
              >
                 {loadingAction === "force_gw" ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>} Forzar
              </button>
            </div>
          </div>
        </div>

        {/* Runners visuales de Crons */}
        <div className="glass-card rounded-2xl p-5">
           <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Database size={16} className="text-blue-400"/> Crons del Motor (Ejecutar ahora)
           </h3>
           <p className="text-xs text-white/50 mb-4">Estos crons corren periódicamente. Podes ejecutarlos manualmente ahora.</p>

           <div className="space-y-3">
              <button 
                 onClick={() => handleTriggerCron('sportmonks/sync-fixtures', 'Sync Partidos de Hoy')}
                 disabled={loadingAction !== ""}
                 className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10 text-sm cursor-pointer disabled:opacity-50"
              >
                  <span className="text-white">Sync Fixtures de Hoy Ahora</span>
                  {loadingAction.includes('fixtures') ? <Loader2 size={16} className="animate-spin text-blue-400"/> : <Play size={16} className="text-blue-400"/>}
              </button>

              <button 
                 onClick={() => handleTriggerCron('scoring/recalculate-leaderboards', 'Cálculo Puntajes Fantasía')}
                 disabled={loadingAction !== ""}
                 className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10 text-sm cursor-pointer disabled:opacity-50"
              >
                  <span className="text-white">Calcular puntos pendientes ahora</span>
                  {loadingAction.includes('leaderboards') ? <Loader2 size={16} className="animate-spin text-emerald-400"/> : <Play size={16} className="text-emerald-400"/>}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
