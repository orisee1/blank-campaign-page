PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, candidate_name TEXT NOT NULL, office TEXT NOT NULL,
  party TEXT, election_number TEXT, state TEXT, settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), name TEXT NOT NULL,
  description TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('all','region','team','assigned','specific')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(campaign_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, module TEXT NOT NULL, action TEXT NOT NULL, UNIQUE(module, action)
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id), permission_id TEXT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY(role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), role_id TEXT NOT NULL REFERENCES roles(id),
  username TEXT NOT NULL, name TEXT NOT NULL, email TEXT, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, failed_attempts INTEGER NOT NULL DEFAULT 0, blocked_until TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  deleted_at TEXT, UNIQUE(campaign_id, username)
);
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id TEXT NOT NULL REFERENCES users(id), permission_id TEXT NOT NULL REFERENCES permissions(id), allowed INTEGER NOT NULL,
  PRIMARY KEY(user_id, permission_id)
);
CREATE TABLE IF NOT EXISTS user_scopes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT, user_agent TEXT, ip_hash TEXT, expires_at TEXT NOT NULL, revoked_at TEXT,
  created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), label TEXT, last_seen_at TEXT NOT NULL,
  trusted_until TEXT, revoked_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS territories (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), parent_id TEXT REFERENCES territories(id),
  type TEXT NOT NULL, name TEXT NOT NULL, state_code TEXT, created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_territories_campaign_parent ON territories(campaign_id, parent_id);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), name TEXT NOT NULL, social_name TEXT,
  phone TEXT, whatsapp TEXT, email TEXT, birth_date TEXT, profession TEXT, city TEXT, neighborhood TEXT,
  address TEXT, origin TEXT, notes TEXT, privacy_basis TEXT, privacy_purpose TEXT, do_not_contact INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT REFERENCES users(id), region_id TEXT REFERENCES territories(id), tags_json TEXT NOT NULL DEFAULT '[]', groups_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_people_campaign_city ON people(campaign_id, city);
CREATE INDEX IF NOT EXISTS idx_people_campaign_phone ON people(campaign_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_campaign_email ON people(campaign_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_region ON people(campaign_id, region_id);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), person_id TEXT NOT NULL REFERENCES people(id),
  type TEXT NOT NULL, occurred_at TEXT NOT NULL, subject TEXT NOT NULL, summary TEXT, result TEXT,
  next_action TEXT, next_action_at TEXT, assignee_id TEXT REFERENCES users(id), created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), code TEXT NOT NULL, title TEXT NOT NULL,
  description TEXT, category TEXT NOT NULL, person_id TEXT REFERENCES people(id), territory_id TEXT REFERENCES territories(id),
  assignee_id TEXT REFERENCES users(id), team TEXT, priority TEXT NOT NULL, status TEXT NOT NULL, due_date TEXT,
  completed_at TEXT, notes TEXT, favorite INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT, UNIQUE(campaign_id, code)
);
CREATE INDEX IF NOT EXISTS idx_processes_campaign_status_due ON processes(campaign_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_processes_assignee ON processes(campaign_id, assignee_id, status);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), title TEXT NOT NULL, description TEXT,
  assignee_id TEXT REFERENCES users(id), team TEXT, priority TEXT NOT NULL, status TEXT NOT NULL, due_date TEXT,
  checklist_json TEXT NOT NULL DEFAULT '[]', process_id TEXT REFERENCES processes(id), event_id TEXT,
  person_id TEXT REFERENCES people(id), reminder_at TEXT, created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status_due ON tasks(campaign_id, assignee_id, status, due_date);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), title TEXT NOT NULL, type TEXT NOT NULL,
  description TEXT, start_at TEXT NOT NULL, end_at TEXT NOT NULL, location TEXT, address TEXT,
  territory_id TEXT REFERENCES territories(id), participants_json TEXT NOT NULL DEFAULT '[]', assignee_id TEXT REFERENCES users(id),
  notes TEXT, created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_calendar_campaign_start ON calendar_events(campaign_id, start_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), name TEXT NOT NULL, description TEXT,
  start_at TEXT NOT NULL, end_at TEXT, address TEXT, territory_id TEXT REFERENCES territories(id), neighborhood TEXT,
  assignee_id TEXT REFERENCES users(id), team_json TEXT NOT NULL DEFAULT '[]', suppliers_json TEXT NOT NULL DEFAULT '[]',
  internal_budget REAL, status TEXT NOT NULL, checklist_json TEXT NOT NULL DEFAULT '[]', participant_count INTEGER,
  report TEXT, created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_campaign_start ON events(campaign_id, start_at);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), person_id TEXT REFERENCES people(id),
  name TEXT NOT NULL, role TEXT NOT NULL, territory_id TEXT REFERENCES territories(id), availability TEXT,
  assignee_id TEXT REFERENCES users(id), team TEXT, status TEXT NOT NULL, notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), title TEXT NOT NULL, type TEXT NOT NULL,
  date TEXT NOT NULL, territory_id TEXT REFERENCES territories(id), team TEXT, assignee_id TEXT REFERENCES users(id),
  event_id TEXT REFERENCES events(id), notes TEXT, created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), name TEXT NOT NULL, description TEXT,
  category TEXT NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]', assignee_id TEXT REFERENCES users(id),
  related_type TEXT, related_id TEXT, object_key TEXT, size INTEGER, mime_type TEXT, access_level TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), description TEXT NOT NULL, category TEXT NOT NULL,
  supplier TEXT, amount REAL NOT NULL, date TEXT NOT NULL, payment_method TEXT, assignee_id TEXT REFERENCES users(id),
  event_id TEXT REFERENCES events(id), cost_center TEXT, notes TEXT, created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), title TEXT NOT NULL, type TEXT NOT NULL,
  due_at TEXT NOT NULL, assignee_id TEXT REFERENCES users(id), related_type TEXT, related_id TEXT, done INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), title TEXT NOT NULL, message TEXT NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES users(id), related_type TEXT, related_id TEXT, read_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_id, read_at, created_at);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), module TEXT NOT NULL, record_id TEXT NOT NULL,
  body TEXT NOT NULL, mentions_json TEXT NOT NULL DEFAULT '[]', created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), person_id TEXT REFERENCES people(id),
  type TEXT NOT NULL, status TEXT NOT NULL, request TEXT NOT NULL, assignee_id TEXT REFERENCES users(id), result TEXT,
  created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL, module TEXT NOT NULL, record_id TEXT, summary TEXT NOT NULL, before_json TEXT, after_json TEXT,
  device_id TEXT, ip_hash TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_campaign_created ON audit_logs(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), collection TEXT NOT NULL, record_id TEXT NOT NULL,
  server_version INTEGER NOT NULL, client_version INTEGER NOT NULL, server_json TEXT NOT NULL, client_json TEXT NOT NULL,
  device_id TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT, resolved_by TEXT REFERENCES users(id)
);

INSERT OR IGNORE INTO campaigns(id, name, candidate_name, office, created_at, updated_at)
VALUES('campaign-default', 'Central de Campanha', 'Candidata', 'Deputada Estadual', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO roles(id, campaign_id, name, description, scope, created_at, updated_at)
VALUES('role-master', 'campaign-default', 'Administrador Master', 'Acesso completo', 'all', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO users(id, campaign_id, role_id, username, name, password_salt, password_hash, active, must_change_password, created_at, updated_at)
VALUES('user-master', 'campaign-default', 'role-master', 'admin19', 'Administrador Master', 'f1eff2d0fa60a2ececd8b6f192f388cb', '18245a5cef345bfc7c58a54c640e3c401ab4e378c1fc885060729b3df5e2583b', 1, 1, datetime('now'), datetime('now'));

PRAGMA optimize;
