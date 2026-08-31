import { useMemo, useState } from "react";
import { Activity, CalendarDays, ClipboardCheck, Download, FileText, MapPin, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { eachDayOfInterval, endOfDay, format, parseISO, startOfDay, subDays } from "date-fns";
import { useApp } from "../context/AppContext";
import { exportTablePdf, exportToXlsx } from "../lib/export";

export function ReportsPage() {
  const { data, visible, settings, currentUser, createRecord } = useApp();
  const [period, setPeriod] = useState("30");
  const [territory, setTerritory] = useState("");
  const [toast, setToast] = useState("");
  const days = Number(period); const start = startOfDay(subDays(new Date(), days - 1)); const end = endOfDay(new Date());
  const inPeriod = (date: string) => { const parsed = parseISO(date); return parsed >= start && parsed <= end; };
  const people = visible(data.people).filter((item) => inPeriod(item.createdAt) && (!territory || item.regionId === territory || item.city === data.territories.find((entry) => entry.id === territory)?.name));
  const processes = visible(data.processes).filter((item) => inPeriod(item.createdAt) && (!territory || item.territoryId === territory));
  const tasks = visible(data.tasks).filter((item) => inPeriod(item.createdAt));
  const events = visible(data.events).filter((item) => inPeriod(item.startAt) && (!territory || item.territoryId === territory));
  const activities = visible(data.activities).filter((item) => inPeriod(item.date) && (!territory || item.territoryId === territory));

  const trend = useMemo(() => eachDayOfInterval({ start, end }).map((day) => ({
    date: format(day, "dd/MM"),
    cadastros: people.filter((item) => format(parseISO(item.createdAt), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")).length,
    processos: processes.filter((item) => format(parseISO(item.createdAt), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")).length,
    atividades: activities.filter((item) => format(parseISO(item.date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")).length,
  })), [activities, end, people, processes, start]);

  const cards = [
    { label: "Pessoas cadastradas", value: people.length, icon: Users, color: "emerald" },
    { label: "Processos abertos", value: processes.length, icon: FileText, color: "amber" },
    { label: "Tarefas concluídas", value: tasks.filter((item) => item.status === "Concluído").length, icon: ClipboardCheck, color: "blue" },
    { label: "Eventos realizados", value: events.filter((item) => item.status === "Realizado").length, icon: CalendarDays, color: "purple" },
    { label: "Atividades territoriais", value: activities.length, icon: MapPin, color: "rose" },
  ];
  const territoryRows = data.territories.filter((item) => !item.deletedAt && item.type === "Município").map((item) => ({ name: item.name, people: people.filter((person) => person.city === item.name || person.regionId === item.id).length, processes: processes.filter((entry) => entry.territoryId === item.id).length, events: events.filter((entry) => entry.territoryId === item.id).length, activities: activities.filter((entry) => entry.territoryId === item.id).length })).sort((a, b) => (b.activities + b.events + b.processes) - (a.activities + a.events + a.processes));

  const generatePdf = async () => {
    await exportTablePdf("Relatório Operacional", `Período: ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`, ["Indicador", "Total"], cards.map((card) => [card.label, card.value]), settings.name, currentUser?.name ?? "Usuário");
    await createRecord("audit", { action: "export", module: "reports", summary: "Relatório operacional PDF gerado", deviceId: localStorage.getItem("central-campanha-device") ?? "browser", after: { period, territory } }); setToast("Relatório PDF gerado e registrado na auditoria."); setTimeout(() => setToast(""), 2600);
  };
  const generateXlsx = async () => {
    exportToXlsx("relatorio-territorial", "Território", territoryRows.map((row) => ({ Município: row.name, Pessoas: row.people, Processos: row.processes, Eventos: row.events, Atividades: row.activities })));
    await createRecord("audit", { action: "export", module: "reports", summary: "Relatório territorial XLSX gerado", deviceId: localStorage.getItem("central-campanha-device") ?? "browser" }); setToast("Planilha territorial gerada."); setTimeout(() => setToast(""), 2600);
  };

  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">INTELIGÊNCIA OPERACIONAL</p><h1>Relatórios</h1><p>Indicadores derivados dos dados reais e limitados ao seu escopo.</p></div><div className="header-actions"><button className="button ghost" onClick={() => void generateXlsx()}><Download size={17} /> Excel</button><button className="button primary" onClick={() => void generatePdf()}><FileText size={17} /> Gerar PDF</button></div></header>
    <section className="report-filters panel"><label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="1">Hoje</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label><label>Município / região<select value={territory} onChange={(event) => setTerritory(event.target.value)}><option value="">Todos permitidos</option>{data.territories.filter((item) => !item.deletedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><span>Dados atualizados agora</span></section>
    <section className="metric-grid report-metrics">{cards.map((card) => <article className="metric-card static" key={card.label}><span className={`metric-icon ${card.color}`}><card.icon size={22} /></span><span><small>{card.label}</small><strong>{card.value}</strong></span></article>)}</section>
    <div className="dashboard-grid"><section className="panel"><header className="panel-header"><div><p className="eyebrow">EVOLUÇÃO</p><h2>Movimento no período</h2></div></header>{trend.every((item) => item.cadastros + item.processos + item.atividades === 0) ? <div className="panel-empty"><Activity size={34} /><strong>Sem movimento no período</strong><span>Escolha outro intervalo ou comece a registrar atividades.</span></div> : <div className="chart-wrap"><ResponsiveContainer width="100%" height={250}><AreaChart data={trend}><defs><linearGradient id="cadastros" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2a7358" stopOpacity={0.3}/><stop offset="95%" stopColor="#2a7358" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8e4da" /><XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} /><Tooltip /><Area type="monotone" dataKey="cadastros" name="Cadastros" stroke="#2a7358" fill="url(#cadastros)" /><Area type="monotone" dataKey="processos" name="Processos" stroke="#e6a85c" fill="transparent" /><Area type="monotone" dataKey="atividades" name="Atividades" stroke="#4d6f9c" fill="transparent" /></AreaChart></ResponsiveContainer></div>}</section>
      <section className="panel"><header className="panel-header"><div><p className="eyebrow">RESUMO EXECUTIVO</p><h2>Para a próxima reunião</h2></div></header><div className="executive-list"><div><CheckIcon ok={processes.filter((item) => item.status === "Concluído").length > 0} /><span><strong>{processes.filter((item) => item.status === "Concluído").length} processos concluídos</strong><small>de {processes.length} abertos no período</small></span></div><div><CheckIcon ok={tasks.filter((item) => item.status !== "Concluído" && item.dueDate && new Date(`${item.dueDate}T23:59:59`) < new Date()).length === 0} /><span><strong>{tasks.filter((item) => item.status !== "Concluído" && item.dueDate && new Date(`${item.dueDate}T23:59:59`) < new Date()).length} tarefas atrasadas</strong><small>exigem atenção da coordenação</small></span></div><div><CheckIcon ok={events.length > 0} /><span><strong>{events.length} eventos no período</strong><small>{events.filter((item) => item.status === "Realizado").length} já realizados</small></span></div><div><CheckIcon ok={territoryRows.some((item) => item.activities > 0)} /><span><strong>{territoryRows.filter((item) => item.activities > 0).length} municípios ativos</strong><small>com atividade territorial registrada</small></span></div></div></section></div>
    <section className="panel table-panel"><header className="panel-header"><div><p className="eyebrow">COBERTURA</p><h2>Indicadores por município</h2></div></header>{territoryRows.length === 0 ? <div className="panel-empty compact"><MapPin size={30} /><strong>Nenhum município cadastrado</strong><span>Configure o território para habilitar esta análise.</span></div> : <div className="responsive-table"><table><thead><tr><th>Município</th><th>Pessoas</th><th>Processos</th><th>Eventos</th><th>Atividades</th></tr></thead><tbody>{territoryRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.people}</td><td>{row.processes}</td><td>{row.events}</td><td>{row.activities}</td></tr>)}</tbody></table></div>}</section>
    {toast && <div className="toast success">{toast}</div>}
  </div>;
}

function CheckIcon({ ok }: { ok: boolean }) { return <span className={`report-check ${ok ? "ok" : "attention"}`}>{ok ? "✓" : "!"}</span>; }
