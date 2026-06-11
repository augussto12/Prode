import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Trophy,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Loader2,
  Edit3,
  X,
  Activity,
} from "lucide-react";
import api from "../../services/api";
import useToastStore from "../../store/toastStore";

export default function AdminGroups() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loadingDiag, setLoadingDiag] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, member: null, newPoints: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      const { data } = await api.get("/admin/scoring/diagnostics");
      setDiagnostics(data);
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: "Error al cargar diagnóstico" });
    } finally {
      setLoadingDiag(false);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const { data } = await api.get("/admin/groups");
      setGroups(data);
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: "Error al cargar grupos" });
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
    loadGroups();
  }, [loadDiagnostics, loadGroups]);

  const openGroup = async (groupId) => {
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/admin/groups/${groupId}`);
      setSelectedGroup(data);
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: "Error al cargar grupo" });
    } finally {
      setLoadingDetail(false);
    }
  };

  const openEditModal = (member) => {
    setEditModal({
      open: true,
      member: {
        userId: member.user.id,
        groupId: selectedGroup.id,
        displayName: member.user.displayName,
        username: member.user.username,
        currentPoints: member.totalPoints,
      },
      newPoints: String(member.totalPoints),
      reason: "",
    });
  };

  const handleSavePoints = async () => {
    const pts = parseInt(editModal.newPoints, 10);
    if (isNaN(pts) || pts < 0) {
      useToastStore.getState().addToast({ type: "error", message: "Ingresá un número válido mayor o igual a 0" });
      return;
    }
    setSaving(true);
    try {
      await api.put(
        `/admin/groups/${editModal.member.groupId}/members/${editModal.member.userId}/points`,
        { totalPoints: pts }
      );
      useToastStore.getState().addToast({
        type: "success",
        message: `Puntos de ${editModal.member.displayName} actualizados a ${pts}`,
      });
      setEditModal({ open: false, member: null, newPoints: "", reason: "" });
      // Refrescar detalle del grupo
      const { data } = await api.get(`/admin/groups/${editModal.member.groupId}`);
      setSelectedGroup(data);
      // Refrescar lista de grupos para que se vea el nuevo top scorer
      loadGroups();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al ajustar puntos",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  };

  const cronStatusColor = (status) => {
    if (status === "success") return "text-emerald-400";
    if (status === "error") return "text-red-400";
    return "text-amber-400";
  };

  const cronStatusIcon = (status) => {
    if (status === "success") return <CheckCircle size={12} className="shrink-0 text-emerald-400" />;
    if (status === "error") return <AlertCircle size={12} className="shrink-0 text-red-400" />;
    return <AlertTriangle size={12} className="shrink-0 text-amber-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Diagnostics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Activity size={14} /> Diagnóstico de scoring
          </h2>
          <button
            onClick={() => { loadDiagnostics(); loadGroups(); }}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 bg-transparent border-none cursor-pointer"
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>

        {loadingDiag ? (
          <div className="flex items-center gap-2 text-white/40 text-xs py-4">
            <Loader2 size={14} className="animate-spin" /> Cargando...
          </div>
        ) : diagnostics ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                value={diagnostics.predictions.pending}
                label="Predicciones pendientes"
                color={diagnostics.predictions.pending > 0 ? "amber" : "emerald"}
              />
              <StatCard
                value={diagnostics.predictions.calculated}
                label="Predicciones calculadas"
                color="blue"
              />
              <StatCard
                value={diagnostics.groups}
                label="Grupos totales"
                color="indigo"
              />
              <StatCard
                value={diagnostics.activeMembers}
                label="Miembros activos"
                color="violet"
              />
            </div>

            {/* Recent cron runs */}
            {diagnostics.recentCrons?.length > 0 && (
              <div className="glass-card rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Últimas ejecuciones del scoring
                </h3>
                <div className="space-y-1.5">
                  {diagnostics.recentCrons.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2.5 rounded-lg p-2.5 text-xs ${
                        log.status === "error"
                          ? "bg-red-500/10 border border-red-500/20"
                          : log.status === "warning"
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "bg-white/[0.03]"
                      }`}
                    >
                      {cronStatusIcon(log.status)}
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${cronStatusColor(log.status)}`}>
                          {log.jobName}
                        </span>
                        <span className="text-white/40 mx-1.5">·</span>
                        <span className="text-white/60 break-all">{log.message}</span>
                        {log.metadata?.errors?.length > 0 && (
                          <div className="mt-1 text-red-400/80">
                            {log.metadata.errors.slice(0, 2).map((e, i) => (
                              <div key={i} className="truncate">{e}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-white/30 shrink-0 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Groups list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <Users size={14} /> Grupos ({groups.length})
        </h2>

        {loadingGroups ? (
          <div className="flex items-center gap-2 text-white/40 text-xs py-4">
            <Loader2 size={14} className="animate-spin" /> Cargando grupos...
          </div>
        ) : groups.length === 0 ? (
          <div className="text-white/40 text-sm py-6 text-center">No hay grupos creados</div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const isOpen = selectedGroup?.id === group.id;
              return (
                <div key={group.id} className="glass-card rounded-xl overflow-hidden">
                  {/* Group row */}
                  <button
                    onClick={() => openGroup(group.id)}
                    className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-white/[0.03] transition-colors bg-transparent border-none cursor-pointer"
                  >
                    {isOpen ? (
                      <ChevronDown size={16} className="text-white/40 shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-white/40 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{group.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          {group.competition?.name || `comp ${group.competition?.id}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <Users size={10} /> {group.memberCount}
                        </span>
                        {group.topScorer && (
                          <span className="text-xs text-white/40 flex items-center gap-1">
                            <Trophy size={10} className="text-amber-400" />
                            {group.topScorer.displayName}
                            <span className="text-amber-400 font-bold">{group.topScorer.totalPoints} pts</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] text-white/30 shrink-0">{formatDate(group.createdAt)}</span>
                  </button>

                  {/* Group detail (expanded) */}
                  {isOpen && (
                    <div className="border-t border-white/5 px-3 sm:px-4 pb-4 pt-3">
                      {loadingDetail && !selectedGroup ? (
                        <div className="flex items-center gap-2 text-white/40 text-xs py-3">
                          <Loader2 size={13} className="animate-spin" /> Cargando leaderboard...
                        </div>
                      ) : selectedGroup?.id === group.id ? (
                        <GroupLeaderboard
                          group={selectedGroup}
                          onEditPoints={openEditModal}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Points Modal */}
      {editModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div className="glass-card rounded-2xl p-5 sm:p-6 w-full max-w-sm border border-amber-500/30 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Ajustar puntos</h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    {editModal.member?.displayName}{" "}
                    <span className="text-white/30">@{editModal.member?.username}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModal({ open: false, member: null, newPoints: "", reason: "" })}
                className="text-white/40 hover:text-white/70 bg-transparent border-none cursor-pointer p-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* Warning */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <p className="text-xs text-amber-300 leading-relaxed">
                Esto sobreescribe <strong>solo el leaderboard de este grupo</strong>.
                El próximo recálculo automático de leaderboards volverá a calcular desde las predicciones reales.
                Usá esto solo para correcciones puntuales.
              </p>
            </div>

            {/* Current pts */}
            <div>
              <p className="text-xs text-white/50 mb-1">Puntos actuales en este grupo</p>
              <p className="text-3xl font-black text-white">{editModal.member?.currentPoints}</p>
            </div>

            {/* New pts input */}
            <div>
              <label className="block text-xs text-white/60 mb-2 font-medium">Nuevos puntos</label>
              <input
                type="number"
                min="0"
                value={editModal.newPoints}
                onChange={(e) => setEditModal((p) => ({ ...p, newPoints: e.target.value }))}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-xl font-bold focus:outline-none focus:border-amber-500/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs text-white/60 mb-2 font-medium">Motivo (opcional)</label>
              <input
                type="text"
                value={editModal.reason}
                onChange={(e) => setEditModal((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Ej: Corrección por error en partido X"
                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/25"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setEditModal({ open: false, member: null, newPoints: "", reason: "" })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white text-sm font-medium bg-transparent cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePoints}
                disabled={
                  saving ||
                  editModal.newPoints === "" ||
                  parseInt(editModal.newPoints, 10) === editModal.member?.currentPoints
                }
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold cursor-pointer border-none disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {saving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupLeaderboard({ group, onEditPoints }) {
  const activeMemberships = group.groupUsers?.filter((m) => !m.isBanned) ?? [];

  if (activeMemberships.length === 0) {
    return <p className="text-xs text-white/40 py-2">Sin miembros activos</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
        Leaderboard — {activeMemberships.length} miembro{activeMemberships.length !== 1 ? "s" : ""}
      </p>
      {activeMemberships.map((m, i) => (
        <div
          key={m.id}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
        >
          <span className="text-xs text-white/30 w-5 text-right shrink-0">{i + 1}</span>

          {m.user.avatar ? (
            <img
              src={m.user.avatar}
              alt=""
              className="w-6 h-6 rounded-full object-cover shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-[9px] text-white/50 font-bold">
                {m.user.displayName?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-white truncate">{m.user.displayName}</span>
            {m.isAdmin && (
              <span className="ml-1.5 text-[9px] text-amber-400/70 font-medium">admin</span>
            )}
          </div>

          <span className="text-sm font-black text-white shrink-0">{m.totalPoints}</span>
          <span className="text-[10px] text-white/30 shrink-0">pts</span>

          <button
            onClick={() => onEditPoints(m)}
            className="ml-1 p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 bg-transparent border-none cursor-pointer transition-colors"
            title="Ajustar puntos"
          >
            <Edit3 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function StatCard({ value, label, color }) {
  const colorMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  };

  return (
    <div className={`rounded-xl p-3 sm:p-4 border text-center ${colorMap[color] ?? colorMap.blue}`}>
      <div className="text-2xl sm:text-3xl font-black">{value ?? "—"}</div>
      <div className="text-[10px] sm:text-xs text-white/50 mt-1 leading-tight">{label}</div>
    </div>
  );
}
