import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { m } from "framer-motion";
import useAuthStore from "../store/authStore";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const token = searchParams.get("token") || "";
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await resetPassword(token, password);
      setMessage(result.message || "Contrasena actualizada.");
      window.setTimeout(() => navigate("/login"), 900);
    } catch {
      // authStore exposes the error message for the form.
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[12%] left-[18%] w-[520px] h-[520px] bg-indigo-600/20 rounded-full blur-[130px] mix-blend-screen" />
        <div className="absolute bottom-[10%] right-[18%] w-[620px] h-[620px] bg-emerald-600/15 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      <m.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 shadow-[0_0_34px_rgba(99,102,241,0.4)] border border-white/20 bg-indigo-500/30">
            <KeyRound size={38} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            Nueva contrasena
          </h1>
          <p className="text-white/60 text-sm">
            Elegi una clave nueva para volver a entrar.
          </p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {!token ? (
            <div className="space-y-5 text-center">
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                El link no tiene token de recuperacion.
              </div>
              <Link
                to="/forgot-password"
                className="text-indigo-300 hover:text-indigo-200 no-underline text-sm font-medium"
              >
                Pedir otro link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {message && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-xl text-sm">
                  {message}
                </div>
              )}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Contrasena
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
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
                    "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
                }}
              >
                {loading ? "Guardando..." : "Guardar contrasena"}
              </button>
            </form>
          )}
        </div>
      </m.div>
    </div>
  );
}
