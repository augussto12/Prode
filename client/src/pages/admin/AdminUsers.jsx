import React from "react";
import { m } from "framer-motion";
import { Trash2 } from "lucide-react";
import useToastStore from "../../store/toastStore";
import api from "../../services/api";

export default function AdminUsers({ users, setUsers, currentUser }) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-white">
          {users.length} usuarios registrados
        </h2>
      </div>

      {users.map((u) => {
        const isMe = u.id === currentUser?.id;
        return (
          <m.div
            key={u.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${isMe ? "border border-indigo-500/30" : ""}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Avatar */}
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${
                  u.role === "SUPERADMIN"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : u.role === "ADMIN"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-white/10 text-white/60 border-white/20"
                }`}
              >
                {u.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-medium text-white truncate">
                    {u.displayName}
                  </span>
                  <span className="text-[10px] sm:text-xs text-white/60">
                    @{u.username}
                  </span>
                  {isMe && (
                    <span className="px-1 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[9px] sm:text-[10px] font-semibold">
                      TÚ
                    </span>
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 truncate">
                  {u.email} •{" "}
                  {new Date(u.createdAt).toLocaleDateString("es-AR")}
                </div>
              </div>
            </div>

            {/* Role Selector */}
            {!isMe ? (
              <div className="flex items-center gap-2 ml-12 sm:ml-0">
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium text-white cursor-pointer focus:outline-none focus:border-indigo-500 appearance-none"
                  style={{ backgroundImage: "none" }}
                >
                  <option value="PLAYER" className="bg-slate-800">
                    PLAYER
                  </option>
                  <option value="ADMIN" className="bg-slate-800">
                    ADMIN
                  </option>
                  <option value="SUPERADMIN" className="bg-slate-800">
                    SUPERADMIN
                  </option>
                </select>
                <button
                  onClick={() => handleDeleteUser(u.id, u.displayName)}
                  className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all bg-transparent border-none cursor-pointer"
                  title="Eliminar usuario"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <span
                className={`ml-12 sm:ml-0 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                  u.role === "SUPERADMIN"
                    ? "bg-red-500/20 text-red-400"
                    : u.role === "ADMIN"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-white/10 text-white/50"
                }`}
              >
                {u.role}
              </span>
            )}
          </m.div>
        );
      })}
    </div>
  );
}
