import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, WifiOff } from "lucide-react";
import { useApp } from "../context/AppContext";
import { getMeta, setMeta } from "../lib/db";
import { sessionStorageKey, verifyBootstrapCredentials, verifyPassword } from "../lib/auth";

interface Attempts { count: number; blockedUntil?: number }
interface Credential { username: string; salt: string; hash: string }
type CredentialMap = Record<string, { salt: string; hash: string }>;

export function LoginPage() {
  const { data, setCurrentUser, online, createRecord } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const attempts = await getMeta<Attempts>("login-attempts") ?? { count: 0 };
      if (attempts.blockedUntil && attempts.blockedUntil > Date.now()) {
        setError(`Acesso temporariamente bloqueado. Tente novamente às ${new Date(attempts.blockedUntil).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`); return;
      }
      const user = data.users.find((item) => item.username.toLowerCase() === username.trim().toLowerCase());
      const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
      let valid = false;
      if (apiUrl && online) {
        const response = await fetch(`${apiUrl}/api/auth/login`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, remember }) });
        valid = response.ok;
      } else {
        if (user?.id === "user-master") {
          const saved = await getMeta<Credential>("master-credential");
          valid = saved ? saved.username === username.trim().toLowerCase() && await verifyPassword(password, saved.salt, saved.hash) : await verifyBootstrapCredentials(username, password);
        } else if (user) {
          const credentials = await getMeta<CredentialMap>("user-credentials") ?? {};
          const saved = credentials[user.id]; valid = Boolean(saved && await verifyPassword(password, saved.salt, saved.hash));
        }
      }
      if (!valid || !user?.active) {
        const count = attempts.count + 1;
        const blockedUntil = count >= 5 ? Date.now() + 15 * 60_000 : undefined;
        await setMeta("login-attempts", { count: blockedUntil ? 0 : count, blockedUntil });
        setError(blockedUntil ? "Muitas tentativas. O acesso foi bloqueado por 15 minutos." : "Usuário ou senha inválidos."); return;
      }
      await setMeta("login-attempts", { count: 0 });
      const session = JSON.stringify({ userId: user.id, expiresAt: Date.now() + (remember ? 30 : 0.5) * 24 * 60 * 60_000 });
      (remember ? localStorage : sessionStorage).setItem(sessionStorageKey, session);
      await createRecord("audit", { action: "login", module: "auth", summary: "Login realizado", deviceId: localStorage.getItem("central-campanha-device") ?? "browser" });
      setCurrentUser(user);
    } catch { setError("Não foi possível concluir o acesso. Verifique a conexão e tente novamente."); }
    finally { setBusy(false); }
  };

  return <main className="login-shell">
    <section className="login-story">
      <div className="login-brand"><span className="brand-mark">CC</span><span>Central de Campanha</span></div>
      <div className="story-copy"><p className="eyebrow">OPERAÇÃO EM UM SÓ LUGAR</p><h1>Decisões claras.<br />Equipe coordenada.<br />Território em movimento.</h1><p>Uma central segura para organizar pessoas, demandas, tarefas, agenda e atividades da campanha — mesmo quando a internet falha.</p></div>
      <div className="security-note"><ShieldCheck size={22} /><div><strong>Privacidade por padrão</strong><span>Permissões, escopo e auditoria em cada operação.</span></div></div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand"><span className="brand-mark">CC</span><span>Central de Campanha</span></div>
        <div><p className="eyebrow">ACESSO RESTRITO</p><h2>Bem-vindo de volta</h2><p>Entre com suas credenciais autorizadas.</p></div>
        {!online && <div className="offline-message"><WifiOff size={18} /><span>Sem internet. O acesso local está disponível apenas neste dispositivo autorizado.</span></div>}
        <label>Usuário ou e-mail<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required placeholder="Digite seu usuário" /></label>
        <label>Senha<div className="password-field"><input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Digite sua senha" /><button type="button" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <div className="form-row"><label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Lembrar sessão</label><button type="button" className="text-button" onClick={() => setError("Solicite a redefinição de acesso a um Administrador Master.")}>Recuperar acesso</button></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary large" disabled={busy}>{busy ? "Verificando…" : <><LockKeyhole size={18} /> Entrar com segurança</>}</button>
        <p className="login-footer">Sistema interno. Todas as ações relevantes são registradas.</p>
      </form>
    </section>
  </main>;
}
