import { Activity, ArrowRight, CalendarClock, CheckCircle2, CircleAlert, ClipboardCheck, Clock3, FileText, MapPin, Users, UserRoundCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isSameDay, isToday, parseISO, startOfDay } from "date-fns";
import { useApp } from "../context/AppContext";
import type { RouteId } from "../components/AppLayout";

export function DashboardPage({ navigate }: { navigate: (route: RouteId) => void }) {
  const { data, settings, currentUser, visible, can } = useApp();
  const people = visible(data.people);
  const processes = visible(data.processes);
  const tasks = visible(data.tasks);
  const events = visible(data.events);
  const team = visible(data.team);
  const activities = visible(data.activities);
  const now = new Date();
  const overdueTasks = tasks.filter((item) => item.status !== "Concluído" && item.dueDate && parseISO(item.dueDate) < startOfDay(now));
  const overdueProcesses = processes.filter((item) => !["Concluído", "Cancelado", "Arquivado"].includes(item.status) && item.dueDate && parseISO(item.dueDate) < startOfDay(now));
  const upcomingEvents = events.filter((item) => !["Realizado", "Cancelado"].includes(item.status) && parseISO(item.startAt) >= startOfDay(now));
  const newToday = people.filter((item) => isToday(parseISO(item.createdAt))).length;

  const cards = [
    { label: "Pessoas cadastradas", value: people.length, helper: `${newToday} novos hoje`, icon: Users, route: "people" as RouteId, color: "emerald", show: can("people") },
    { label: "Demandas abertas", value: processes.filter((item) => !["Concluído", "Cancelado", "Arquivado"].includes(item.status)).length, helper: `${overdueProcesses.length} fora do prazo`, icon: FileText, route: "processes" as RouteId, color: "amber", show: can("processes") },
    { label: "Tarefas pendentes", value: tasks.filter((item) => item.status !== "Concluído").length, helper: `${overdueTasks.length} atrasadas`, icon: ClipboardCheck, route: "tasks" as RouteId, color: "blue", show: can("tasks") },
    { label: "Próximos eventos", value: upcomingEvents.length, helper: `${events.filter((item) => item.status === "Realizado").length} realizados`, icon: CalendarClock, route: "events" as RouteId, color: "purple", show: can("events") },
    { label: "Voluntários ativos", value: team.filter((item) => item.status === "Ativo").length, helper: `${new Set(team.map((item) => item.territoryId).filter(Boolean)).size} regiões`, icon: UserRoundCheck, route: "team" as RouteId, color: "rose", show: can("team") },
  ].filter((item) => item.show);

  const todayItems = [
    ...data.calendar.filter((item) => !item.deletedAt && isSameDay(parseISO(item.startAt), now)).map((item) => ({ time: new Date(item.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), title: item.title, meta: item.location || item.type, type: "Agenda", route: "calendar" as RouteId })),
    ...tasks.filter((item) => item.status !== "Concluído" && item.dueDate && isSameDay(parseISO(item.dueDate), now)).map((item) => ({ time: "Hoje", title: item.title, meta: item.priority, type: "Tarefa", route: "tasks" as RouteId })),
    ...data.reminders.filter((item) => !item.deletedAt && !item.done && isSameDay(parseISO(item.dueAt), now)).map((item) => ({ time: new Date(item.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), title: item.title, meta: item.type, type: "Lembrete", route: "reminders" as RouteId })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const territoryChart = data.territories.filter((item) => !item.deletedAt && item.type === "Município").map((territory) => ({
    name: territory.name.length > 14 ? `${territory.name.slice(0, 12)}…` : territory.name,
    atividades: activities.filter((item) => item.territoryId === territory.id).length,
    demandas: processes.filter((item) => item.territoryId === territory.id).length,
  })).sort((a, b) => (b.atividades + b.demandas) - (a.atividades + a.demandas)).slice(0, 6);

  const recent = [...data.audit].filter((item) => !item.deletedAt && item.action !== "login").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return <div className="page-stack">
    <header className="page-header dashboard-heading"><div><p className="eyebrow">VISÃO OPERACIONAL</p><h1>Bom dia, {currentUser?.name.split(" ")[0]}.</h1><p>Acompanhe o que precisa de atenção na {settings.name.toLowerCase()}.</p></div><div className="date-chip"><Clock3 size={18} /><span><strong>{now.toLocaleDateString("pt-BR", { weekday: "long" })}</strong>{now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span></div></header>
    {(overdueTasks.length > 0 || overdueProcesses.length > 0) && <button className="attention-strip" onClick={() => navigate("pending")}><CircleAlert size={22} /><span><strong>Sua atenção é necessária</strong><small>{overdueTasks.length} tarefas e {overdueProcesses.length} processos estão fora do prazo.</small></span><ArrowRight size={19} /></button>}
    <section className="metric-grid">{cards.map((card) => <button key={card.label} className="metric-card" onClick={() => navigate(card.route)}><span className={`metric-icon ${card.color}`}><card.icon size={22} /></span><span><small>{card.label}</small><strong>{card.value.toLocaleString("pt-BR")}</strong><em>{card.helper}</em></span><ArrowRight className="card-arrow" size={17} /></button>)}</section>
    <div className="dashboard-grid">
      <section className="panel today-panel"><header className="panel-header"><div><p className="eyebrow">HOJE</p><h2>Agenda e pendências</h2></div><button className="text-button" onClick={() => navigate("calendar")}>Ver agenda <ArrowRight size={15} /></button></header>{todayItems.length === 0 ? <div className="panel-empty"><CheckCircle2 size={34} /><strong>Nenhuma pendência para hoje</strong><span>Novos compromissos e tarefas aparecerão aqui.</span></div> : <div className="timeline-list">{todayItems.map((item, index) => <button key={`${item.title}-${index}`} onClick={() => navigate(item.route)}><time>{item.time}</time><span className="timeline-dot" /><span><strong>{item.title}</strong><small>{item.type} • {item.meta}</small></span><ArrowRight size={16} /></button>)}</div>}</section>
      <section className="panel territorial-panel"><header className="panel-header"><div><p className="eyebrow">TERRITÓRIO</p><h2>Atividade por município</h2></div><button className="text-button" onClick={() => navigate("territory")}>Explorar <ArrowRight size={15} /></button></header>{territoryChart.length === 0 ? <div className="panel-empty"><MapPin size={34} /><strong>Território ainda não configurado</strong><span>Cadastre municípios para acompanhar a operação.</span></div> : <div className="chart-wrap"><ResponsiveContainer width="100%" height={220}><BarChart data={territoryChart} margin={{ left: -26, right: 8 }}><CartesianGrid vertical={false} stroke="#e8e4da" /><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} /><Tooltip /><Bar dataKey="atividades" name="Atividades" fill="#2a7358" radius={[4, 4, 0, 0]} /><Bar dataKey="demandas" name="Demandas" fill="#e6a85c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}</section>
    </div>
    <section className="panel"><header className="panel-header"><div><p className="eyebrow">MOVIMENTO DA EQUIPE</p><h2>Atividade recente</h2></div></header>{recent.length === 0 ? <div className="panel-empty compact"><Activity size={30} /><strong>O histórico começa com a primeira ação</strong><span>Cadastros e alterações serão registrados automaticamente.</span></div> : <div className="activity-feed">{recent.map((item) => <div key={item.id}><span className="activity-avatar">{data.users.find((user) => user.id === item.createdBy)?.name.slice(0, 1) ?? "S"}</span><span><strong>{data.users.find((user) => user.id === item.createdBy)?.name ?? "Sistema"}</strong> {item.summary.toLowerCase()}<small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></span></div>)}</div>}</section>
  </div>;
}
