import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useToastStore from '../../store/toastStore';

const icons = {
  success: <CheckCircle2 size={20} className="text-emerald-400" />,
  error: <XCircle size={20} className="text-red-400" />,
  info: <Info size={20} className="text-blue-400" />,
  warning: <AlertTriangle size={20} className="text-amber-400" />
};

const bgColors = {
  success: 'bg-emerald-950/40 border-emerald-500/30',
  error: 'bg-red-950/40 border-red-500/30',
  info: 'bg-blue-950/40 border-blue-500/30',
  warning: 'bg-amber-950/40 border-amber-500/30'
};

export default function Toaster() {
  const { toasts, removeToast, confirmDialog, closeConfirm } = useToastStore();

  return (
    <>
      {/* Contenedor de Toasts (Esquina Superior Derecha) */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.8, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 50 }}
              layout
              className={`min-w-[280px] max-w-sm flex items-start gap-3 p-4 rounded-2xl glass-card border shadow-xl pointer-events-auto ${bgColors[toast.type]}`}
            >
              <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
              <p className="flex-1 text-sm text-white/90 leading-tight m-0">{toast.message}</p>
              <button 
                onClick={() => removeToast(toast.id)} 
                className="flex-shrink-0 text-white/50 hover:text-white bg-transparent border-none cursor-pointer p-0"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dialogo Modal de Confirmación Central */}
      <AnimatePresence>
        {confirmDialog && (
           <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
             {/* Cortina oscura de fondo */}
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
               onClick={closeConfirm}
             />
             
             {/* Tarjeta central */}
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative glass-card rounded-2xl p-6 sm:p-8 max-w-sm w-full mx-auto shadow-2xl border border-white/10"
             >
               <div className="flex flex-col items-center text-center">
                 <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                   <AlertTriangle size={32} />
                 </div>
                 <h2 className="text-xl font-bold text-white mb-2">{confirmDialog.title}</h2>
                 <p className="text-sm text-white/60 mb-6">{confirmDialog.message}</p>
                 
                 <div className="flex gap-3 w-full">
                   <button 
                     onClick={closeConfirm}
                     className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors border-none cursor-pointer"
                   >
                     {confirmDialog.cancelText}
                   </button>
                   <button 
                     onClick={() => {
                        confirmDialog.onConfirm();
                        closeConfirm();
                     }}
                     className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition-colors border-none cursor-pointer"
                   >
                     {confirmDialog.confirmText}
                   </button>
                 </div>
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>
    </>
  );
}
