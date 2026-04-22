import { useState, useEffect } from "react";
import { Zap, Loader2, Play, Users, Trophy, Flag, Shield, Lock } from "lucide-react";
import api from "../../services/api";
import useToastStore from "../../store/toastStore";

export default function FantasyAdminPanel() {
  const [status, setStatus] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [gwForceId, setGwForceId] = useState("");

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

  useEffect(() => {
    fetchStatus();
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

  const handleSeedGameweeks = async (league) => {
    setLoadingAction(`gws_${league.id}`);
    try {
      const { data } = await api.post(`/admin/fantasy/seed-gameweeks/${league.id}`, {}, { timeout: 120000 });
      useToastStore.getState().addToast({
        type: "success",
        message: data.message || `Gameweeks importados de ${league.name} ✅`,
      });
      fetchStatus();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || err.message || "Error al importar Gameweeks",
      });
    } finally {
      setLoadingAction("");
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

  return (
    <div className="space-y-6">
      {/* Estado Actual */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seeding Players */}
        <div className="glass-card rounded-2xl p-5">
           <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
             <Trophy className="text-emerald-400" size={18} /> Importar Jugadores del Mercado
           </h3>
           <p className="text-xs text-white/50 mb-4 h-8">Sincroniza la API de Sportmonks y guarda los equipos actuales disponibles para que los usuarios puedan ficharlos.</p>
           
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

        {/* Seeding Gameweeks */}
        <div className="glass-card rounded-2xl p-5">
           <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
             <Trophy className="text-amber-400" size={18} /> Importar Gameweeks (Fechas)
           </h3>
           <p className="text-xs text-white/50 mb-4 h-8">Atrapa los Rounds de la API y crea `FantasyGameweeks` para todas las ligas privadas que estén correlacionadas con esa liga base.</p>
           
           <div className="space-y-3">
             {leagues.map(l => (
                <button
                  key={`G-${l.id}`}
                  disabled={loadingAction !== ""}
                  onClick={() => handleSeedGameweeks(l)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10 text-sm text-left disabled:opacity-50 cursor-pointer"
                >
                  <span className="flex items-center gap-2"><Flag size={14}/> {l.name}</span>
                  {loadingAction === `gws_${l.id}` ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <Play size={14} className="text-amber-400" />}
                </button>
             ))}
           </div>
        </div>
      </div>

      {/* Acciones de forzado manual */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Forzar Gameweek Activo</h3>
        <p className="text-xs text-white/50 mb-4">Si el cron automático se atascó o Sportmonks falló su Round, ingresá el ID único (cuid) del gameweek que deseás prender y poner como activo central.</p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
             type="text" 
             value={gwForceId}
             onChange={e => setGwForceId(e.target.value)}
             className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
             placeholder="Ej: clm6yab8..."
          />
          <button 
             onClick={handleForceActivateGameweek}
             disabled={!gwForceId || loadingAction !== ""}
             className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-colors border-none text-white font-bold py-3 px-6 rounded-xl cursor-pointer flex items-center justify-center gap-2"
          >
             {loadingAction === "force_gw" ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>} Activar
          </button>
        </div>
      </div>
    </div>
  );
}
