import { ChevronLeft, ChevronRight, Download, Filter, Search } from "lucide-react";
import type { ReactNode } from "react";

export function TableToolbar({ search, onSearch, placeholder, onExport, onFilter, children }: { search: string; onSearch: (value: string) => void; placeholder: string; onExport?: () => void; onFilter?: () => void; children?: ReactNode }) {
  return <div className="table-toolbar"><div className="table-search"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} /></div>{children}<div className="toolbar-spacer" />{onFilter && <button className="button ghost compact" onClick={onFilter}><Filter size={16} /> Filtros</button>}{onExport && <button className="button ghost compact" onClick={onExport}><Download size={16} /> Exportar</button>}</div>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <footer className="pagination"><span>{total === 0 ? "Nenhum registro" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}</span><div><button className="icon-button" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={17} /></button><span>Página {page} de {pages}</span><button className="icon-button" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={17} /></button></div></footer>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="table-empty">{icon}<h3>{title}</h3><p>{description}</p>{action}</div>;
}
