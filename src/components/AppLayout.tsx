import { useMemo, useState, type ReactNode } from "react";
import {
  Activity, Bell, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardCheck, FileText, Gauge, Globe2, Landmark, LogOut, Menu, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Users, Wifi, WifiOff, X, LoaderCircle,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { sessionStorageKey } from "../lib/auth";
import { Modal } from "./Modal";

export type RouteId = "dashboard" | "people" | "processes" | "tasks" | "calendar" | "events" | "team" | "territory" | "documents" | "finance" | "reminders" | "reports" | "privacy" | "audit" | "admin" | "pending";

const nav = [
  { id: "dashboard", label: "Dashboard", icon: Gauge, module: "dashboard" },
  { id: "people", label: "Pessoas", icon: Users, module: "people" },
  { id: "processes", label: "Processos e Demandas", icon: FileText, module: "processes" },
  { id: "tasks", label: "Tarefas", icon: ClipboardCheck, module: "tasks" },
  { id: "calendar", label: "Agenda", icon: CalendarDays, module: "calendar" },
  { id: "events", label: "Eventos", icon: Activity, module: "events" },
  { id: "team", label: "Equipe e Voluntários", icon: Users, module: "team" },
  { id: "territory", label: "Território", icon: Globe2, module: "territory" },
  { id: "documents", label: "Documentos", icon: FileText, module: "documents" },
  { id: "finance", label: "Administrativo", icon: CircleDollarSign, module: "finance" },
  { id: "reports", label: "Relatórios", icon: SlidersHorizontal, module: "reports" },
  { id: "privacy", label: "Privacidade", icon: ShieldCheck, module: "privacy" },
  { id: "audit", label: "Auditoria", icon: Landmark, module: "audit" },
  { id: "admin", label: "Administração", icon: Settings, module: "admin" },
] as const;

const quickItems = [
  { route: "people", label: "Pessoa", icon: Users }, { route: "processes", label: "Processo", icon: FileText }, { route: "tasks", label: "Tarefa", icon: ClipboardCheck }, { route: "events", label: "Evento", icon: Activity }, { route: "calendar", label: "Compromisso", icon: CalendarDays }, { route: "reminders", label: "Lembrete", icon: Bell },
] as const;

export function AppLayout({ children, route, onNavigate }: { children: ReactNode; route: RouteId; onNavigate: (route: RouteId) => void }) {
  const { settings, currentUser, data, online, syncing, pendingCount, can, updateRecord, setCurrentUser } = useApp();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("central-sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const unread = data.notifications.filter((item) => item.recipientId === currentUser?.id && !item.readAt && !item.deletedAt);
  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR"); if (!term) return [];
    return [
      ...data.people.filter((item) => !item.deletedAt && item.name.toLocaleLowerCase("pt-BR").includes(term)).map((item) => ({ route: "people" as RouteId, type: "Pessoa", title: item.name, detail: [item.city, item.phone].filter(Boolean).join(" • ") })),
      ...data.processes.filter((item) => !item.deletedAt && `${item.code} ${item.title}`.toLocaleLowerCase("pt-BR").includes(term)).map((item) => ({ route: "processes" as RouteId, type: "Processo", title: `${item.code} — ${item.title}`, detail: item.status })),
      ...data.tasks.filter((item) => !item.deletedAt && item.title.toLocaleLowerCase("pt-BR").includes(term)).map((item) => ({ route: "tasks" as RouteId, type: "Tarefa", title: item.title, detail: item.status })),
      ...data.events.filter((item) => !item.deletedAt && item.name.toLocaleLowerCase("pt-BR").includes(term)).map((item) => ({ route: "events" as RouteId, type: "Evento", title: item.name, detail: item.status })),
      ...data.documents.filter((item) => can("documents") && !item.deletedAt && item.name.toLocaleLowerCase("pt-BR").includes(term)).map((item) => ({ route: "documents" as RouteId, type: "Documento", title: item.name, detail: item.category })),
      ...data.territories.filter((item) => !item.deletedAt && item.name.toLocaleLowerCase("pt-BR").includes(term)).map((item) => ({ route: "territory" as RouteId, type: item.type, title: item.name, detail: item.stateCode ?? "" })),
    ].slice(0, 20);
  }, [can, data, search]);

  const toggle = () => { const next = !collapsed; setCollapsed(next); localStorage.setItem("central-sidebar", next ? "collapsed" : "open"); };
  const navigate = (next: RouteId) => { onNavigate(next); setMobileOpen(false); };
  const logout = () => { localStorage.removeItem(sessionStorageKey); sessionStorage.removeItem(sessionStorageKey); setCurrentUser(null); };

  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-mark">CC</span>{!collapsed && <div><strong>{settings.name}</strong><span>{settings.office}</span></div>}<button className="mobile-close icon-button" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <nav aria-label="Navegação principal">{nav.filter((item) => can(item.module)).map((item) => <button key={item.id} className={route === item.id ? "active" : ""} title={item.label} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => navigate("pending")}><ClipboardCheck size={19} /><span>Minhas pendências</span></button><button className="collapse-button" onClick={toggle}>{collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}<span>Recolher menu</span></button></div>
    </aside>
    {mobileOpen && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <div className="workspace">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
        <button className="global-search" onClick={() => setSearchOpen(true)}><Search size={18} /><span>Pesquisar pessoas, processos, tarefas…</span><kbd>Ctrl K</kbd></button>
        <div className="top-actions">
          <button className="button primary compact" onClick={() => setQuickOpen(true)}><Plus size={18} /><span>Novo</span></button>
          <button className={`sync-pill ${!online ? "offline" : syncing ? "syncing" : ""}`} title={`${pendingCount} alterações aguardando sincronização`}>{!online ? <WifiOff size={16} /> : syncing ? <LoaderCircle className="spin" size={16} /> : <Wifi size={16} />}<span>{!online ? "Offline" : syncing ? "Sincronizando" : "Online"}</span>{pendingCount > 0 && <b>{pendingCount}</b>}</button>
          <button className="icon-button notification-button" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notificações"><Bell size={20} />{unread.length > 0 && <span>{unread.length}</span>}</button>
          <button className="user-menu" onClick={() => navigate("admin")}><span className="avatar">{currentUser?.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="user-copy"><strong>{currentUser?.name}</strong><small>{data.roles.find((item) => item.id === currentUser?.roleId)?.name}</small></span></button>
          <button className="icon-button" title="Sair" onClick={logout}><LogOut size={19} /></button>
        </div>
        {notificationsOpen && <section className="notifications-panel"><header><div><strong>Notificações</strong><span>{unread.length} não lidas</span></div><button className="text-button" onClick={() => unread.forEach((item) => void updateRecord("notifications", item.id, { readAt: new Date().toISOString() }))}>Marcar todas como lidas</button></header>{unread.length === 0 ? <div className="mini-empty"><Bell size={24} /><p>Nenhuma notificação nova.</p></div> : unread.map((item) => <button key={item.id} className="notification-item" onClick={() => { void updateRecord("notifications", item.id, { readAt: new Date().toISOString() }); setNotificationsOpen(false); if (item.relatedType && item.relatedType in Object.fromEntries(nav.map((entry) => [entry.id, true]))) navigate(item.relatedType as RouteId); }}><strong>{item.title}</strong><span>{item.message}</span></button>)}</section>}
      </header>
      <main className="content">{children}</main>
    </div>

    {searchOpen && <Modal title="Pesquisa global" description="Resultados limitados aos dados que seu perfil pode visualizar." onClose={() => { setSearchOpen(false); setSearch(""); }} wide><div className="search-modal"><div className="search-input-wrap"><Search size={20} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Comece a digitar…" /></div><div className="search-results">{search && results.length === 0 && <div className="mini-empty"><Search size={28} /><p>Nenhum resultado encontrado.</p></div>}{results.map((result, index) => <button key={`${result.type}-${index}`} onClick={() => { navigate(result.route); setSearchOpen(false); setSearch(""); }}><span className="result-type">{result.type}</span><span><strong>{result.title}</strong><small>{result.detail}</small></span></button>)}</div></div></Modal>}
    {quickOpen && <Modal title="Criar novo registro" description="Escolha o que deseja adicionar." onClose={() => setQuickOpen(false)}><div className="quick-grid">{quickItems.filter((item) => can(item.route, "create")).map((item) => <button key={item.route} onClick={() => { navigate(item.route); setQuickOpen(false); setTimeout(() => window.dispatchEvent(new CustomEvent("central:quick-new", { detail: item.route })), 50); }}><item.icon size={23} /><span>{item.label}</span><ChevronRight size={17} /></button>)}</div></Modal>}
  </div>;
}
