import { useState, useEffect, useRef, useTransition } from "react";
import { createPortal } from "react-dom";
import { Send, X } from "lucide-react";
import { getSocket } from "../../lib/socket";
import useAuthStore from "../../store/authStore";

export default function GroupChat({ groupId, initialMessages = [] }) {
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState(initialMessages);
  const [inputVal, setInputVal] = useState("");
  const [connected, setConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useState(false); // Can use React 19 useTransition if preferred but manual wrapper is reliable. Wait, I'll use import { useState, useEffect, useRef, useTransition } from 'react';
  const [isUpdating, startMessageTransition] = useTransition();

  const socketRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    // Scroll chat to bottom without pulling the entire window down
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    // Desconectar socket anterior si existe (previene listeners duplicados)
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Connect to server socket (cookie HttpOnly se envía automáticamente)
    const socket = getSocket();
    socket.connect();

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // Join group room
      socket.emit("join_group", groupId);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("new_message", (msg) => {
      startMessageTransition(() => {
        setMessages((prev) => {
          // Dedup: evita mensajes duplicados por reconexión o re-render
          if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      });
    });

    return () => {
      socket.emit("leave_group", groupId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, groupId]); // user.id es estable, user como objeto no lo es

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    socketRef.current.emit("send_message", {
      groupId,
      content: inputVal,
    });

    setInputVal("");
  };

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <>
      {/* MOBILE STICKY PREVIEW BAR */}
      <div
        onClick={() => setIsOpen(true)}
        className="lg:hidden sticky top-14 left-0 right-0 z-40 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex items-center gap-3 cursor-pointer shadow-lg mb-4"
      >
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
          <span className="text-xl">🗣️</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              Tribuna Chat
            </span>
            <span
              className={`text-[9px] ${connected ? "text-emerald-400" : "text-red-400 animate-pulse"}`}
            >
              {connected ? "● En vivo" : "● Conectando"}
            </span>
          </div>
          {lastMsg ? (
            <p className="text-xs text-white/80 truncate">
              <span className="font-bold text-white opacity-60 mr-1">
                {lastMsg.user.displayName}:
              </span>
              {lastMsg.content}
            </p>
          ) : (
            <p className="text-xs text-white/60 italic">
              Nadie picanteó todavía. Podés ser el primero...
            </p>
          )}
        </div>
      </div>

      {/* CHAT WINDOW (Desktop normal) */}
      <div className="hidden lg:flex flex-col bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden shadow-xl lg:static lg:h-[calc(100vh-180px)] lg:backdrop-blur-md">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-white/90 text-sm">
            Tribuna / Chat
          </h3>
          <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-white/60">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`}
            ></span>
            {connected ? "En vivo" : "Conectando"}
          </span>
        </div>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-white/50 space-y-2">
              <span className="text-3xl">🗣️</span>
              <p className="text-xs">
                No hay mensajes todavía.
                <br />
                ¡Sé el primero en picantarla!
              </p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMe = m.user.id === user.id;
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-white/50 mb-1 ml-1">
                    {isMe ? "Vos" : m.user.displayName}
                    {m.user.role === "ADMIN" && (
                      <span className="ml-1 text-amber-500">★</span>
                    )}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-md ${isMe ? "rounded-br-none text-white" : "bg-white/10 border border-white/5 rounded-bl-none text-white/90"}`}
                    style={
                      isMe
                        ? {
                            background:
                              "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
                          }
                        : {}
                    }
                  >
                    <div>{m.content}</div>
                    <div
                      className={`text-[9px] mt-0.5 text-right ${isMe ? "text-white/70" : "text-white/60"}`}
                    >
                      {m.createdAt
                        ? new Date(m.createdAt)
                            .toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                            .toLowerCase()
                        : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Form */}
        <div className="p-3 bg-white/[0.02] border-t border-white/5">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              placeholder="Escribí un mensaje..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={!connected}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!connected || !inputVal.trim()}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-500 text-white cursor-pointer hover:bg-indigo-400 transition-colors disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* CHAT WINDOW (Mobile modal via Portal) */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col sm:hidden" style={{ background: 'var(--bg-start-color, #0a0f1c)' }}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-indigo-500/20 bg-black/40 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 flex items-center justify-center bg-indigo-500/20 rounded-full border border-indigo-500/30">
                  🗣️
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">Tribuna Chat</h3>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider ${connected ? "text-emerald-400" : "text-red-400 animate-pulse"}`}
                  >
                    {connected ? "● En vivo" : "● Conectando"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-white/60 hover:text-white bg-white/5 rounded-full border-none cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10"
              style={{
                background: "linear-gradient(to bottom, #0a0f1c, #05080f)",
              }}
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-white/50 space-y-2">
                  <span className="text-4xl opacity-50">🗣️</span>
                  <p className="text-sm">
                    No hay mensajes todavía.
                    <br />
                    ¡Escribí el primero!
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMe = m.user.id === user.id;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <span className="text-[10px] text-white/60 mb-1 ml-1">
                        {isMe ? "Vos" : m.user.displayName}
                        {m.user.role === "ADMIN" && (
                          <span className="ml-1 text-amber-500">★</span>
                        )}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-md ${isMe ? "rounded-br-none text-white" : "bg-white/10 border border-white/5 rounded-bl-none text-white/90"}`}
                        style={
                          isMe
                            ? {
                                background:
                                  "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
                              }
                            : {}
                        }
                      >
                        <div>{m.content}</div>
                        <div
                          className={`text-[9px] mt-0.5 text-right ${isMe ? "text-white/70" : "text-white/60"}`}
                        >
                          {m.createdAt
                            ? new Date(m.createdAt)
                                .toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                                .toLowerCase()
                            : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Form */}
            <div className="p-3 bg-black/60 border-t border-white/10 pb-6">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escribí un mensaje..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={!connected}
                  autoFocus
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!connected || !inputVal.trim()}
                  className="w-12 h-[46px] flex items-center justify-center rounded-xl bg-indigo-500 text-white cursor-pointer hover:bg-indigo-400 border-none transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
