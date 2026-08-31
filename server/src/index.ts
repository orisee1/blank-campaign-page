interface Env { DB: D1Database; ALLOWED_ORIGIN: string; SESSION_TTL_HOURS?: string }
interface SessionUser { id: string; campaign_id: string; role_id: string; username: string; name: string; scope: string }

const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);

async function passwordHash(password: string, saltHex: string) {
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210_000 }, key, 256));
}

const cors = (request: Request, env: Env) => ({
  "access-control-allow-origin": request.headers.get("origin") === env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN : "null",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type,x-device-id",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  vary: "Origin",
});
const json = (request: Request, env: Env, body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors(request, env), ...headers } });

async function authenticate(request: Request, env: Env): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") ?? ""; const token = cookie.match(/(?:^|; )cc_session=([^;]+)/)?.[1];
  if (!token) return null; const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT u.id, u.campaign_id, u.role_id, u.username, u.name, r.scope
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at > datetime('now') AND u.active=1 AND u.deleted_at IS NULL`).bind(tokenHash).first<SessionUser>();
  if (row) await env.DB.prepare("UPDATE sessions SET last_seen_at=datetime('now') WHERE token_hash=?").bind(tokenHash).run();
  return row ?? null;
}

async function allowed(env: Env, user: SessionUser, module: string, action: string) {
  if (user.role_id === "role-master") return true;
  const override = await env.DB.prepare(`SELECT up.allowed FROM user_permissions up JOIN permissions p ON p.id=up.permission_id WHERE up.user_id=? AND p.module=? AND p.action=?`).bind(user.id, module, action).first<{ allowed: number }>();
  if (override) return override.allowed === 1;
  return Boolean(await env.DB.prepare(`SELECT 1 ok FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=? AND p.module=? AND p.action=?`).bind(user.role_id, module, action).first());
}

const tableMap: Record<string, { table: string; module: string }> = {
  people: { table: "people", module: "people" }, processes: { table: "processes", module: "processes" }, tasks: { table: "tasks", module: "tasks" },
  calendar: { table: "calendar_events", module: "calendar" }, events: { table: "events", module: "events" }, team: { table: "team_members", module: "team" },
  territories: { table: "territories", module: "territory" }, activities: { table: "activities", module: "territory" }, documents: { table: "documents", module: "documents" },
  expenses: { table: "expenses", module: "finance" }, reminders: { table: "reminders", module: "reminders" }, notifications: { table: "notifications", module: "dashboard" },
  comments: { table: "comments", module: "processes" }, privacyRequests: { table: "privacy_requests", module: "privacy" }, interactions: { table: "interactions", module: "people" },
};

const fields: Record<string, Record<string, string>> = {
  people: { name: "name", socialName: "social_name", phone: "phone", whatsapp: "whatsapp", email: "email", birthDate: "birth_date", profession: "profession", city: "city", neighborhood: "neighborhood", origin: "origin", notes: "notes", privacyBasis: "privacy_basis", privacyPurpose: "privacy_purpose", doNotContact: "do_not_contact", ownerId: "owner_id", regionId: "region_id", tags: "tags_json", groups: "groups_json" },
  processes: { code: "code", title: "title", description: "description", category: "category", personId: "person_id", territoryId: "territory_id", assigneeId: "assignee_id", team: "team", priority: "priority", status: "status", dueDate: "due_date", completedAt: "completed_at", notes: "notes", favorite: "favorite" },
  tasks: { title: "title", description: "description", assigneeId: "assignee_id", team: "team", priority: "priority", status: "status", dueDate: "due_date", checklist: "checklist_json", processId: "process_id", eventId: "event_id", personId: "person_id", reminderAt: "reminder_at" },
  calendar: { title: "title", type: "type", description: "description", startAt: "start_at", endAt: "end_at", location: "location", address: "address", territoryId: "territory_id", participants: "participants_json", assigneeId: "assignee_id", notes: "notes" },
  events: { name: "name", description: "description", startAt: "start_at", endAt: "end_at", address: "address", territoryId: "territory_id", neighborhood: "neighborhood", assigneeId: "assignee_id", team: "team_json", suppliers: "suppliers_json", internalBudget: "internal_budget", status: "status", checklist: "checklist_json", participantCount: "participant_count", report: "report" },
  team: { personId: "person_id", name: "name", role: "role", territoryId: "territory_id", availability: "availability", assigneeId: "assignee_id", team: "team", status: "status", notes: "notes" },
  territories: { parentId: "parent_id", type: "type", name: "name", stateCode: "state_code" }, activities: { title: "title", type: "type", date: "date", territoryId: "territory_id", team: "team", assigneeId: "assignee_id", eventId: "event_id", notes: "notes" },
  documents: { name: "name", description: "description", category: "category", tags: "tags_json", assigneeId: "assignee_id", relatedType: "related_type", relatedId: "related_id", size: "size", mimeType: "mime_type", accessLevel: "access_level" },
  expenses: { description: "description", category: "category", supplier: "supplier", amount: "amount", date: "date", paymentMethod: "payment_method", assigneeId: "assignee_id", eventId: "event_id", costCenter: "cost_center", notes: "notes" },
  reminders: { title: "title", type: "type", dueAt: "due_at", assigneeId: "assignee_id", relatedType: "related_type", relatedId: "related_id", done: "done" },
  notifications: { title: "title", message: "message", recipientId: "recipient_id", relatedType: "related_type", relatedId: "related_id", readAt: "read_at" },
  comments: { module: "module", recordId: "record_id", body: "body", mentions: "mentions_json" }, privacyRequests: { personId: "person_id", type: "type", status: "status", request: "request", assigneeId: "assignee_id", result: "result" },
  interactions: { personId: "person_id", type: "type", occurredAt: "occurred_at", subject: "subject", summary: "summary", result: "result", nextAction: "next_action", nextActionAt: "next_action_at", assigneeId: "assignee_id" },
};

const dbValue = (column: string, value: unknown) => column.endsWith("_json") ? JSON.stringify(value ?? []) : typeof value === "boolean" ? (value ? 1 : 0) : value ?? null;

async function syncChange(env: Env, user: SessionUser, change: { collection: string; record: Record<string, unknown> }, deviceId: string) {
  const mapping = tableMap[change.collection]; if (!mapping) return { id: change.record.id, status: "ignored" };
  const existing = await env.DB.prepare(`SELECT version, updated_at FROM ${mapping.table} WHERE id=? AND campaign_id=?`).bind(change.record.id, user.campaign_id).first<{ version: number; updated_at: string }>();
  if (!await allowed(env, user, mapping.module, existing ? "edit" : "create")) return { id: change.record.id, status: "forbidden" };
  const clientVersion = Number(change.record.version ?? 1);
  if (existing && existing.version >= clientVersion && existing.updated_at !== change.record.updatedAt) {
    const conflictId = crypto.randomUUID(); const server = await env.DB.prepare(`SELECT * FROM ${mapping.table} WHERE id=?`).bind(change.record.id).first();
    await env.DB.prepare("INSERT INTO sync_conflicts(id,campaign_id,collection,record_id,server_version,client_version,server_json,client_json,device_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))").bind(conflictId, user.campaign_id, change.collection, change.record.id, existing.version, clientVersion, JSON.stringify(server), JSON.stringify(change.record), deviceId).run();
    return { id: change.record.id, status: "conflict", conflictId, server };
  }
  const map = fields[change.collection]; const domainEntries = Object.entries(map).filter(([key]) => key in change.record);
  const standard = { id: change.record.id, campaign_id: user.campaign_id, created_by: change.record.createdBy ?? user.id, updated_by: user.id, created_at: change.record.createdAt ?? new Date().toISOString(), updated_at: change.record.updatedAt ?? new Date().toISOString(), version: clientVersion, deleted_at: change.record.deletedAt ?? null };
  const entries = [...Object.entries(standard), ...domainEntries.map(([key, column]) => [column, dbValue(column, change.record[key])] as [string, unknown])];
  const columns = entries.map(([column]) => column); const values = entries.map(([, value]) => value);
  const updates = columns.filter((column) => !["id", "campaign_id", "created_by", "created_at"].includes(column)).map((column) => `${column}=excluded.${column}`).join(",");
  await env.DB.prepare(`INSERT INTO ${mapping.table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${updates}`).bind(...values).run();
  await env.DB.prepare("INSERT INTO audit_logs(id,campaign_id,user_id,action,module,record_id,summary,after_json,device_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))").bind(crypto.randomUUID(), user.campaign_id, user.id, existing ? "sync_update" : "sync_create", mapping.module, change.record.id, `Sincronização ${change.collection}`, JSON.stringify(change.record), deviceId).run();
  return { id: change.record.id, status: "synced", version: clientVersion };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url); const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") return new Response(null, { status: origin === env.ALLOWED_ORIGIN ? 204 : 403, headers: cors(request, env) });
    if (origin && origin !== env.ALLOWED_ORIGIN) return json(request, env, { error: "origin_not_allowed" }, 403);
    if (url.pathname === "/health") return json(request, env, { ok: true, time: new Date().toISOString() });
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const { username, password, remember, deviceId } = await request.json<{ username: string; password: string; remember?: boolean; deviceId?: string }>();
      const user = await env.DB.prepare("SELECT * FROM users WHERE campaign_id='campaign-default' AND lower(username)=lower(?) AND deleted_at IS NULL").bind(username.trim()).first<Record<string, unknown>>();
      if (!user || Number(user.active) !== 1) return json(request, env, { error: "invalid_credentials" }, 401);
      if (user.blocked_until && new Date(String(user.blocked_until)) > new Date()) return json(request, env, { error: "temporarily_blocked" }, 423);
      const valid = await passwordHash(password, String(user.password_salt)) === user.password_hash;
      if (!valid) { const attempts = Number(user.failed_attempts) + 1; await env.DB.prepare("UPDATE users SET failed_attempts=?,blocked_until=CASE WHEN ?>=5 THEN datetime('now','+15 minutes') ELSE NULL END WHERE id=?").bind(attempts >= 5 ? 0 : attempts, attempts, user.id).run(); return json(request, env, { error: "invalid_credentials" }, 401); }
      await env.DB.prepare("UPDATE users SET failed_attempts=0,blocked_until=NULL WHERE id=?").bind(user.id).run();
      const token = randomToken(); const hours = remember ? Math.min(720, Number(env.SESSION_TTL_HOURS ?? 12) * 30) : Number(env.SESSION_TTL_HOURS ?? 12); const expires = new Date(Date.now() + hours * 3_600_000);
      await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,device_id,user_agent,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?,datetime('now'),datetime('now'))").bind(crypto.randomUUID(), user.id, await sha256(token), deviceId ?? "browser", request.headers.get("user-agent"), expires.toISOString()).run();
      await env.DB.prepare("INSERT INTO audit_logs(id,campaign_id,user_id,action,module,summary,device_id,created_at) VALUES(?,?,?,?,?,?,?,datetime('now'))").bind(crypto.randomUUID(), user.campaign_id, user.id, "login", "auth", "Login realizado", deviceId ?? "browser").run();
      return json(request, env, { user: { id: user.id, username: user.username, name: user.name, roleId: user.role_id }, expiresAt: expires.toISOString(), mustChangePassword: Boolean(user.must_change_password) }, 200, { "set-cookie": `cc_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Expires=${expires.toUTCString()}` });
    }
    const user = await authenticate(request, env); if (!user) return json(request, env, { error: "unauthorized" }, 401);
    if (url.pathname === "/api/auth/logout" && request.method === "POST") { const token = (request.headers.get("cookie") ?? "").match(/(?:^|; )cc_session=([^;]+)/)?.[1]; if (token) await env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE token_hash=?").bind(await sha256(token)).run(); return json(request, env, { ok: true }, 200, { "set-cookie": "cc_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0" }); }
    if (url.pathname === "/api/me") return json(request, env, { user });
    if (url.pathname === "/api/sync" && request.method === "POST") {
      const { changes = [], deviceId = "browser" } = await request.json<{ changes: { collection: string; record: Record<string, unknown> }[]; deviceId?: string }>();
      if (!Array.isArray(changes) || changes.length > 500) return json(request, env, { error: "invalid_batch" }, 400);
      const results = []; for (const change of changes) results.push(await syncChange(env, user, change, deviceId));
      return json(request, env, { results, serverTime: new Date().toISOString() });
    }
    return json(request, env, { error: "not_found" }, 404);
  },
};
