import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, MessageSquare, MoreHorizontal, Plus, Send, Star, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { Priority, ProcessRecord } from "../types";
import { ConfirmDialog, Modal } from "../components/Modal";
import { EmptyState, Pagination, TableToolbar } from "../components/TableTools";
import { exportToXlsx } from "../lib/export";

const statuses = ["Novo", "Em análise", "Em andamento", "Encaminhado", "Aguardando retorno", "Concluído", "Cancelado", "Arquivado"];
const priorities: Priority[] = ["Baixa", "Normal", "Alta", "Urgente"];
const emptyForm = { title: "", description: "", category: "Demanda comunitária", personId: "", territoryId: "", assigneeId: "", team: "", priority: "Normal" as Priority, status: "Novo", dueDate: "", notes: "" };
const PAGE_SIZE = 12;

export function ProcessesPage() {
  const { data, visible, createRecord, updateRecord, softDelete, can, currentUser } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ProcessRecord | null>(null);
  const [selected, setSelected] = useState<ProcessRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcessRecord | null>(null);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState("");
  const processes = visible(data.processes);
  const filtered = processes.filter((item) => (!search || `${item.code} ${item.title} ${item.category}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) && (!status || item.status === status) && (!priority || item.priority === priority));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { const listener = (event: Event) => { if ((event as CustomEvent).detail === "processes") openCreate(); }; window.addEventListener("central:quick-new", listener); return () => window.removeEventListener("central:quick-new", listener); }, []);
  useEffect(() => { setPage(1); }, [search, status, priority]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2500); return () => clearTimeout(timer); }, [toast]);

  function openCreate() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(item: ProcessRecord) { setEditing(item); setForm({ title: item.title, description: item.description ?? "", category: item.category, personId: item.personId ?? "", territoryId: item.territoryId ?? "", assigneeId: item.assigneeId ?? "", team: item.team ?? "", priority: item.priority, status: item.status, dueDate: item.dueDate ?? "", notes: item.notes ?? "" }); setFormOpen(true); }
  const code = useMemo(() => `PROC-${new Date().getFullYear()}-${String(data.processes.length + 1).padStart(4, "0")}`, [data.processes.length]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); const assigneeChanged = form.assigneeId && form.assigneeId !== editing?.assigneeId;
    if (editing) await updateRecord("processes", editing.id, form, `Processo ${editing.code} atualizado`);
    else await createRecord("processes", { ...form, code }, `Processo ${code} criado`);
    if (assigneeChanged) await createRecord("notifications", { title: "Novo processo atribuído", message: `${editing?.code ?? code} — ${form.title}`, recipientId: form.assigneeId, relatedType: "processes", relatedId: editing?.id });
    setFormOpen(false); setToast(editing ? "Processo atualizado." : "Processo criado e incluído no painel.");
  };

  const addComment = async () => {
    if (!selected || !comment.trim()) return;
    const mentions = [...comment.matchAll(/@([\p{L}\d._-]+)/gu)].map((match) => match[1]);
    await createRecord("comments", { module: "processes", recordId: selected.id, body: comment.trim(), mentions }, `Comentário adicionado ao processo ${selected.code}`);
    for (const mention of mentions) {
      const user = data.users.find((item) => item.username.toLowerCase() === mention.toLowerCase());
      if (user) await createRecord("notifications", { title: "Você foi mencionado", message: `Comentário em ${selected.code}`, recipientId: user.id, relatedType: "processes", relatedId: selected.id });
    }
    setComment(""); setToast("Comentário publicado.");
  };

  const doExport = async () => {
    exportToXlsx("processos-e-demandas", "Processos", filtered.map((item) => ({ ID: item.code, Título: item.title, Categoria: item.category, Status: item.status, Prioridade: item.priority, Responsável: data.users.find((user) => user.id === item.assigneeId)?.name ?? "", Município: data.territories.find((territory) => territory.id === item.territoryId)?.name ?? "", Prazo: item.dueDate ? new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "", Criado: new Date(item.createdAt).toLocaleDateString("pt-BR") })));
    await createRecord("audit", { action: "export", module: "processes", summary: `Exportação de ${filtered.length} processos`, deviceId: localStorage.getItem("central-campanha-device") ?? "browser", after: { filters: { search, status, priority } } }); setToast("Exportação concluída e auditada.");
  };

  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">ACOMPANHAMENTO</p><h1>Processos e Demandas</h1><p>Responsáveis, prazos e histórico preservados em cada demanda.</p></div>{can("processes", "create") && <button className="button primary" onClick={openCreate}><Plus size={18} /> Novo processo</button>}</header>
    <section className="panel table-panel"><TableToolbar search={search} onSearch={setSearch} placeholder="Buscar por número, título ou categoria" onExport={can("processes", "export") ? () => void doExport() : undefined}><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Todas as prioridades</option>{priorities.map((item) => <option key={item}>{item}</option>)}</select></TableToolbar>
      {filtered.length === 0 ? <EmptyState icon={<FileText size={38} />} title={processes.length === 0 ? "Nenhuma demanda registrada" : "Nenhum processo encontrado"} description={processes.length === 0 ? "Crie o primeiro processo para acompanhar uma solicitação do início à conclusão." : "Ajuste os filtros para ampliar os resultados."} action={can("processes", "create") && processes.length === 0 ? <button className="button primary" onClick={openCreate}><Plus size={17} /> Novo processo</button> : undefined} /> : <div className="responsive-table"><table><thead><tr><th>Processo</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{paged.map((item) => { const overdue = item.dueDate && !["Concluído", "Cancelado", "Arquivado"].includes(item.status) && new Date(`${item.dueDate}T23:59:59`) < new Date(); return <tr key={item.id} onClick={() => setSelected(item)}><td><span className="cell-stack"><small>{item.code}</small><strong>{item.title}</strong><em>{item.category}</em></span></td><td><span className={`status-badge status-${item.status.toLowerCase().replaceAll(" ", "-")}`}>{item.status}</span></td><td><span className={`priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span></td><td>{data.users.find((user) => user.id === item.assigneeId)?.name ?? "Não atribuído"}</td><td><span className={overdue ? "overdue" : ""}>{item.dueDate ? new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "Sem prazo"}{overdue && <AlertTriangle size={14} />}</span></td><td><button className="icon-button" onClick={(event) => { event.stopPropagation(); openEdit(item); }}><MoreHorizontal size={18} /></button></td></tr>; })}</tbody></table></div>}
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
    </section>
    {formOpen && <Modal title={editing ? `Editar ${editing.code}` : "Novo processo"} description={editing ? "A alteração será registrada no histórico." : `Identificador reservado: ${code}`} onClose={() => setFormOpen(false)} wide><form className="record-form" onSubmit={submit}><div className="form-grid"><label className="span-2">Título *<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="span-2">Descrição<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Demanda comunitária</option><option>Administrativo</option><option>Documento</option><option>Fornecedor</option><option>Evento</option><option>Jurídico</option><option>Pendência interna</option></select></label><label>Pessoa relacionada<select value={form.personId} onChange={(event) => setForm({ ...form, personId: event.target.value })}><option value="">Nenhuma</option>{data.people.filter((item) => !item.deletedAt).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label><label>Prioridade<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label><label>Responsável<select value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}><option value="">Não atribuído</option>{data.users.filter((item) => item.active && !item.deletedAt).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Equipe<input value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })} /></label><label>Território<select value={form.territoryId} onChange={(event) => setForm({ ...form, territoryId: event.target.value })}><option value="">Não informado</option>{data.territories.filter((item) => !item.deletedAt).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Prazo<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label className="span-2">Observações internas<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><footer className="modal-actions"><button type="button" className="button ghost" onClick={() => setFormOpen(false)}>Cancelar</button><button className="button primary">{editing ? "Salvar alterações" : "Criar processo"}</button></footer></form></Modal>}
    {selected && <Modal title={`${selected.code} — ${selected.title}`} description={`${selected.category} • ${selected.priority}`} onClose={() => setSelected(null)} wide><div className="process-hero"><div><small>Status atual</small><select value={selected.status} onChange={(event) => { const next = event.target.value; void updateRecord("processes", selected.id, { status: next }, `Status alterado de ${selected.status} para ${next}`); setSelected({ ...selected, status: next }); }}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div><div><small>Responsável</small><strong>{data.users.find((user) => user.id === selected.assigneeId)?.name ?? "Não atribuído"}</strong></div><div><small>Prazo</small><strong>{selected.dueDate ? new Date(`${selected.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "Sem prazo"}</strong></div><button className="icon-button favorite" onClick={() => void updateRecord("processes", selected.id, { favorite: !selected.favorite })}><Star size={20} fill={selected.favorite ? "currentColor" : "none"} /></button></div><section className="subsection"><h3>Descrição</h3><p>{selected.description || "Nenhuma descrição informada."}</p></section><div className="detail-columns"><section className="subsection"><h3>Histórico do processo</h3><div className="mini-timeline">{data.audit.filter((item) => item.recordId === selected.id).slice(0, 12).map((item) => <div key={item.id}><span /><p><strong>{item.summary}</strong><small>{new Date(item.createdAt).toLocaleString("pt-BR")} • {data.users.find((user) => user.id === item.createdBy)?.name ?? "Sistema"}</small></p></div>)}</div></section><section className="subsection"><h3>Comentários internos</h3><div className="comments">{data.comments.filter((item) => item.module === "processes" && item.recordId === selected.id && !item.deletedAt).map((item) => <div key={item.id}><span className="avatar small">{data.users.find((user) => user.id === item.createdBy)?.name.slice(0, 1) ?? "U"}</span><p><strong>{data.users.find((user) => user.id === item.createdBy)?.name ?? "Usuário"}</strong>{item.body}<small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></p></div>)}</div><div className="comment-box"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Escreva um comentário. Use @usuario para mencionar." rows={2} /><button className="icon-button" disabled={!comment.trim()} onClick={() => void addComment()}><Send size={17} /></button></div></section></div><footer className="modal-actions split"><button className="button danger-outline" onClick={() => setDeleteTarget(selected)}><Trash2 size={16} /> Arquivar na lixeira</button><button className="button primary" onClick={() => { openEdit(selected); setSelected(null); }}>Editar processo</button></footer></Modal>}
    {deleteTarget && <ConfirmDialog title="Mover processo para a lixeira?" message="O histórico será preservado e o registro poderá ser restaurado por quem tiver permissão." danger confirmLabel="Mover para lixeira" onClose={() => setDeleteTarget(null)} onConfirm={async () => { await softDelete("processes", deleteTarget.id); setDeleteTarget(null); setSelected(null); setToast("Processo movido para a lixeira."); }} />}
    {toast && <div className="toast success">{toast}</div>}
  </div>;
}
