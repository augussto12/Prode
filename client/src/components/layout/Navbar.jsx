import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Home, Users, Shield, LogOut, Menu, X, User, Star } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/dreamteam', label: 'Dream Team', icon: Star },
    { to: '/groups', label: 'Grupos', icon: Users },
    ...(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN'
      ? [{ to: '/admin', label: 'Admin', icon: Shield }]
      : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 shadow-lg" style={{ background: 'var(--color-bg-start)' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 text-white no-underline">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
              <Trophy size={20} />
            </div>
            <span className="text-lg font-bold tracking-tight">Prode Mundial</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all no-underline ${
                  isActive(link.to)
                    ? 'text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                style={isActive(link.to) ? { background: 'var(--color-primary)' } : {}}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all no-underline text-sm">
              <User size={16} />
              {user?.displayName}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm cursor-pointer border-none bg-transparent"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white bg-transparent border-none cursor-pointer">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4 pt-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline ${
                isActive(link.to) ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'
              }`}
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline ${
              isActive('/profile') ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'
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
        </div>
      )}
    </nav>
  );
}
