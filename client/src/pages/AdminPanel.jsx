import { useState, useEffect } from "react";
import { m } from "framer-motion";
import {
  Shield,
  Users,
  Trophy,
  Save,
  Calculator,
  ChevronDown,
  Trash2,
  RefreshCw,
  Database,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Info,
  Globe,
  Play,
  Eye,
} from "lucide-react";
import api from "../services/api";
import useToastStore from "../store/toastStore";
import useAuthStore from "../store/authStore";
import useCompetitionStore from "../store/competitionStore";
import AdminFantasy from "./admin/AdminFantasy";
import AdminUsers from "./admin/AdminUsers";
import AdminSystem from "./admin/AdminSystem";

export default function AdminPanel() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [scoringConfig, setScoringConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const activeCompetition = useCompetitionStore(
    (state) => state.activeCompetition,
  );
  const fetchCompetitions = useCompetitionStore(
    (state) => state.fetchCompetitions,
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userRes, configRes] = await Promise.all([
        api.get("/admin/users").catch(() => ({ data: [] })),
        api.get("/admin/scoring/config").catch(() => ({ data: null })),
      ]);
      setUsers(userRes.data);
      setScoringConfig(configRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerCalculateScores = async () => {
    setSaving(true);
    try {
      const res = await api.post("/admin/scoring/calculate");
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: res.data?.message || "Puntajes calculados correctamente ✅",
        });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al calcular puntajes",
        });
    } finally {
      setSaving(false);
    }
  };

  const [recalculating, setRecalculating] = useState(false);
  const triggerRecalculateLeaderboards = async () => {
    setRecalculating(true);
    try {
      const res = await api.post("/admin/scoring/recalculate-leaderboards");
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: res.data?.message || "Leaderboards recalculados ✅",
        });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al recalcular",
        });
    } finally {
      setRecalculating(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/role`, {
        role: newRole,
      });
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)));
      useToastStore
        .getState()
        .addToast({ type: "success", message: `Rol actualizado a ${newRole}` });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al cambiar rol",
        });
    }
  };

  const handleDeleteUser = (userId, displayName) => {
    useToastStore.getState().askConfirm({
      title: "Eliminar Usuario",
      message: `¿Estás seguro de que querés eliminar a "${displayName}"? Se borrarán sus predicciones, grupos, dream team y todo su progreso. Esta acción es irreversible.`,
      confirmText: "Eliminar",
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users/${userId}`);
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          useToastStore
            .getState()
            .addToast({
              type: "success",
              message: `Usuario "${displayName}" eliminado`,
            });
        } catch (err) {
          useToastStore
            .getState()
            .addToast({
              type: "error",
              message: err.response?.data?.error || "Error al eliminar",
            });
        }
      },
    });
  };

  const tabs = [
    { id: "users", label: "Usuarios", icon: Users },
    { id: "scoring", label: "Puntuación", icon: Calculator },
    { id: "fantasy", label: "GranDT", icon: Trophy },
    { id: "sync", label: "Config. BD", icon: Database },
    { id: "sportmonks", label: "Sportmonks", icon: Globe },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-red-500/20 text-red-400">
          <Shield size={20} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Admin Panel
          </h1>
          <p className="text-white/50 text-xs sm:text-sm">
            Gestionar usuarios, puntuación y sincronización
          </p>
        </div>
      </div>

      {/* Tabs — scroll on mobile */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full sm:w-fit overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border-none whitespace-nowrap ${tab === t.id
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/70 bg-transparent"
              }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Quick Action: Force Calculate */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center border-b border-white/5 pb-4">
        <button
          onClick={triggerCalculateScores}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 cursor-pointer border-none text-xs sm:text-sm"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Calculator size={16} />
          )}
          {saving ? "Calculando..." : "Calcular Puntos"}
        </button>
        <button
          onClick={triggerRecalculateLeaderboards}
          disabled={recalculating}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-amber-500/25 disabled:opacity-50 cursor-pointer border-none text-xs sm:text-sm"
        >
          {recalculating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {recalculating ? "Recalculando..." : "Recalcular Leaderboards"}
        </button>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-white/60">
          <Clock size={12} />
          <span>Cron automático: 01:00, 17:00, 19:00 y 22:00 hs</span>
        </div>
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <AdminUsers users={users} setUsers={setUsers} currentUser={currentUser} />
      )}

      {/* Fantasy Admin Tab */}
      {tab === "fantasy" && <AdminFantasy />}

      {/* Admin System (Scoring, Sync, Sportmonks tabs content routing happens inside) */}
      <AdminSystem
        tab={tab}
        scoringConfig={scoringConfig}
        onConfigUpdate={loadData}
        fetchCompetitions={fetchCompetitions}
      />
    </div>
  );
}
