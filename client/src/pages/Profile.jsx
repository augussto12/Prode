import { useState, useEffect, useRef } from "react";
import { User, Mail, Save, Palette, Download, LogOut, Check } from "lucide-react";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/themeStore";
import { THEMES } from "../constants/themes";
import api from "../services/api";

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const logout = useAuthStore((state) => state.logout);
  const { themeId: currentThemeId, setThemeById } = useThemeStore();
  const [form, setForm] = useState({
    displayName: user?.displayName || "",
  });

  const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);
  const originalThemeId = useRef(currentThemeId);

  const [players, setPlayers] = useState([]);
  const [outrights, setOutrights] = useState({
    championTeam: "",
    runnerUpTeam: "",
    topScorerId: "",
    bestPlayerId: "",
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOutrights, setSavingOutrights] = useState(false);
  const [msg, setMsg] = useState(null);

  const [canInstall, setCanInstall] = useState(!!window.deferredPwaPrompt);

  useEffect(() => {
    loadOutrightsData();
    originalThemeId.current = currentThemeId;
    setSelectedThemeId(currentThemeId);
    const handleReady = () => setCanInstall(true);
    window.addEventListener("pwaPromptReady", handleReady);
    return () => {
      window.removeEventListener("pwaPromptReady", handleReady);
      // Si se fue sin guardar, revertir al tema original
      const store = useThemeStore.getState();
      if (store.themeId !== originalThemeId.current) {
        store.setThemeById(originalThemeId.current);
      }
    };
  }, []);

  const handleThemeSelect = (id) => {
    setSelectedThemeId(id);
    setThemeById(id); // Preview instantáneo
  };

  const loadOutrightsData = async () => {
    try {
      const [playersRes, outrightsRes] = await Promise.all([
        api.get("/dreamteam/players"),
        api.get("/outrights"),
      ]);
      setPlayers(playersRes.data);
      if (outrightsRes.data) {
        setOutrights({
          championTeam: outrightsRes.data.championTeam || "",
          runnerUpTeam: outrightsRes.data.runnerUpTeam || "",
          topScorerId: outrightsRes.data.topScorerId || "",
          bestPlayerId: outrightsRes.data.bestPlayerId || "",
        });
      }
    } catch (e) {
      console.error("Failed to load outrights", e);
    }
  };

  const handleInstall = async () => {
    if (!window.deferredPwaPrompt) return;
    window.deferredPwaPrompt.prompt();
    const { outcome } = await window.deferredPwaPrompt.userChoice;
    if (outcome === "accepted") {
      window.deferredPwaPrompt = null;
      setCanInstall(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setMsg(null);
    try {
      await api.put("/auth/me", { ...form, themeId: selectedThemeId });
      originalThemeId.current = selectedThemeId; // Actualizar referencia para cleanup
      await fetchProfile();
      setMsg({
        type: "success",
        text: "¡Perfil actualizado y tema aplicado ✅!",
      });
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.error || "Error al guardar",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveOutrights = async (e) => {
    e.preventDefault();
    setSavingOutrights(true);
    setMsg(null);
    try {
      await api.post("/outrights", outrights);
      setMsg({
        type: "success",
        text: "¡Tus apuestas globales de la Fase 3 fueron confirmadas! 🏆",
      });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.error || "Error al guardar apuestas",
      });
    } finally {
      setSavingOutrights(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white px-1">Mi Perfil</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Perfil y Temas */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex justify-between items-center gap-3 sm:gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div
                  className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl flex items-center justify-center text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
                  }}
                >
                  <User className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base sm:text-lg font-semibold text-white truncate">
                    {user?.displayName}
                  </div>
                  <div className="text-xs sm:text-sm text-white/60 truncate">@{user?.username}</div>
                  <span
                    className={`inline-block mt-0.5 sm:mt-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                      user?.role === "SUPERADMIN"
                        ? "bg-red-500/20 text-red-400"
                        : user?.role === "ADMIN"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-indigo-500/20 text-indigo-400"
                    }`}
                  >
                    {user?.role}
                  </span>
                </div>
              </div>
              
              <button
                type="submit"
                form="profile-form"
                disabled={savingProfile}
                className="shrink-0 px-3 py-2 sm:px-5 sm:py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all border-none cursor-pointer shadow-lg shadow-indigo-500/20"
              >
                <Save size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="text-xs sm:text-sm">{savingProfile ? "..." : "Guardar"}</span>
              </button>
            </div>

            <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-6 pt-1">
              <div>
                <label className="block text-white/60 text-sm mb-1.5">
                  Nombre para mostrar
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5">Email</label>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white/60 text-sm cursor-not-allowed">
                  <Mail size={14} /> {user?.email}
                </div>
              </div>

              {/* Theme Selector */}
              <div className="pt-4 border-t border-white/10 mt-6">
                <label className="text-white text-base font-bold mb-4 flex items-center gap-2">
                  <Palette size={18} /> Tema Visual
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 mt-3">
                  {THEMES.map((theme) => {
                    const isActive = selectedThemeId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleThemeSelect(theme.id)}
                        className={`relative rounded-xl p-3 border-2 transition-all cursor-pointer text-left overflow-hidden ${isActive
                            ? "border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.15)] scale-[1.02]"
                            : "border-white/10 hover:border-white/25 hover:scale-[1.01]"
                          }`}
                        style={{
                          background: `linear-gradient(135deg, ${theme.bgGradientFrom}, ${theme.bgGradientTo})`,
                        }}
                      >
                        {/* Check badge */}
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                            <Check size={12} className="text-black" />
                          </div>
                        )}

                        {/* Preview circles */}
                        <div className="flex items-center gap-1.5 mb-2.5">
                          {theme.preview.map((color, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>

                        {/* Theme name */}
                        <div className="text-xs font-bold text-white/90">
                          {theme.name}
                        </div>

                        {/* Gradient preview bar */}
                        <div
                          className="mt-2 h-1.5 rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${theme.primaryColor} 30%, ${theme.secondaryColor} 100%)`,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-white/50 mt-2">
                  El tema seleccionado se aplica en toda la app al instante.
                  Hacé click en "Guardar" para que persista.
                </p>
              </div>


            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: Pronósticos y Botones */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mx-20 -my-20 pointer-events-none"></div>
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                <span className="text-2xl">🔮</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Pronósticos Globales
                </h2>
                <p className="text-white/50 text-sm">
                  Estas predicciones suman puntos al finalizar todo el mundial
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSaveOutrights}
              className="space-y-5 relative z-10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 font-bold mb-2 ml-1">
                    🏆 Campeón (Copa)
                  </label>
                  <input
                    type="text"
                    value={outrights.championTeam}
                    onChange={(e) =>
                      setOutrights({ ...outrights, championTeam: e.target.value })
                    }
                    placeholder="Ej: Argentina"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 font-bold mb-2 ml-1">
                    🥈 Subcampeón
                  </label>
                  <input
                    type="text"
                    value={outrights.runnerUpTeam}
                    onChange={(e) =>
                      setOutrights({ ...outrights, runnerUpTeam: e.target.value })
                    }
                    placeholder="Ej: Francia"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 font-bold mb-2 ml-1">
                    ⚽ Bota de Oro
                  </label>
                  <select
                    value={outrights.topScorerId}
                    onChange={(e) =>
                      setOutrights({ ...outrights, topScorerId: e.target.value })
                    }
                    className="w-full border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none transition-colors"
                    style={{ background: 'var(--bg-end-color, #1e1b4b)' }}
                  >
                    <option value="">Seleccionar Jugador...</option>
                    {players.map((p) => (
                      <option key={`ts-${p.id}`} value={p.id}>
                        {p.name} ({p.country})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 font-bold mb-2 ml-1">
                    ⭐ Balón de Oro
                  </label>
                  <select
                    value={outrights.bestPlayerId}
                    onChange={(e) =>
                      setOutrights({ ...outrights, bestPlayerId: e.target.value })
                    }
                    className="w-full border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none transition-colors"
                    style={{ background: 'var(--bg-end-color, #1e1b4b)' }}
                  >
                    <option value="">Seleccionar Jugador...</option>
                    {players.map((p) => (
                      <option key={`bp-${p.id}`} value={p.id}>
                        {p.name} ({p.country})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingOutrights}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-6 border-none cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              >
                <Save size={18} />{" "}
                {savingOutrights ? "Confirmando..." : "Fijar Apuestas Globales"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-3">
            {canInstall && (
              <button
                onClick={handleInstall}
                className="w-full py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all border-none"
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white",
                }}
              >
                <Download size={20} /> Instalar la Aplicación
              </button>
            )}

            <button
              onClick={logout}
              className="w-full py-3.5 px-4 rounded-xl bg-white/5 border border-red-500/30 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/10 cursor-pointer transition-all shadow-lg"
            >
              <LogOut size={20} /> Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-sm font-medium z-50 shadow-xl ${msg.type === "success"
              ? "bg-emerald-500/90 text-white"
              : "bg-red-500/90 text-white"
            }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
