import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import api from '../../services/api';

export default function AdminCrons() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [moduleFilter, setModuleFilter] = useState('');

  const MODULES = ['', 'Prode', 'Sportmonks', 'Sportmonks Live', 'Sportmonks Static', 'Fantasy Scoring', 'Fantasy Transf', 'System'];

  useEffect(() => {
    fetchLogs();
  }, [page, moduleFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/cron-logs', {
        params: {
          page,
          limit: 20,
          module: moduleFilter || undefined
        }
      });
      setLogs(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar historial de Crons');
    } finally {
      setLoading(false);
    }
  };

  const handleModuleChange = (e) => {
    setModuleFilter(e.target.value);
    setPage(1); // Reset page on filter change
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('es-AR', { 
       month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit'
    });
  };

  return (
    <div className="border border-white/5 rounded-2xl p-4 sm:p-6 overflow-hidden flex flex-col min-h-[500px]" style={{ background: 'color-mix(in srgb, var(--primary-color, #6366f1) 3%, rgba(0,0,0,0.3))' }}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-indigo-400" /> Historial de Crons
          </h2>
          <p className="text-white/40 text-xs sm:text-sm mt-1">Registros de todas las tareas automatizadas realizadas en el servidor.</p>
        </div>
        
        <select 
          value={moduleFilter} 
          onChange={handleModuleChange}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-indigo-500 w-full sm:w-auto"
        >
          <option value="">Todos los Módulos</option>
          {MODULES.filter(m => m).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center text-sm">
          {error}
        </div>
      ) : loading && logs.length === 0 ? (
        <div className="flex-1 flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-white/50 text-xs">
                  <th className="pb-3 font-medium uppercase min-w-[120px]">Fecha</th>
                  <th className="pb-3 font-medium uppercase min-w-[150px]">Módulo</th>
                  <th className="pb-3 font-medium uppercase min-w-[150px]">Tarea</th>
                  <th className="pb-3 font-medium uppercase text-center w-20">Estado</th>
                  <th className="pb-3 font-medium uppercase text-right w-24 pr-4">Duración</th>
                  <th className="pb-3 font-medium uppercase">Detalle</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-white/40">No hay registros para mostrar.</td>
                  </tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="py-3 text-white/60 text-xs">{formatDate(log.createdAt)}</td>
                    <td className="py-3">
                       <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded-md text-xs font-medium">
                         {log.module}
                       </span>
                    </td>
                    <td className="py-3 text-white font-medium">{log.jobName}</td>
                    <td className="py-3 flex justify-center">
                      {log.status === 'success' ? (
                        <CheckCircle size={16} className="text-emerald-500" />
                      ) : log.status === 'error' ? (
                        <AlertCircle size={16} className="text-red-500" />
                      ) : (
                        <AlertCircle size={16} className="text-amber-500" />
                      )}
                    </td>
                    <td className="py-3 text-right text-white/60 pr-4 font-mono text-xs">
                       {log.durationMs}ms
                    </td>
                    <td className="py-3 text-white/70 max-w-[300px] truncate" title={log.message}>
                       {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-white/5">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 border-none cursor-pointer transition text-sm"
              >
                Prev
              </button>
              <div className="flex gap-1">
                <span className="px-3 py-1 text-sm text-indigo-400 font-bold bg-indigo-500/10 rounded-lg">
                  {page} / {totalPages}
                </span>
              </div>
              <button 
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 border-none cursor-pointer transition text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
