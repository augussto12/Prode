import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Mail } from "lucide-react";
import { m } from "framer-motion";
import useAuthStore from "../store/authStore";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await forgotPassword(email);
      setMessage(result.message || "Si el email existe, te enviamos un link.");
      setDevResetUrl(result.devResetUrl || "");
    } catch {
      // authStore exposes the error message for the form.
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[10%] left-[20%] w-[520px] h-[520px] bg-indigo-600/20 rounded-full blur-[130px] mix-blend-screen" />
        <div className="absolute bottom-[12%] right-[20%] w-[620px] h-[620px] bg-purple-600/20 rounded-full blur-[150px] mix-blend-screen" />
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
            Recuperar contrasena
          </h1>
          <p className="text-white/60 text-sm">
            Te enviamos un link seguro para crear una nueva.
          </p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
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
            {devResetUrl && (
              <a
                href={devResetUrl}
                className="block bg-amber-500/10 border border-amber-500/30 text-amber-100 px-4 py-3 rounded-xl text-sm no-underline text-center"
              >
                Link local para cambiar contrasena
              </a>
            )}

            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm pr-12"
                />
                <Mail
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45"
                />
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
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-indigo-300 hover:text-indigo-200 no-underline text-sm font-medium"
            >
              Volver a ingresar
            </Link>
          </div>
        </div>
      </m.div>
    </div>
  );
}
