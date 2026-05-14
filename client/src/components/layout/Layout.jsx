import { Suspense, useEffect, useState, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Navbar from "./Navbar";
import GuruChat from "../chat/GuruChat";
import PageSkeleton from "../skeletons/PageSkeleton";

export default function Layout() {
  const { pathname } = useLocation();
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const maxPull = 120; // px needed to trigger refresh

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Pull-to-refresh for mobile
  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (window.scrollY > 0) return;
      const y = e.touches[0].clientY;
      const diff = y - touchStartY.current;
      if (diff > 0) {
        setPulling(true);
        // Resistance: the further you pull, the harder it gets
        const resisted = Math.min(diff * 0.5, maxPull + 40);
        setPullDistance(resisted);
        if (diff > 10) e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (pullDistance > maxPull && !refreshing) {
        setRefreshing(true);
        window.location.reload();
      } else {
        setPulling(false);
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, refreshing]);

  const progress = Math.min(pullDistance / maxPull, 1);

  return (
    <div className="min-h-screen relative">
      {/* Pull-to-refresh indicator */}
      {pulling && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center transition-transform"
          style={{
            height: `${pullDistance}px`,
            transform: `translateY(0)`,
          }}
        >
          <div className="flex flex-col items-center justify-center text-white/60">
            {refreshing ? (
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            ) : (
              <>
                <Loader2
                  size={24}
                  className="text-indigo-400"
                  style={{
                    transform: `rotate(${progress * 360}deg)`,
                    transition: "transform 0.1s",
                  }}
                />
                <span className="text-[10px] mt-1 font-medium">
                  {progress >= 1 ? "Soltar para actualizar" : "Deslizar para actualizar"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <Navbar />
      <main className="pt-6 md:pt-8 px-4 md:px-8 pb-24 md:pb-8 max-w-[1600px] mx-auto">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <GuruChat />
    </div>
  );
}
