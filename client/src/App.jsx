import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import useAuthStore from "./store/authStore";
import useThemeStore from "./store/themeStore";
import useCompetitionStore from "./store/competitionStore";
import useToastStore from "./store/toastStore";
import Layout from "./components/layout/Layout";
import PwaPrompt from "./components/layout/PwaPrompt";
import Toaster from "./components/layout/Toaster";
import PageSkeleton from "./components/skeletons/PageSkeleton";
import Login from "./pages/Login";
import Register from "./pages/Register";
import "./index.css";

// Lazy-loaded pages (code-splitting)
const GroupList = lazy(() => import("./pages/GroupList"));
const GroupView = lazy(() => import("./pages/GroupView"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Competition = lazy(() => import("./pages/Competition"));
const Explorer = lazy(() => import("./pages/Explorer"));
const LeagueView = lazy(() => import("./pages/LeagueView"));
const LiveMatch = lazy(() => import("./pages/LiveMatch"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const TeamView = lazy(() => import("./pages/TeamView"));
const Profile = lazy(() => import("./pages/Profile"));
const SmFixtureDetail = lazy(
  () => import("./components/matches/SmFixtureDetail"),
);
const TeamDetail = lazy(() => import("./components/teams/TeamDetail"));
const Fantasy = lazy(() => import("./pages/Fantasy"));
const FantasyLeague = lazy(() => import("./pages/FantasyLeague"));
const FantasyTeam = lazy(() => import("./pages/FantasyTeam"));

function PrivateRoute({ children }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    // Invocar directo al store fuera del ciclo de render — evita toast spam en re-renders
    useToastStore
      .getState()
      .addToast({
        type: "warning",
        message: "Iniciá sesión para realizar esta acción",
      });
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!["ADMIN", "SUPERADMIN"].includes(user?.role))
    return <Navigate to="/explorar" replace />;
  return children;
}

function PublicRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  return user ? <Navigate to="/explorar" replace /> : children;
}

export default function App() {
  const user = useAuthStore((state) => state.user);
  const { setPersonalTheme } = useThemeStore();
  const fetchCompetitions = useCompetitionStore(
    (state) => state.fetchCompetitions,
  );

  // Cargar competencias una sola vez al montar
  useEffect(() => {
    fetchCompetitions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aplicar theme personal cuando cambia el usuario
  useEffect(() => {
    if (user) {
      setPersonalTheme(user);
    }
  }, [user, setPersonalTheme]);

  return (
    <BrowserRouter>
      <Toaster />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* Main App Layout */}
          <Route element={<Layout />}>
            {/* Public content (No auth required to read) */}
            <Route path="/explorar" element={<Explorer />} />
            <Route path="/liga/:id" element={<LeagueView />} />
            <Route path="/partido/:id" element={<LiveMatch />} />
            <Route path="/jugador/:id" element={<PlayerProfile />} />
            <Route path="/equipo/:id" element={<TeamView />} />
            <Route path="/sm-partido/:id" element={<SmFixtureDetail />} />
            <Route path="/sm-equipo/:id" element={<TeamDetail />} />

            {/* Protected content (Auth required) */}
            <Route
              path="/fantasy"
              element={
                <PrivateRoute>
                  <Fantasy />
                </PrivateRoute>
              }
            />
            <Route
              path="/fantasy/league/:id"
              element={
                <PrivateRoute>
                  <FantasyLeague />
                </PrivateRoute>
              }
            />
            <Route
              path="/fantasy/team/:id"
              element={
                <PrivateRoute>
                  <FantasyTeam />
                </PrivateRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <PrivateRoute>
                  <GroupList />
                </PrivateRoute>
              }
            />
            <Route
              path="/groups/:id"
              element={
                <PrivateRoute>
                  <GroupView />
                </PrivateRoute>
              }
            />
            <Route
              path="/torneo"
              element={
                <PrivateRoute>
                  <Competition />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />
          </Route>

          {/* Backwards compat redirects */}
          <Route path="/mundial" element={<Navigate to="/liga/1" replace />} />
          <Route
            path="/dashboard"
            element={<Navigate to="/explorar" replace />}
          />
          <Route
            path="/dreamteam"
            element={<Navigate to="/torneo" replace />}
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/explorar" replace />} />
        </Routes>
      </Suspense>
      <PwaPrompt />
    </BrowserRouter>
  );
}
