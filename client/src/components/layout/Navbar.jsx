import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Trophy,
  Home,
  Users,
  Shield,
  LogOut,
  Menu,
  X,
  User,
  Compass,
  Zap,
  Star,
} from "lucide-react";
import useAuthStore from "../../store/authStore";
import api from "../../services/api";

export default function Navbar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const intervalRef = useRef(null);

  const checkLive = async () => {
    try {
      const { data } = await api.get("/explorer/live");
      setLiveCount(data?.total || 0);
    } catch {
      setLiveCount(0);
    }
  };

  useEffect(() => {
    checkLive();
    intervalRef.current = setInterval(checkLive, 60000); // Check every 60s
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const links = [
    {
      to: "/explorar",
      label: "Explorar",
      icon: Compass,
      badge: liveCount > 0 ? liveCount : null,
    },
    { to: "/liga/1", label: "Mundial 2026", icon: Trophy, gold: true },
    { to: "/fantasy", label: "GranDT", icon: Star },
    { to: "/groups", label: "Grupos", icon: Users },
    ...(user?.role === "ADMIN" || user?.role === "SUPERADMIN"
      ? [{ to: "/admin", label: "Admin", icon: Shield }]
      : []),
  ];

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 shadow-lg bg-[#0f172a]">
      <div className="relative z-50 max-w-[1600px] mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            to="/explorar"
            className="flex items-center gap-2 text-white no-underline"
            aria-label="Ir al Inicio"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--color-primary)" }}
            >
              <Trophy size={16} aria-hidden="true" />
            </div>
            <span className="text-base font-bold tracking-tight hidden sm:inline">
              Prode
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all no-underline ${isActive(link.to)
                  ? "text-white"
                  : link.gold
                    ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                style={
                  isActive(link.to)
                    ? {
                      background: link.gold
                        ? "linear-gradient(135deg, #b8860b, #daa520)"
                        : "var(--color-primary)",
                    }
                    : {}
                }
              >
                <link.icon size={14} />
                {link.label}
                {link.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center text-white animate-pulse">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* User Status / Menu */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all no-underline text-xs"
                >
                  <User size={14} />
                  {user.displayName}
                </Link>
                <button
                  onClick={handleLogout}
                  aria-label="Cerrar sesión"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-xs cursor-pointer border-none bg-transparent"
                >
                  <LogOut size={14} aria-hidden="true" />
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-all no-underline"
                >
                  Ingresar
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-all no-underline shadow-lg shadow-indigo-500/20"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: live badge + toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {liveCount > 0 && (
              <Link
                to="/explorar"
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold no-underline animate-pulse"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {liveCount}
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              className="text-white bg-transparent border-none cursor-pointer p-1"
            >
              {mobileOpen ? (
                <X size={22} aria-hidden="true" />
              ) : (
                <Menu size={22} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden absolute top-full left-0 right-0 z-50 bg-[#0f0c29]/95 backdrop-blur-md border-b border-white/10 px-4 pb-4 pt-2 shadow-2xl">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline ${isActive(link.to)
                  ? "text-white bg-white/10"
                  : "text-white/60 hover:text-white"
                  }`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline ${isActive("/profile")
                    ? "text-white bg-white/10"
                    : "text-white/60 hover:text-white"
                    }`}
                >
                  <User size={18} />
                  Mi Perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-400 hover:text-red-300 w-full bg-transparent border-none cursor-pointer"
                >
                  <LogOut size={18} />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-full py-3 rounded-lg text-sm font-semibold text-white/80 hover:bg-white/5 transition-all no-underline border border-white/10"
                >
                  Ingresar
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-full py-3 rounded-lg text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-all no-underline shadow-lg shadow-indigo-500/20"
                >
                  Crear cuenta gratis
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  );
}
