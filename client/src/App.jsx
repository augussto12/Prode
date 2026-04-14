import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import Layout from './components/layout/Layout';
import PwaPrompt from './components/layout/PwaPrompt';
import Toaster from './components/layout/Toaster';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DreamTeam from './pages/DreamTeam';
import GroupList from './pages/GroupList';
import GroupView from './pages/GroupView';
import AdminPanel from './pages/AdminPanel';
import Profile from './pages/Profile';
import './index.css';

function PrivateRoute({ children }) {
  const { user } = useAuthStore();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!['ADMIN', 'SUPERADMIN'].includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuthStore();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const { user } = useAuthStore();
  const { setPersonalTheme } = useThemeStore();

  useEffect(() => {
    if (user) setPersonalTheme(user);
  }, [user, setPersonalTheme]);

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Protected */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dreamteam" element={<DreamTeam />} />
          <Route path="/groups" element={<GroupList />} />
          <Route path="/groups/:id" element={<GroupView />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <PwaPrompt />
    </BrowserRouter>
  );
}
