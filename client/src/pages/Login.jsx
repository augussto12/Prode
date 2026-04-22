import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, LogIn, Eye, EyeOff } from "lucide-react";
import { m } from "framer-motion";
import useAuthStore from "../store/authStore";

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const doLogin = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await doLogin(login, password);
      navigate("/explorar");
    } catch (err) {
      // error is set in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#0a0a0a]">
      {/* Background Elements (Optimized) */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[800px] h-[300px] bg-amber-500/10 rounded-[100%] blur-[100px] mix-blend-screen" />
      </div>

      <m.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
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
            {/* Shimmer effect on logo */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <Trophy size={48} className="text-white relative z-10" />
          </m.div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-purple-300 mb-2 tracking-tight">
            Prode Mundial
          </h1>
          <p className="text-white/60 text-base font-medium">
            El estadio virtual para tus pronósticos
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* subtle inside glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <m.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm"
              >
                {error}
              </m.div>
            )}

            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Email o Usuario
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="tu@email.com o tu_usuario"
                required
                autoComplete="username"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer border-none shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={18} /> Ingresar
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/60">
            ¿No tenés cuenta?{" "}
            <Link
              to="/register"
              className="text-indigo-400 hover:text-indigo-300 no-underline font-medium"
            >
              Registrate
            </Link>
          </div>

          <div className="mt-3 text-center">
            <Link
              to="/explorar"
              className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/60 no-underline transition-colors"
            >
              ← Explorar sin cuenta
            </Link>
          </div>
        </div>
      </m.div>
    </div>
  );
}
