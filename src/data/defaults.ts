import type { AppData, CampaignSettings, PermissionAction, RoleDefinition, UserRecord } from "../types";

export const CAMPAIGN_ID = "campaign-default";
export const MASTER_USER_ID = "user-master";
export const MASTER_ROLE_ID = "role-master";

const allActions: PermissionAction[] = ["view", "create", "edit", "delete", "restore", "export", "assign", "documents", "reports", "settings"];
const modules = ["dashboard", "people", "processes", "tasks", "calendar", "events", "team", "territory", "documents", "finance", "reports", "reminders", "privacy", "audit", "admin"];

const base = {
  campaignId: CAMPAIGN_ID,
  createdAt: "2026-08-31T00:00:00.000Z",
  createdBy: "system",
  updatedAt: "2026-08-31T00:00:00.000Z",
  updatedBy: "system",
  version: 1,
  syncStatus: "synced" as const,
};

const role = (id: string, name: string, description: string, allowed: string[], scope: RoleDefinition["scope"] = "all"): RoleDefinition => ({
  ...base,
  id,
  name,
  description,
  scope,
  permissions: Object.fromEntries(allowed.map((module) => [module, module === "admin" ? ["view"] : ["view", "create", "edit", "assign"]])) as Record<string, PermissionAction[]>,
});

export const defaultRoles: RoleDefinition[] = [
  { ...role(MASTER_ROLE_ID, "Administrador Master", "Acesso completo e administração sensível.", modules), permissions: Object.fromEntries(modules.map((module) => [module, allActions])) },
  role("role-candidate", "Candidata", "Visão estratégica, agenda e relatórios.", ["dashboard", "people", "processes", "tasks", "calendar", "events", "team", "territory", "documents", "reports", "reminders"]),
  role("role-general", "Coordenação Geral", "Gestão ampla da operação.", modules.filter((module) => module !== "admin")),
  role("role-regional", "Coordenação Regional", "Gestão das regiões atribuídas.", ["dashboard", "people", "processes", "tasks", "calendar", "events", "team", "territory", "documents", "reports", "reminders"], "region"),
  role("role-service", "Atendimento / Cadastro", "Pessoas, contatos e demandas autorizadas.", ["dashboard", "people", "processes", "tasks", "reminders"], "assigned"),
  role("role-events", "Eventos / Logística", "Agenda, eventos, equipes e checklists.", ["dashboard", "tasks", "calendar", "events", "team", "territory", "documents", "reminders"], "team"),
  role("role-legal", "Jurídico / Compliance", "Documentos, processos, auditoria e privacidade.", ["dashboard", "processes", "tasks", "calendar", "documents", "privacy", "audit", "reminders"]),
  role("role-finance", "Financeiro / Administrativo", "Despesas, fornecedores e relatórios administrativos.", ["dashboard", "tasks", "documents", "finance", "reports", "reminders"]),
  role("role-comms", "Comunicação", "Operações de comunicação autorizadas.", ["dashboard", "tasks", "calendar", "events", "documents", "reminders"], "assigned"),
  role("role-volunteer", "Voluntário", "Apenas tarefas e eventos atribuídos.", ["dashboard", "tasks", "events", "reminders"], "assigned"),
];

export const masterUser: UserRecord = {
  ...base,
  id: MASTER_USER_ID,
  username: "admin19",
  name: "Administrador Master",
  roleId: MASTER_ROLE_ID,
  active: true,
  regionIds: [],
  teamIds: [],
  permissionOverrides: {},
};

export const defaultSettings: CampaignSettings = {
  id: CAMPAIGN_ID,
  name: "Central de Campanha",
  candidateName: "Candidata",
  office: "Deputada Estadual",
  state: "",
  primaryColor: "#183f34",
  accentColor: "#e6a85c",
};

export const emptyData: AppData = {
  people: [], processes: [], tasks: [], calendar: [], events: [], team: [], territories: [], activities: [], documents: [], expenses: [], reminders: [], interactions: [],
  roles: defaultRoles, users: [masterUser], audit: [], privacyRequests: [], notifications: [], comments: [],
};
