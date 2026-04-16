import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy } from 'react';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import useCompetitionStore from './store/competitionStore';
import useToastStore from './store/toastStore';
import Layout from './components/layout/Layout';
import PwaPrompt from './components/layout/PwaPrompt';
import Toaster from './components/layout/Toaster';
import Login from './pages/Login';
import Register from './pages/Register';
import './index.css';

// Lazy-loaded pages (code-splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GroupList = lazy(() => import('./pages/GroupList'));
const GroupView = lazy(() => import('./pages/GroupView'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Competition = lazy(() => import('./pages/Competition'));
const Explorer = lazy(() => import('./pages/Explorer'));
const LeagueView = lazy(() => import('./pages/LeagueView'));
const LiveMatch = lazy(() => import('./pages/LiveMatch'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const TeamView = lazy(() => import('./pages/TeamView'));
const Profile = lazy(() => import('./pages/Profile'));

function PrivateRoute({ children }) {
  const { user } = useAuthStore();
  const addToast = useToastStore(state => state.addToast);

  useEffect(() => {
    if (!user) {
      addToast({ type: 'warning', message: 'Iniciá sesión para realizar esta acción' });
    }
  }, [user, addToast]);

  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!['ADMIN', 'SUPERADMIN'].includes(user?.role)) return <Navigate to="/explorar" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuthStore();
  return user ? <Navigate to="/explorar" replace /> : children;
}

export default function App() {
  const { user } = useAuthStore();
  const { setPersonalTheme } = useThemeStore();
  const { fetchCompetitions } = useCompetitionStore();

  useEffect(() => {
    fetchCompetitions();
    if (user) {
      setPersonalTheme(user);
    }
  }, [user, setPersonalTheme, fetchCompetitions]);

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Main App Layout */}
        <Route element={<Layout />}>
          {/* Public content (No auth required to read) */}
          <Route path="/explorar" element={<Explorer />} />
          <Route path="/liga/:id" element={<LeagueView />} />
          <Route path="/partido/:id" element={<LiveMatch />} />
          <Route path="/jugador/:id" element={<PlayerProfile />} />
          <Route path="/equipo/:id" element={<TeamView />} />

          {/* Protected content (Auth required) */}
          <Route path="/groups" element={<PrivateRoute><GroupList /></PrivateRoute>} />
          <Route path="/groups/:id" element={<PrivateRoute><GroupView /></PrivateRoute>} />
          <Route path="/torneo" element={<PrivateRoute><Competition /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Route>

        {/* Backwards compat redirects */}
        <Route path="/mundial" element={<Navigate to="/liga/1" replace />} />
        <Route path="/dashboard" element={<Navigate to="/explorar" replace />} />
        <Route path="/dreamteam" element={<Navigate to="/torneo" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/explorar" replace />} />
      </Routes>
      <PwaPrompt />
    </BrowserRouter>
  );
}
