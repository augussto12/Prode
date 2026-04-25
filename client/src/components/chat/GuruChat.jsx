import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, User as UserIcon } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import useAuthStore from "../../store/authStore";

export default function GuruChat() {
  const user = useAuthStore((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "guru",
      text: "¿Qué onda genio? Soy el Gurú Colorado. Decime qué andás necesitando saber de tu prode.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!user) return null; // Ocultar el Guru a visitantes no autenticados (Guest Mode)

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    const newMessages = [...messages, { role: "user", text: userMsg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Mandamos solo la conversacion al backend
      const { data } = await api.post("/guru/ask", { history: newMessages });
      setMessages([...newMessages, { role: "guru", text: data.text }]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        {
          role: "guru",
          text: "Me parece que el Admin no me pagó la API Key, no te puedo contestar ahora.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón Flotante */}
      <AnimatePresence>
        {!isOpen && (
          <m.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            aria-label="Abrir chat del Gurú"
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-rose-600 hover:bg-rose-500 rounded-full flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(225,29,72,0.6)] z-50 transition-colors border-none group"
          >
            <Bot
              className="w-6 h-6 sm:w-7 sm:h-7 text-white group-hover:animate-bounce"
              aria-hidden="true"
            />
            {/* Indicador de badge opcional */}
            <span className="absolute top-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full border-2 border-rose-600 animate-pulse"></span>
          </m.button>
        )}
      </AnimatePresence>

      {/* Ventana de Chat */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 w-full sm:w-[350px] h-full sm:h-[500px] z-50 sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl border-none sm:border sm:border-rose-500/30"
            style={{
              background: "linear-gradient(to bottom, #171717, #0a0a0a)",
            }}
          >
            {/* Header */}
            <div className="bg-rose-600 p-4 flex items-center justify-between shadow-md relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm m-0">
                    El Gurú Colorado
                  </h3>
                  <p className="text-rose-200 text-xs m-0 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>{" "}
                    En línea
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar chat"
                className="text-white/80 hover:text-white bg-transparent border-none cursor-pointer"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-rose-500/30">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 flex flex-col gap-1 text-sm ${
                      m.role === "user"
                        ? "bg-white/10 text-white rounded-br-none"
                        : "bg-rose-600/20 border border-rose-500/20 text-rose-100 rounded-bl-none"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                      {m.role === "user" ? "Vos" : "Gurú"}
                    </span>
                    {m.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-rose-600/20 border border-rose-500/20 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1 items-center">
                    <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input Area */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-black/40 border-t border-rose-500/20 flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Preguntale cómo venís..."
                className="flex-1 bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500/50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Enviar mensaje"
                className="w-10 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center border-none cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
