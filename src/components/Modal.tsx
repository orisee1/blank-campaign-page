import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirmar", danger = false, onConfirm, onClose }: { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}><p className="confirm-copy">{message}</p><footer className="modal-actions"><button className="button ghost" onClick={onClose}>Cancelar</button><button className={`button ${danger ? "danger" : "primary"}`} onClick={() => void onConfirm()}>{confirmLabel}</button></footer></Modal>;
}
