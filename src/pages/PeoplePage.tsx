import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, MoreHorizontal, Plus, Search, Star, Trash2, Upload, UserRoundPlus, Users } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { Person } from "../types";
import { ConfirmDialog, Modal } from "../components/Modal";
import { EmptyState, Pagination, TableToolbar } from "../components/TableTools";
import { exportToXlsx, importSpreadsheet } from "../lib/export";

const PAGE_SIZE = 12;
const emptyPerson = { name: "", socialName: "", phone: "", whatsapp: "", email: "", city: "", neighborhood: "", profession: "", birthDate: "", origin: "Cadastro manual", notes: "", tags: "", groups: "", privacyBasis: "Legítimo interesse avaliado", privacyPurpose: "Gestão operacional da campanha", doNotContact: false };

export function PeoplePage() {
  const { data, visible, createRecord, updateRecord, softDelete, can, currentUser } = useApp();
  const [search, setSearch] = useState(() => sessionStorage.getItem("people-search") ?? "");
  const [city, setCity] = useState(() => sessionStorage.getItem("people-city") ?? "");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyPerson);
  const [editing, setEditing] = useState<Person | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [duplicateAccepted, setDuplicateAccepted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => { sessionStorage.setItem("people-search", search); sessionStorage.setItem("people-city", city); setPage(1); }, [search, city]);
  useEffect(() => { const listener = (event: Event) => { if ((event as CustomEvent).detail === "people") openCreate(); }; window.addEventListener("central:quick-new", listener); return () => window.removeEventListener("central:quick-new", listener); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2800); return () => clearTimeout(timer); }, [toast]);

  const people = visible(data.people);
  const cities = [...new Set(people.map((item) => item.city).filter(Boolean))] as string[];
  const filtered = people.filter((person) => {
    const term = search.toLocaleLowerCase("pt-BR");
    return (!term || `${person.name} ${person.email ?? ""} ${person.phone ?? ""} ${person.tags.join(" ")}`.toLocaleLowerCase("pt-BR").includes(term)) && (!city || person.city === city);
  });
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const duplicates = useMemo(() => data.people.filter((person) => !person.deletedAt && (!editing || person.id !== editing.id) && ((form.phone && person.phone === form.phone) || (form.email && person.email?.toLowerCase() === form.email.toLowerCase()) || (form.name.length > 4 && person.name.toLowerCase() === form.name.toLowerCase()))), [data.people, editing, form.email, form.name, form.phone]);

  function openCreate() { setEditing(null); setForm(emptyPerson); setDuplicateAccepted(false); setFormOpen(true); }
  function openEdit(person: Person) { setEditing(person); setForm({ ...emptyPerson, ...person, tags: person.tags.join(", "), groups: person.groups.join(", ") }); setDuplicateAccepted(false); setFormOpen(true); }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (duplicates.length > 0 && !duplicateAccepted) return;
    const payload = { ...form, tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean), groups: form.groups.split(",").map((item) => item.trim()).filter(Boolean), ownerId: editing?.ownerId ?? currentUser?.id };
    if (editing) await updateRecord("people", editing.id, payload, `Cadastro de ${form.name} atualizado`);
    else await createRecord("people", payload, `Pessoa ${form.name} cadastrada`);
    setFormOpen(false); setToast(editing ? "Cadastro atualizado com sucesso." : "Pessoa cadastrada. Os dados estão disponíveis offline.");
  };

  const doExport = async () => {
    exportToXlsx("pessoas-central-campanha", "Pessoas", filtered.map((person) => ({ Nome: person.name, "Nome social": person.socialName, Telefone: can("people", "documents") ? person.phone : "", WhatsApp: can("people", "documents") ? person.whatsapp : "", Email: can("people", "documents") ? person.email : "", Município: person.city, "Bairro/Região": person.neighborhood, Profissão: person.profession, Tags: person.tags.join(", "), Grupos: person.groups.join(", "), Origem: person.origin, "Não contatar": person.doNotContact ? "Sim" : "Não", Cadastro: new Date(person.createdAt).toLocaleDateString("pt-BR") })));
    await createRecord("audit", { action: "export", module: "people", summary: `Exportação de ${filtered.length} pessoas`, deviceId: localStorage.getItem("central-campanha-device") ?? "browser", after: { count: filtered.length, filters: { search, city } } });
    setToast("Arquivo XLSX gerado e exportação registrada.");
  };

  const confirmImport = async () => {
    let imported = 0;
    for (const row of importRows) {
      const name = String(row.Nome ?? row.nome ?? "").trim(); if (!name) continue;
      const phone = String(row.Telefone ?? row.telefone ?? "").trim(); const email = String(row.Email ?? row.email ?? "").trim();
      if (data.people.some((person) => (phone && person.phone === phone) || (email && person.email?.toLowerCase() === email.toLowerCase()))) continue;
      await createRecord("people", { ...emptyPerson, name, phone, email, city: String(row.Município ?? row.Municipio ?? row.cidade ?? ""), neighborhood: String(row.Bairro ?? row.bairro ?? ""), tags: [], groups: [], origin: "Importação XLSX/CSV", ownerId: currentUser?.id }, `Pessoa ${name} importada`); imported += 1;
    }
    await createRecord("audit", { action: "import", module: "people", summary: `Importação confirmada: ${imported} registros`, deviceId: localStorage.getItem("central-campanha-device") ?? "browser", after: { received: importRows.length, imported } });
    setImportOpen(false); setImportRows([]); setToast(`${imported} pessoas importadas; duplicidades foram ignoradas.`);
  };

  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">RELACIONAMENTO OPERACIONAL</p><h1>Pessoas</h1><p>Cadastros minimizados, histórico e privacidade em um só lugar.</p></div><div className="header-actions">{can("people", "create") && <button className="button ghost" onClick={() => setImportOpen(true)}><Upload size={17} /> Importar</button>}<button className="button primary" onClick={openCreate}><Plus size={18} /> Nova pessoa</button></div></header>
    <section className="panel table-panel"><TableToolbar search={search} onSearch={setSearch} placeholder="Buscar por nome, telefone, e-mail ou tag" onExport={can("people", "export") ? () => void doExport() : undefined}><select value={city} onChange={(event) => setCity(event.target.value)}><option value="">Todos os municípios</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></TableToolbar>
      {filtered.length === 0 ? <EmptyState icon={<Users size={38} />} title={people.length === 0 ? "Sua base começa aqui" : "Nenhuma pessoa encontrada"} description={people.length === 0 ? "Cadastre a primeira pessoa com apenas os dados necessários para a operação." : "Ajuste a busca ou remova os filtros aplicados."} action={people.length === 0 ? <button className="button primary" onClick={openCreate}><UserRoundPlus size={17} /> Cadastrar pessoa</button> : undefined} /> : <div className="responsive-table"><table><thead><tr><th>Pessoa</th><th>Contato</th><th>Território</th><th>Tags</th><th>Cadastro</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{paged.map((person) => <tr key={person.id} onClick={() => setSelected(person)}><td><div className="person-cell"><span className="avatar small">{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{person.name}</strong>{person.socialName && <small>Nome social: {person.socialName}</small>}</span>{person.favorite && <Star size={14} fill="currentColor" />}</div></td><td><span className="cell-stack">{person.phone || person.whatsapp || "—"}<small>{person.email || "Sem e-mail"}</small></span></td><td><span className="cell-stack">{person.city || "—"}<small>{person.neighborhood || "Sem bairro"}</small></span></td><td><div className="tag-list">{person.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}{person.tags.length > 2 && <span>+{person.tags.length - 2}</span>}</div></td><td>{new Date(person.createdAt).toLocaleDateString("pt-BR")}</td><td><button className="icon-button" onClick={(event) => { event.stopPropagation(); openEdit(person); }}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>}
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
    </section>

    {formOpen && <Modal title={editing ? "Editar pessoa" : "Nova pessoa"} description="Colete somente os dados necessários para a finalidade informada." onClose={() => setFormOpen(false)} wide><form className="record-form" onSubmit={submit}><div className="form-grid"><label className="span-2">Nome completo *<input value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setDuplicateAccepted(false); }} required /></label><label>Nome social<input value={form.socialName} onChange={(event) => setForm({ ...form, socialName: event.target.value })} /></label><label>Telefone<input value={form.phone} onChange={(event) => { setForm({ ...form, phone: event.target.value }); setDuplicateAccepted(false); }} /></label><label>WhatsApp<input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => { setForm({ ...form, email: event.target.value }); setDuplicateAccepted(false); }} /></label><label>Município<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label>Bairro / Região<input value={form.neighborhood} onChange={(event) => setForm({ ...form, neighborhood: event.target.value })} /></label><label>Profissão<input value={form.profession} onChange={(event) => setForm({ ...form, profession: event.target.value })} /></label><label>Data de nascimento<input type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label><label>Origem do cadastro<input value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} /></label><label>Tags <small>separadas por vírgula</small><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label><label>Grupos <small>separados por vírgula</small><input value={form.groups} onChange={(event) => setForm({ ...form, groups: event.target.value })} /></label><label>Base de tratamento<select value={form.privacyBasis} onChange={(event) => setForm({ ...form, privacyBasis: event.target.value })}><option>Legítimo interesse avaliado</option><option>Consentimento</option><option>Cumprimento de obrigação legal</option><option>Execução de contrato</option><option>Outra base documentada</option></select></label><label>Finalidade<input value={form.privacyPurpose} onChange={(event) => setForm({ ...form, privacyPurpose: event.target.value })} /></label><label className="span-2">Observações<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="check-label span-2"><input type="checkbox" checked={form.doNotContact} onChange={(event) => setForm({ ...form, doNotContact: event.target.checked })} /> Pessoa solicitou não receber contato</label></div>{duplicates.length > 0 && !duplicateAccepted && <div className="duplicate-warning"><Search size={20} /><div><strong>Possível cadastro duplicado encontrado</strong><p>{duplicates.map((item) => item.name).join(", ")}. Revise antes de continuar.</p><div><button type="button" className="button ghost compact" onClick={() => { setSelected(duplicates[0]); setFormOpen(false); }}>Abrir existente</button><button type="button" className="text-button" onClick={() => setDuplicateAccepted(true)}>Continuar mesmo assim</button></div></div></div>}<footer className="modal-actions"><button type="button" className="button ghost" onClick={() => setFormOpen(false)}>Cancelar</button><button className="button primary" disabled={duplicates.length > 0 && !duplicateAccepted}>{editing ? "Salvar alterações" : "Salvar pessoa"}</button></footer></form></Modal>}

    {selected && <Modal title={selected.name} description={`${selected.city || "Município não informado"}${selected.neighborhood ? ` • ${selected.neighborhood}` : ""}`} onClose={() => setSelected(null)} wide><div className="profile-summary"><span className="avatar large">{selected.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><h3>{selected.socialName || selected.name}</h3><p>{selected.phone || "Sem telefone"} • {selected.email || "Sem e-mail"}</p><div className="tag-list">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><button className="icon-button favorite" aria-label="Favoritar" onClick={() => void updateRecord("people", selected.id, { favorite: !selected.favorite })}><Star size={20} fill={selected.favorite ? "currentColor" : "none"} /></button></div><div className="detail-grid"><div><small>Origem</small><strong>{selected.origin || "Não informada"}</strong></div><div><small>Finalidade</small><strong>{selected.privacyPurpose || "Não informada"}</strong></div><div><small>Base de tratamento</small><strong>{selected.privacyBasis || "Não informada"}</strong></div><div><small>Contato</small><strong>{selected.doNotContact ? "Não contatar" : "Permitido conforme finalidade"}</strong></div></div><section className="subsection"><h3>Histórico</h3>{data.audit.filter((item) => item.recordId === selected.id).length === 0 ? <p className="muted">Nenhuma atividade registrada.</p> : <div className="mini-timeline">{data.audit.filter((item) => item.recordId === selected.id).slice(0, 10).map((item) => <div key={item.id}><span /><p><strong>{item.summary}</strong><small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></p></div>)}</div>}</section><footer className="modal-actions split"><button className="button danger-outline" onClick={() => setDeleteTarget(selected)}><Trash2 size={16} /> Mover para lixeira</button><button className="button primary" onClick={() => { openEdit(selected); setSelected(null); }}>Editar cadastro</button></footer></Modal>}

    {deleteTarget && <ConfirmDialog title="Mover cadastro para a lixeira?" message="O cadastro não será apagado definitivamente e poderá ser restaurado por um usuário autorizado. A ação ficará registrada na auditoria." confirmLabel="Mover para lixeira" danger onClose={() => setDeleteTarget(null)} onConfirm={async () => { await softDelete("people", deleteTarget.id); setDeleteTarget(null); setSelected(null); setToast("Cadastro movido para a lixeira."); }} />}
    {importOpen && <Modal title="Importar pessoas" description="Revise a prévia antes de confirmar. Duplicidades por telefone ou e-mail não serão importadas." onClose={() => { setImportOpen(false); setImportRows([]); }} wide>{importRows.length === 0 ? <label className="upload-zone"><FileSpreadsheet size={38} /><strong>Selecione um arquivo XLSX ou CSV</strong><span>Colunas reconhecidas: Nome, Telefone, Email, Município e Bairro.</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSpreadsheet(file).then(setImportRows); }} /></label> : <><div className="import-summary"><strong>{importRows.length} linhas encontradas</strong><span>{importRows.filter((row) => !String(row.Nome ?? row.nome ?? "").trim()).length} sem nome serão ignoradas</span></div><div className="responsive-table import-preview"><table><thead><tr>{Object.keys(importRows[0]).slice(0, 6).map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{importRows.slice(0, 5).map((row, index) => <tr key={index}>{Object.keys(importRows[0]).slice(0, 6).map((key) => <td key={key}>{String(row[key] ?? "")}</td>)}</tr>)}</tbody></table></div><footer className="modal-actions"><button className="button ghost" onClick={() => setImportRows([])}>Escolher outro</button><button className="button primary" onClick={() => void confirmImport()}>Confirmar importação</button></footer></>}</Modal>}
    {toast && <div className="toast success">{toast}</div>}
  </div>;
}
