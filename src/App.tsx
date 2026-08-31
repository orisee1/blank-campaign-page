import { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useApp } from "./context/AppContext";
import { AppLayout, type RouteId } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PeoplePage } from "./pages/PeoplePage";
import { ProcessesPage } from "./pages/ProcessesPage";
import { TasksPage } from "./pages/TasksPage";
import { OperationsPage } from "./pages/OperationsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AdminPage } from "./pages/AdminPage";
import { AuditPrivacyPage } from "./pages/AuditPrivacyPage";
import { sessionStorageKey } from "./lib/auth";

const moduleByRoute: Record<RouteId, string> = {
  dashboard: "dashboard", people: "people", processes: "processes", tasks: "tasks", calendar: "calendar", events: "events", team: "team", territory: "territory", documents: "documents", finance: "finance", reminders: "reminders", reports: "reports", privacy: "privacy", audit: "audit", admin: "admin", pending: "tasks",
};

const getRoute = (): RouteId => {
  const value = window.location.hash.replace(/^#\/?/, "") as RouteId;
  return moduleByRoute[value] ? value : "dashboard";
};

export default function App() {
  const { currentUser, setCurrentUser, data, loading, can } = useApp();
  const [route, setRoute] = useState<RouteId>(getRoute);

  useEffect(() => {
    const listener = () => setRoute(getRoute());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);

  useEffect(() => {
    if (loading || currentUser) return;
    const raw = sessionStorage.getItem(sessionStorageKey) ?? localStorage.getItem(sessionStorageKey);
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as { userId: string; expiresAt: number };
      const user = data.users.find((item) => item.id === session.userId && item.active && !item.deletedAt);
      if (user && session.expiresAt > Date.now()) setCurrentUser(user);
      else { sessionStorage.removeItem(sessionStorageKey); localStorage.removeItem(sessionStorageKey); }
    } catch { sessionStorage.removeItem(sessionStorageKey); localStorage.removeItem(sessionStorageKey); }
  }, [currentUser, data.users, loading, setCurrentUser]);

  const page = useMemo(() => {
    if (!can(moduleByRoute[route])) return <section className="access-denied"><ShieldAlert size={44} /><h1>Acesso não autorizado</h1><p>Seu perfil não possui permissão para acessar esta área.</p><button className="button primary" onClick={() => { window.location.hash = "#/dashboard"; }}>Voltar ao painel</button></section>;
    switch (route) {
      case "dashboard": return <DashboardPage navigate={(next) => { window.location.hash = `#/${next}`; }} />;
      case "people": return <PeoplePage />;
      case "processes": return <ProcessesPage />;
      case "tasks": case "pending": return <TasksPage onlyMine={route === "pending"} />;
      case "reports": return <ReportsPage />;
      case "admin": return <AdminPage />;
      case "privacy": case "audit": return <AuditPrivacyPage initialTab={route} />;
      default: return <OperationsPage module={route} />;
    }
  }, [can, route]);

  if (loading) return <div className="boot-screen"><div className="brand-mark">CC</div><div className="skeleton wide" /><div className="skeleton" /></div>;
  if (!currentUser) return <LoginPage />;
  return <AppLayout route={route} onNavigate={(next) => { window.location.hash = `#/${next}`; }}>{page}</AppLayout>;
}
