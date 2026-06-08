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
  const [savingProfile, setSavingProfile] = useState(false);
  const [msg, setMsg] = useState(null);
  const [canInstall, setCanInstall] = useState(!!window.deferredPwaPrompt);

  useEffect(() => {
    originalThemeId.current = currentThemeId;
    setSelectedThemeId(currentThemeId);
    const handleReady = () => setCanInstall(true);
    window.addEventListener("pwaPromptReady", handleReady);
    return () => {
      window.removeEventListener("pwaPromptReady", handleReady);
      const store = useThemeStore.getState();
      if (store.themeId !== originalThemeId.current) {
        store.setThemeById(originalThemeId.current);
      }
    };
    // This runs only on mount/unmount so an unsaved theme preview can be reverted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleThemeSelect = (id) => {
    setSelectedThemeId(id);
    setThemeById(id);
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
      originalThemeId.current = selectedThemeId;
      await fetchProfile();
      setMsg({ type: "success", text: "Perfil actualizado y tema aplicado." });
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.error || "Error al guardar",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white px-1">Mi Perfil</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6">
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
                  <div className="text-xs sm:text-sm text-white/60 truncate">
                    @{user?.username}
                  </div>
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
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5">Email</label>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white/60 text-sm cursor-not-allowed">
                  <Mail size={14} /> {user?.email}
                </div>
              </div>

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
                        className={`relative rounded-xl p-3 border-2 transition-all cursor-pointer text-left overflow-hidden ${
                          isActive
                            ? "border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.15)] scale-[1.02]"
                            : "border-white/10 hover:border-white/25 hover:scale-[1.01]"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${theme.bgGradientFrom}, ${theme.bgGradientTo})`,
                        }}
                      >
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                            <Check size={12} className="text-black" />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-2.5">
                          {theme.preview.map((color, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="text-xs font-bold text-white/90">{theme.name}</div>
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
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-3">
          {canInstall && (
            <button
              onClick={handleInstall}
              className="w-full py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all border-none"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
              }}
            >
              <Download size={20} /> Instalar la Aplicacion
            </button>
          )}

          <button
            onClick={logout}
            className="w-full py-3.5 px-4 rounded-xl bg-white/5 border border-red-500/30 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/10 cursor-pointer transition-all shadow-lg"
          >
            <LogOut size={20} /> Cerrar Sesion
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-sm font-medium z-50 shadow-xl ${
            msg.type === "success" ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
