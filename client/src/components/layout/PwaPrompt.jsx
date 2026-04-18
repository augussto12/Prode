import { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';

export default function PwaPrompt() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Detect iOS Safari
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    // Detect if already installed (standalone mode)
    const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

    // Only show if it's iOS and NOT already installed
    if (isIos() && !isInStandaloneMode()) {
      // Retrieve dismissal history to not annoy the user every single time
      const dismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowInstallPrompt(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const dismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showInstallPrompt && (
        <m.div 
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 200, opacity: 0 }}
          className="fixed bottom-6 left-0 w-full px-4 z-[9999] flex justify-center"
        >
          <div className="bg-[#1e1b4b]/90 backdrop-blur-xl border border-indigo-500/30 p-5 rounded-2xl shadow-2xl shadow-indigo-900/50 max-w-sm w-full relative">
            <button 
              onClick={dismiss}
              className="absolute top-3 right-3 text-white/50 hover:text-white p-1"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">Instalá la App 📱</h3>
            <p className="text-indigo-200 text-sm mb-4 leading-relaxed">
              Instalá el Prode Mundial para tener notificaciones y pantalla completa.
            </p>
            <ol className="text-white/80 text-sm space-y-3">
              <li className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-xs font-bold">1</span>
                Toca <Share size={18} className="text-blue-400" /> Compartir debajo
              </li>
              <li className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-xs font-bold">2</span>
                Elegí <PlusSquare size={18} /> <strong>Añadir a inicio</strong>
              </li>
            </ol>
            
            {/* The little arrow pointing down for iOS */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#1e1b4b]/90 border-b border-r border-indigo-500/30 rotate-45"></div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
