import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, UserPlus, Eye, EyeOff } from "lucide-react";
import { m } from "framer-motion";
import useAuthStore from "../store/authStore";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    displayName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const doRegister = useAuthStore((state) => state.register);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await doRegister(
        form.email,
        form.username,
        form.password,
        form.displayName,
      );
      navigate("/explorar");
    } catch (err) {}
  };

  const update = (field) => (e) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#0a0a0a]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <m.div
          animate={{ x: [-20, 20, -20], y: [-20, 20, -20], rotate: [0, 90, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[120px] mix-blend-screen"
        />
        <m.div
          animate={{ x: [20, -20, 20], y: [20, -20, 20], rotate: [0, -90, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[150px] mix-blend-screen"
        />
      </div>

      <m.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <m.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.5)] border border-white/20 backdrop-blur-md relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.8))",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <Trophy size={48} className="text-white relative z-10" />
          </m.div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-purple-300 mb-2 tracking-tight">
            Crear Cuenta
          </h1>
          <p className="text-white/60 text-base font-medium">
            Unite al Prode Mundial 2026
          </p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Nombre para mostrar
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={update("displayName")}
                placeholder="Ej: Juan Pérez"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={update("email")}
                placeholder="tu@email.com"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={form.username}
                onChange={update("username")}
                placeholder="juanperez"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/70 bg-transparent border-none cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer border-none shadow-lg mt-2"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                  Creando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus size={18} /> Crear Cuenta
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/60">
            ¿Ya tenés cuenta?{" "}
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 no-underline font-medium"
            >
              Ingresá
            </Link>
          </div>
        </div>
      </m.div>
    </div>
  );
}
