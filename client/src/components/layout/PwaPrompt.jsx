import { useState, useEffect } from "react";
import { Share, PlusSquare, X, Download } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

export default function PwaPrompt() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [promptType, setPromptType] = useState(null); // 'ios' | 'android'

  useEffect(() => {
    // Detect iOS Safari
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    // Detect if already installed (standalone mode)
    const isInStandaloneMode = () =>
      "standalone" in window.navigator && window.navigator.standalone;

    // Check dismissal history
    const dismissed = localStorage.getItem("pwa_prompt_dismissed");
    if (dismissed) return;

    // iOS: show custom instructions
    if (isIos() && !isInStandaloneMode()) {
      const timer = setTimeout(() => {
        setPromptType("ios");
        setShowInstallPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome / Edge: listen for native install prompt
    if (window.deferredPwaPrompt) {
      const timer = setTimeout(() => {
        setPromptType("android");
        setShowInstallPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    const handleReady = () => {
      const timer = setTimeout(() => {
        setPromptType("android");
        setShowInstallPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    };

    window.addEventListener("pwaPromptReady", handleReady);
    return () => window.removeEventListener("pwaPromptReady", handleReady);
  }, []);

  const dismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  const handleInstall = async () => {
    if (!window.deferredPwaPrompt) return;
    window.deferredPwaPrompt.prompt();
    const { outcome } = await window.deferredPwaPrompt.userChoice;
    if (outcome === "accepted") {
      window.deferredPwaPrompt = null;
      setShowInstallPrompt(false);
      localStorage.setItem("pwa_prompt_dismissed", "true");
    }
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
          <div
            className="backdrop-blur-xl border border-indigo-500/30 p-5 rounded-2xl shadow-2xl shadow-indigo-900/50 max-w-sm w-full relative"
            style={{
              background:
                "color-mix(in srgb, var(--bg-end-color, #1e1b4b) 90%, transparent)",
            }}
          >
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-white/50 hover:text-white p-1"
            >
              <X size={16} />
            </button>

            {promptType === "ios" ? (
              <>
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  Instalá la App 📱
                </h3>
                <p className="text-indigo-200 text-sm mb-4 leading-relaxed">
                  Instalá el Prode Mundial para tener notificaciones y pantalla
                  completa.
                </p>
                <ol className="text-white/80 text-sm space-y-3">
                  <li className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-xs font-bold">
                      1
                    </span>
                    Toca <Share size={18} className="text-blue-400" /> Compartir
                    debajo
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-xs font-bold">
                      2
                    </span>
                    Elegí <PlusSquare size={18} />{" "}
                    <strong>Añadir a inicio</strong>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  Instalá la App 📱
                </h3>
                <p className="text-indigo-200 text-sm mb-4 leading-relaxed">
                  Agregá el Prode Mundial a tu pantalla de inicio para acceder
                  más rápido y tener la experiencia completa.
                </p>
                <button
                  onClick={handleInstall}
                  className="w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all border-none text-sm"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "white",
                  }}
                >
                  <Download size={18} /> Instalar Ahora
                </button>
              </>
            )}

            {/* The little arrow pointing down */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 border-b border-r border-indigo-500/30 rotate-45"
              style={{
                background:
                  "color-mix(in srgb, var(--bg-end-color, #1e1b4b) 90%, transparent)",
              }}
            ></div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
