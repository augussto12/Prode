import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { m } from "framer-motion";
import useAuthStore from "../store/authStore";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verificando tu email...");
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("El link no tiene token de verificacion.");
      return;
    }

    verifyEmail(token)
      .then((result) => {
        setStatus("success");
        setMessage(result.message || "Email verificado correctamente.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err.response?.data?.error ||
            "No pudimos verificar el email. El link puede haber vencido.",
        );
      });
  }, [searchParams, verifyEmail]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[15%] left-[20%] w-[520px] h-[520px] bg-emerald-600/20 rounded-full blur-[130px] mix-blend-screen" />
        <div className="absolute bottom-[12%] right-[18%] w-[580px] h-[580px] bg-indigo-600/20 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      <m.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-5">
          {status === "loading" && <Loader2 size={32} className="text-indigo-200 animate-spin" />}
          {status === "success" && <CheckCircle2 size={34} className="text-emerald-300" />}
          {status === "error" && <XCircle size={34} className="text-red-300" />}
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">
          {status === "success" ? "Cuenta activada" : "Verificacion de email"}
        </h1>
        <p className="text-sm text-white/65 leading-6 mb-6">{message}</p>

        {status === "success" ? (
          <button
            type="button"
            onClick={() => navigate("/explorar")}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 cursor-pointer border-none shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
            }}
          >
            Entrar al prode
          </button>
        ) : (
          <Link
            to="/login"
            className="inline-flex text-indigo-300 hover:text-indigo-200 no-underline text-sm font-medium"
          >
            Volver a ingresar
          </Link>
        )}
      </m.div>
    </div>
  );
}
