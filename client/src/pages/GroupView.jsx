import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import {
  Share2,
  Check,
  Users,
  Settings,
  LogOut,
  Trophy,
  Trash2,
  ShieldBan,
  ShieldCheck,
  Loader2,
  Edit3,
  X,
  Calendar,
  RotateCcw,
  UserPlus,
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Zap,
} from "lucide-react";
import useAuthStore from "../store/authStore";

import api from "../services/api";
import useToastStore from "../store/toastStore";
import GroupChat from "../components/chat/GroupChat";
import GroupMatches from "../components/matches/GroupMatches";
import { getLeagueLogo, getLeagueName } from "../utils/worldCupLogo";

function formatActivityTime(createdAt) {
  if (!createdAt) return "";
  return new Date(createdAt)
    .toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase();
}

function getActivityDayKey(createdAt) {
  const date = new Date(createdAt);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatActivityDay(createdAt) {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dayKey = getActivityDayKey(createdAt);
  if (dayKey === getActivityDayKey(today)) return "Hoy";
  if (dayKey === getActivityDayKey(yesterday)) return "Ayer";

  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function groupActivityByDay(activity) {
  const groups = [];
  const groupsByKey = new Map();

  activity.forEach((item) => {
    if (!item.createdAt) return;

    const dayKey = getActivityDayKey(item.createdAt);
    if (!groupsByKey.has(dayKey)) {
      const group = {
        key: dayKey,
        label: formatActivityDay(item.createdAt),
        items: [],
      };
      groupsByKey.set(dayKey, group);
      groups.push(group);
    }

    groupsByKey.get(dayKey).items.push(item);
  });

  return groups;
}

function RankMovement({ value }) {
  if (!value) return null;

  const isUp = value > 0;
  const Icon = isUp ? ArrowUp : ArrowDown;

  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ color: isUp ? "#6ee7b7" : "#f87171" }}
      title={isUp ? "Subio en la tabla" : "Bajo en la tabla"}
      aria-label={isUp ? "Subio en la tabla" : "Bajo en la tabla"}
    >
      <Icon size={12} strokeWidth={3} />
    </span>
  );
}

function GroupActivityFeed({ activity }) {
  const [activityFilter, setActivityFilter] = useState("all");
  const filteredActivity = activity.filter((item) => {
    if (activityFilter === "exact") return item.type?.includes("exact");
    if (activityFilter === "joker") return item.type?.includes("joker");
    return true;
  });
  const activityGroups = groupActivityByDay(filteredActivity);
  const filters = [
    { id: "all", label: "Todo", icon: Activity },
    { id: "exact", label: "Exactos", icon: Check },
    { id: "joker", label: "Comodin", icon: Zap },
  ];

  return (
    <m.div
      key="activity"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activityFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActivityFilter(filter.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                isActive
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80"
              }`}
            >
              <Icon size={13} />
              {filter.label}
            </button>
          );
        })}
      </div>

      {activityGroups.length === 0 ? (
        <div className="py-12 text-center text-white/60 glass-card rounded-xl">
          <Activity size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {activity.length === 0
              ? "Todavia no hay actividad calculada"
              : "No hay actividad para este filtro"}
          </p>
        </div>
      ) : (
        activityGroups.map((group) => (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-white/10" />
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 border border-white/5"
                >
                  <div className="mt-0.5 w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-300 flex items-center justify-center shrink-0">
                    <Zap size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-white/85 leading-snug">
                      <span className="font-bold text-white">{item.user.displayName}</span>{" "}
                      {item.title} en{" "}
                      <span className="font-semibold text-white/90">{item.fixture.label}</span>
                      {item.pointsEarned > 0 && (
                        <span className="text-emerald-300 font-bold"> +{item.pointsEarned} pts</span>
                      )}
                    </p>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {formatActivityTime(item.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </m.div>
  );
}

function getRankColor(rank, totalEntries) {
  if (totalEntries > 1 && rank === totalEntries) return "#f87171";
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#e5e7eb";
  return "rgba(255, 255, 255, 0.52)";
}

function getActivityTabLabel(activity) {
  if (activity.length === 0) return "Actividad";
  return `Actividad (${activity.length})`;
}

export default function GroupView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [group, setGroup] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activity, setActivity] = useState([]);
  const [bannedList, setBannedList] = useState([]);
  const [inviteList, setInviteList] = useState([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [isAddingInvite, setIsAddingInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    joinPolicy: "OPEN_WITH_CODE",
  });

  useEffect(() => {
    loadGroup();
  }, [id]);

  const loadGroup = async () => {
    try {
      const { data: gData } = await api.get(`/groups/${id}`);
      setGroup(gData);
      const [{ data: lbData }, activityRes] = await Promise.all([
        api.get(`/groups/${id}/leaderboard`),
        api.get(`/groups/${id}/activity`).catch(() => ({ data: [] })),
      ]);
      setLeaderboard(lbData);
      setActivity(activityRes.data || []);

      // Load banned list if admin
      if (gData.isAdmin) {
        try {
          const { data: bData } = await api.get(`/groups/${id}/banned`);
          setBannedList(bData);
        } catch (e) {
          /* silently fail for non-admins */
        }

        try {
          const { data: inviteData } = await api.get(`/groups/${id}/invites`);
          setInviteList(inviteData);
        } catch (e) {
          /* silently fail while DB migrations are pending */
        }
      }
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        navigate("/groups");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    useToastStore.getState().askConfirm({
      title: "Abandonar grupo",
      message:
        "¿Seguro quieres salir? Tus puntajes dejarán de ser visibles aquí.",
      confirmText: "Salir",
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}/leave`);
          navigate("/groups");
          useToastStore
            .getState()
            .addToast({ type: "info", message: "Has abandonado el grupo" });
        } catch (err) {
          useToastStore
            .getState()
            .addToast({
              type: "error",
              message: err.response?.data?.error || "Error",
            });
        }
      },
    });
  };

  const handleKick = async (userIdToKick) => {
    useToastStore.getState().askConfirm({
      title: "Banear Miembro",
      message:
        "El usuario será baneado del grupo y no podrá volver a unirse hasta que lo desbanees.",
      confirmText: "Banear",
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}/members/${userIdToKick}`);
          loadGroup();
          useToastStore
            .getState()
            .addToast({
              type: "success",
              message: "Miembro baneado del grupo",
            });
        } catch (err) {
          useToastStore
            .getState()
            .addToast({
              type: "error",
              message: err.response?.data?.error || "Error al banear",
            });
        }
      },
    });
  };

  const handleUnban = async (userIdToUnban) => {
    useToastStore.getState().askConfirm({
      title: "Desbanear Miembro",
      message:
        "El usuario podrá volver a unirse al grupo con el código de invitación.",
      confirmText: "Desbanear",
      onConfirm: async () => {
        try {
          await api.post(`/groups/${id}/unban/${userIdToUnban}`);
          loadGroup();
          useToastStore
            .getState()
            .addToast({ type: "success", message: "Miembro desbaneado" });
        } catch (err) {
          useToastStore
            .getState()
            .addToast({
              type: "error",
              message: err.response?.data?.error || "Error",
            });
        }
      },
    });
  };

  const handleDelete = async () => {
    useToastStore.getState().askConfirm({
      title: "Eliminar Grupo",
      message:
        "Esta acción es irreversible y eliminará a todos los miembros y chats. ¿Borrar?",
      confirmText: "Eliminar",
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}`);
          navigate("/groups");
          useToastStore
            .getState()
            .addToast({ type: "success", message: "Grupo eliminado" });
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

  const handleResetScores = async () => {
    useToastStore.getState().askConfirm({
      title: "Reiniciar Puntajes",
      message:
        "Esto pondrá TODOS los puntajes del grupo en 0 y las predicciones se volverán a calcular en el próximo ciclo. \u00bfEstás seguro?",
      confirmText: "Reiniciar",
      onConfirm: async () => {
        try {
          const { data } = await api.post(`/groups/${id}/reset-scores`);
          loadGroup();
          useToastStore
            .getState()
            .addToast({ type: "success", message: data.message });
        } catch (err) {
          useToastStore
            .getState()
            .addToast({
              type: "error",
              message: err.response?.data?.error || "Error al reiniciar puntajes",
            });
        }
      },
    });
  };

  const handleAddInvite = async (e) => {
    e.preventDefault();
    const username = inviteUsername.trim();
    if (!username) return;

    setIsAddingInvite(true);
    try {
      const { data } = await api.post(`/groups/${id}/invites`, { username });
      setInviteList((prev) => {
        const others = prev.filter((invite) => invite.id !== data.id);
        return [data, ...others];
      });
      setInviteUsername("");
      useToastStore
        .getState()
        .addToast({ type: "success", message: "Usuario habilitado" });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al habilitar usuario",
        });
    } finally {
      setIsAddingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      await api.delete(`/groups/${id}/invites/${inviteId}`);
      setInviteList((prev) => prev.filter((invite) => invite.id !== inviteId));
      useToastStore
        .getState()
        .addToast({ type: "success", message: "Invitacion revocada" });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al revocar invitacion",
        });
    }
  };

  const openEditModal = () => {
    setEditForm({
      name: group.name || "",
      description: group.description || "",
      joinPolicy: group.joinPolicy || "OPEN_WITH_CODE",
    });
    setShowEditModal(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put(`/groups/${id}/theme`, editForm);
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: "Grupo actualizado correctamente",
        });
      setShowEditModal(false);
      loadGroup(); // reload
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al actualizar grupo",
        });
    } finally {
      setIsSaving(false);
    }
  };

  const copyCode = async () => {
    const code = group.inviteCode;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for non-HTTPS (e.g. localhost)
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: "Código copiado al portapapeles",
        });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      useToastStore
        .getState()
        .addToast({ type: "error", message: "No se pudo copiar el código" });
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
        <span className="text-white/50 text-sm">
          Cargando datos del grupo...
        </span>
      </div>
    );
  if (!group) return null;
  const competitionName = group.competition
    ? getLeagueName(group.competition)
    : "";
  const competitionLogo = group.competition
    ? getLeagueLogo(group.competition)
    : null;
  const leaderboardPending = leaderboard.some((entry) => entry.leaderboardPending);

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        {/* Dynamic Background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)`,
          }}
        />

        <div className="relative z-10 space-y-4 sm:space-y-5">
          {/* Group Name + Meta */}
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
              {group.name}
            </h1>
            {group.description && (
              <p className="text-white/60 text-xs sm:text-sm max-w-xl">
                {group.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs sm:text-sm">
              {group.competition && (
                <span className="flex items-center gap-1.5 text-white/80 bg-white/5 px-2.5 py-1 rounded-full">
                  {competitionLogo && (
                    <img
                      src={competitionLogo}
                      alt=""
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      
  onError={(e) => {
                        e.target.src = "/placeholder-team.svg";
                      }}
                    />
                  )}
                  <span className="truncate max-w-[120px] sm:max-w-none">
                    {competitionName}
                  </span>
                </span>
              )}
              <span className="flex items-center gap-1.5 text-white/80 bg-white/5 px-2.5 py-1 rounded-full">
                <Users size={14} /> {group.memberCount} miembros
              </span>
              {group.isAdmin && (
                <span className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full font-medium">
                  <Settings size={14} /> Admin
                </span>
              )}
              <span className="flex items-center gap-1.5 text-white/80 bg-white/5 px-2.5 py-1 rounded-full">
                <UserPlus size={14} />
                {group.joinPolicy === "INVITE_ONLY"
                  ? "Solo invitacion"
                  : group.joinPolicy === "WHITELIST_WITH_CODE"
                    ? "Whitelist + codigo"
                    : "Codigo abierto"}
              </span>
            </div>
          </div>

          {/* Invite Code Bar */}
          <div
            className="flex items-center gap-2 bg-black/30 rounded-xl p-2.5 sm:p-3"
            style={{ borderWidth: 1, borderStyle: "solid", borderColor: "color-mix(in srgb, var(--color-secondary) 25%, transparent)" }}
          >
            <span className="text-[10px] sm:text-xs text-white/60 uppercase tracking-wider font-semibold shrink-0">
              Código
            </span>
            <span className="font-mono text-xs sm:text-sm text-white/80 font-bold tracking-wider truncate flex-1 bg-white/5 px-2 py-1 rounded select-all">
              {group.inviteCode}
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/15 hover:bg-indigo-500/25 rounded-lg transition-colors cursor-pointer border-none shrink-0"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" /> Copiado
                </>
              ) : (
                <>
                  <Share2 size={14} /> Copiar
                </>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {group.isAdmin && (
              <>
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 rounded-xl font-bold transition-all border border-indigo-500/20 cursor-pointer text-xs sm:text-sm"
                >
                  <Edit3 size={14} /> Editar
                </button>
                <button
                  onClick={handleResetScores}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl font-medium transition-all border border-amber-500/20 cursor-pointer text-xs sm:text-sm"
                >
                  <RotateCcw size={14} /> Reiniciar Puntos
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-all border border-red-500/20 cursor-pointer text-xs sm:text-sm"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </>
            )}
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white/60 text-xs sm:text-sm font-medium hover:text-red-400 hover:bg-red-400/10 transition-colors border-none bg-transparent cursor-pointer ml-auto"
            >
              <LogOut size={14} /> Salir del grupo
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6 relative items-start">
        {/* CHAT (Renderizado primero para mobile sticky preview, reordenado con grid en desktop) */}
        <div className="w-full lg:col-span-4 xl:col-span-3 lg:col-start-9 xl:col-start-10 lg:row-start-1 lg:h-[calc(100vh-180px)] lg:sticky lg:top-24 sticky top-14 z-[45]">
          <GroupChat
            groupId={Number(id)}
            initialMessages={group.messages || []}
          />
        </div>

        {/* LEADERBOARD / PREDICTIONS / BANNED */}
        <div className="w-full lg:col-span-8 xl:col-span-9 lg:col-start-1 lg:row-start-1 space-y-4 min-w-0">
          {/* Tabs — horizontal scroll on mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "leaderboard"
                  ? "bg-white/10 text-white shadow-sm"
                  : "bg-transparent text-white/60 hover:text-white/60"
              }`}
              style={
                activeTab === "leaderboard"
                  ? { borderBottom: "2px solid var(--color-secondary)" }
                  : {}
              }
            >
              <Trophy size={14} /> Posiciones
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "activity"
                  ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                  : "bg-transparent text-white/60 hover:text-white/60"
              }`}
              style={
                activeTab === "activity"
                  ? { borderBottom: "2px solid var(--color-secondary)" }
                  : {}
              }
            >
              <Activity size={14} /> {getActivityTabLabel(activity)}
            </button>
            <button
              onClick={() => setActiveTab("matches")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "matches"
                  ? "bg-indigo-500/20 text-indigo-300 shadow-sm"
                  : "bg-transparent text-white/60 hover:text-white/60"
              }`}
              style={
                activeTab === "matches"
                  ? { borderBottom: "2px solid var(--color-secondary)" }
                  : {}
              }
            >
              <Calendar size={14} /> Partidos
            </button>
            {group.isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab("invites")}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === "invites"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-transparent text-white/60 hover:text-white/60"
                  }`}
                >
                  <UserPlus size={14} /> Invitados{" "}
                  {inviteList.length > 0 && `(${inviteList.length})`}
                </button>
                <button
                  onClick={() => setActiveTab("banned")}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === "banned"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-transparent text-white/60 hover:text-white/60"
                  }`}
                >
                  <ShieldBan size={14} /> Baneados{" "}
                  {bannedList.length > 0 && `(${bannedList.length})`}
                </button>
              </>
            )}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "leaderboard" && (
              <m.div
                key="leaderboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2 sm:space-y-3"
              >
                {leaderboardPending && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-amber-100">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
                    <p className="text-[11px] sm:text-xs leading-snug text-amber-100/85">
                      Puntos calculados, tabla actualizandose. Las flechas aparecen cuando el ranking termina de sincronizar.
                    </p>
                  </div>
                )}

                {leaderboard.map((entry) => {
                  const isMe = entry.userId === user.id;
                  return (
                    <m.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={entry.userId}
                      className={`flex items-center gap-2.5 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                        isMe
                          ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                          : "bg-white/[0.02] border-white/5"
                      }`}
                    >
                      {/* Rank */}
                      <div
                        className="w-10 sm:w-12 text-center font-bold text-base sm:text-lg shrink-0 flex items-center justify-center gap-0.5"
                      >
                        <span
                          style={{ color: getRankColor(entry.rank, leaderboard.length) }}
                        >
                          #{entry.rank}
                        </span>
                        <RankMovement value={entry.rankMovement} />
                      </div>

                      {/* Avatar */}
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-sm sm:text-base font-bold border border-white/20 shrink-0">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>

                      {/* User */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span
                            className={`text-xs sm:text-sm font-medium truncate ${isMe ? "text-indigo-300" : "text-white"}`}
                          >
                            {entry.displayName}
                          </span>
                          {entry.isAdmin && (
                            <span className="px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px] sm:text-[10px] font-semibold shrink-0">
                              ADMIN
                            </span>
                          )}
                          {isMe && (
                            <span className="px-1 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[9px] sm:text-[10px] font-semibold shrink-0">
                              TÚ
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-xs text-white/60 truncate">
                          @{entry.username}
                        </div>
                      </div>

                      {/* Score & Actions */}
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-center min-w-[48px]">
                          <div className="text-sm sm:text-base font-bold text-emerald-300">
                            {entry.exactHits ?? 0}
                          </div>
                          <div className="text-[8px] sm:text-[10px] text-white/60 uppercase tracking-wider">
                            exactos
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className="text-base sm:text-lg font-bold"
                            style={{ color: "var(--color-accent)" }}
                          >
                            {entry.totalPoints}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-white/60 uppercase tracking-wider">
                            pts
                          </div>
                        </div>

                        {/* Admin Actions */}
                        {group.isAdmin && !isMe && (
                          <button
                            onClick={() => handleKick(entry.userId)}
                            className="p-1 sm:p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all bg-transparent border-none cursor-pointer"
                            title="Banear usuario"
                          >
                            <ShieldBan size={14} />
                          </button>
                        )}
                      </div>
                    </m.div>
                  );
                })}

                {leaderboard.length === 0 && (
                  <div className="py-12 text-center text-white/60 glass-card rounded-xl">
                    <Trophy size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Todavía no hay puntajes</p>
                  </div>
                )}
              </m.div>
            )}

            {activeTab === "activity" && (
              <GroupActivityFeed activity={activity} />
            )}

            {activeTab === "invites" && group.isAdmin && (
              <m.div
                key="invites"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <form
                  onSubmit={handleAddInvite}
                  className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 rounded-xl border border-white/10 bg-white/[0.03]"
                >
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="username"
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isAddingInvite || !inviteUsername.trim()}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs sm:text-sm font-bold border-none cursor-pointer"
                  >
                    {isAddingInvite ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UserPlus size={14} />
                    )}
                    Habilitar
                  </button>
                </form>

                <div className="space-y-2">
                  {inviteList.length === 0 ? (
                    <div className="py-12 text-center text-white/60 glass-card rounded-xl">
                      <UserPlus size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No hay usuarios habilitados</p>
                    </div>
                  ) : (
                    inviteList.map((invite) => (
                      <m.div
                        key={invite.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03]"
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm sm:text-base font-bold border border-emerald-500/20 shrink-0">
                          {invite.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-white truncate">
                            @{invite.username}
                          </div>
                          <div className="text-[10px] sm:text-xs text-white/60 truncate">
                            {invite.status === "ACCEPTED"
                              ? "Ya ingreso al grupo"
                              : "Pendiente"}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] sm:text-xs font-bold hover:bg-red-500/20 transition-colors border-none cursor-pointer shrink-0"
                        >
                          <X size={12} /> Quitar
                        </button>
                      </m.div>
                    ))
                  )}
                </div>
              </m.div>
            )}

            {activeTab === "banned" && group.isAdmin && (
              <m.div
                key="banned"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2 sm:space-y-3"
              >
                {bannedList.length === 0 ? (
                  <div className="py-12 text-center text-white/60 glass-card rounded-xl">
                    <ShieldCheck
                      size={36}
                      className="mx-auto mb-3 opacity-30"
                    />
                    <p className="text-sm">No hay usuarios baneados</p>
                    <p className="text-xs text-white/40 mt-1">
                      Todos en paz ⚽
                    </p>
                  </div>
                ) : (
                  bannedList.map((entry) => (
                    <m.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-red-500/10 bg-red-500/[0.03]"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-sm sm:text-base font-bold border border-red-500/20 shrink-0">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>

                      {/* User */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-medium text-white truncate">
                          {entry.displayName}
                        </div>
                        <div className="text-[10px] sm:text-xs text-white/60 truncate">
                          @{entry.username}
                        </div>
                        <div className="text-[10px] text-red-400/60 mt-0.5">
                          Baneado{" "}
                          {entry.bannedAt
                            ? new Date(entry.bannedAt).toLocaleDateString(
                                "es-AR",
                              )
                            : ""}
                        </div>
                      </div>

                      {/* Unban */}
                      <button
                        onClick={() => handleUnban(entry.userId)}
                        className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] sm:text-xs font-bold hover:bg-emerald-500/20 transition-colors border-none cursor-pointer shrink-0"
                      >
                        <ShieldCheck size={12} /> Desbanear
                      </button>
                    </m.div>
                  ))
                )}
              </m.div>
            )}

            {activeTab === "matches" && (
              <m.div
                key="matches"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="pt-1 sm:pt-2"
              >
                {/* Tournament Header */}
                {group.competition && (
                  <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10">
                    {competitionLogo ? (
                      <img
                        src={competitionLogo}
                        alt={competitionName}
                        width={32}
                        height={32}
                        className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md shrink-0"
                        loading="lazy"
                        decoding="async"
                        
  onError={(e) => {
                          e.target.src = "/placeholder-team.svg";
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-lg sm:text-xl shrink-0">
                        🏆
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] sm:text-xs text-white/60 uppercase tracking-widest font-bold mb-0.5">
                        Torneo Activo
                      </div>
                      <h2 className="text-base sm:text-xl font-black text-white truncate">
                        {competitionName}
                      </h2>
                    </div>
                  </div>
                )}

                <GroupMatches
                  groupId={group.id}
                  groupName={group.name}
                  competitionId={group.competitionId}
                />
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MODAL: EDITAR GRUPO */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl sm:rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden relative my-auto"
          >
            <div className="bg-white/5 p-3 sm:p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-indigo-400" /> Editar Grupo
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white/60 hover:text-white bg-transparent border-none cursor-pointer rounded-full hover:bg-white/10 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleEditSave}
              className="p-4 sm:p-6 space-y-4 sm:space-y-5"
            >
              <div>
                <label className="block text-white/60 text-xs sm:text-sm mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                  className="w-full px-3 sm:px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-white/60 text-xs sm:text-sm mb-1">
                  Descripción
                </label>
                <textarea
                  rows="2"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm resize-none focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-white/60 text-xs sm:text-sm mb-1">
                  Entrada al grupo
                </label>
                <select
                  value={editForm.joinPolicy}
                  onChange={(e) =>
                    setEditForm({ ...editForm, joinPolicy: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="OPEN_WITH_CODE">Cualquiera con codigo</option>
                  <option value="WHITELIST_WITH_CODE">
                    Solo usuarios habilitados + codigo
                  </option>
                  <option value="INVITE_ONLY">Solo invitacion de un uso</option>
                </select>
              </div>

              {Boolean(import.meta.env.VITE_SHOW_LEGACY_PRODE_MARKETS) && (
              <div>
                <label className="block text-white/60 text-xs sm:text-sm mb-2">
                  Módulos de Juego
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: "allowMoreCorners", label: "⛳ Más Córners" },
                    { key: "allowMoreFouls", label: "🦵 Más Faltas" },
                    { key: "allowMoreShots", label: "🎯 Más Remates" },
                    { key: "allowMoreCards", label: "🟨 Más Tarjetas" },
                    { key: "allowMorePossession", label: "⚽ Más Posesión" },
                    { key: "allowMoreOffsides", label: "🏁 Más Offsides" },
                    { key: "allowMoreSaves", label: "🧤 Más Atajadas" },
                  ].map((m) => (
                    <div
                      key={m.key}
                      className="flex items-center justify-between p-2.5 sm:p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          [m.key]: !prev[m.key],
                        }))
                      }
                    >
                      <span className="text-[11px] sm:text-xs text-white/80 font-medium">
                        {m.label}
                      </span>
                      <div
                        className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${editForm[m.key] ? "bg-indigo-500" : "bg-black/60 shadow-inner"}`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full absolute top-[2px] shadow-sm transition-all ${editForm[m.key] ? "left-[18px]" : "left-[2px]"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/60 mt-1.5 ml-1">
                  * El resultado exacto y el equipo ganador siempre son
                  obligatorios.
                </p>
              </div>
              )}



              <div className="flex justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 sm:px-4 py-2 rounded-xl text-white/60 hover:text-white bg-transparent border border-white/10 cursor-pointer text-xs sm:text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 sm:px-6 py-2 rounded-xl text-white font-bold bg-indigo-500 hover:bg-indigo-600 border-none cursor-pointer text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </m.div>
        </div>
      )}
    </div>
  );
}
