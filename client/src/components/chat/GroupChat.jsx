import { useState, useEffect, useRef } from 'react';
import { Send, User } from 'lucide-react';
import { io } from 'socket.io-client';
import useAuthStore from '../../store/authStore';

export default function GroupChat({ groupId, initialMessages = [] }) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState(initialMessages);
  const [inputVal, setInputVal] = useState('');
  const [connected, setConnected] = useState(false);
  
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    // Scroll to bottom when messages load/update
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    // Connect to server socket (cookie HttpOnly se envía automáticamente)
    socketRef.current = io(window.location.origin, {
      withCredentials: true,
    });

    socketRef.current.on('connect', () => {
      setConnected(true);
      // Join group room
      socketRef.current.emit('join_group', groupId);
    });

    socketRef.current.on('disconnect', () => {
      setConnected(false);
    });

    socketRef.current.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socketRef.current?.emit('leave_group', groupId);
      socketRef.current?.disconnect();
    };
  }, [user, groupId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    socketRef.current.emit('send_message', {
      groupId,
      content: inputVal
    });
    
    setInputVal('');
  };

  return (
    <div className="flex flex-col h-full bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden shadow-xl relative backdrop-blur-md">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <h3 className="font-semibold text-white/90 text-sm">Tribuna / Chat</h3>
        <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-white/40">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`}></span>
          {connected ? 'En vivo' : 'Conectando'}
        </span>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px] scrollbar-thin scrollbar-thumb-white/10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/30 space-y-2">
            <span className="text-3xl">🗣️</span>
            <p className="text-xs">No hay mensajes todavía.<br/>¡Sé el primero en picantarla!</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.user.id === user.id;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-white/30 mb-1 ml-1">
                  {isMe ? 'Vos' : m.user.displayName}
                  {m.user.role === 'ADMIN' && <span className="ml-1 text-amber-500">★</span>}
                </span>
                
                <div 
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-md ${
                    isMe 
                    ? 'rounded-br-none text-white' 
                    : 'bg-white/10 border border-white/5 rounded-bl-none text-white/90'
                  }`}
                  style={isMe ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' } : {}}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
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
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-500 text-white cursor-pointer hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
