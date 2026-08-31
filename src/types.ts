export type SyncStatus = "synced" | "pending" | "syncing" | "conflict" | "error";
export type Priority = "Baixa" | "Normal" | "Alta" | "Urgente";

export interface BaseRecord {
  id: string;
  campaignId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  syncStatus: SyncStatus;
  deletedAt?: string;
}

export interface Person extends BaseRecord {
  name: string;
  socialName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  neighborhood?: string;
  profession?: string;
  birthDate?: string;
  origin?: string;
  notes?: string;
  tags: string[];
  groups: string[];
  privacyBasis?: string;
  privacyPurpose?: string;
  doNotContact: boolean;
  ownerId?: string;
  regionId?: string;
  favorite?: boolean;
}

export interface ProcessRecord extends BaseRecord {
  code: string;
  title: string;
  description?: string;
  category: string;
  personId?: string;
  territoryId?: string;
  assigneeId?: string;
  team?: string;
  priority: Priority;
  status: string;
  dueDate?: string;
  completedAt?: string;
  notes?: string;
  favorite?: boolean;
}

export interface TaskRecord extends BaseRecord {
  title: string;
  description?: string;
  assigneeId?: string;
  team?: string;
  priority: Priority;
  status: "A fazer" | "Em andamento" | "Aguardando" | "Concluído";
  dueDate?: string;
  checklist: { id: string; text: string; done: boolean }[];
  processId?: string;
  eventId?: string;
  personId?: string;
  reminderAt?: string;
}

export interface CalendarEntry extends BaseRecord {
  title: string;
  type: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  address?: string;
  territoryId?: string;
  participants: string[];
  assigneeId?: string;
  notes?: string;
}

export interface CampaignEvent extends BaseRecord {
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  address?: string;
  territoryId?: string;
  neighborhood?: string;
  assigneeId?: string;
  team: string[];
  suppliers: string[];
  internalBudget?: number;
  status: "Planejamento" | "Confirmado" | "Em andamento" | "Realizado" | "Cancelado";
  checklist: { id: string; text: string; done: boolean }[];
  participantCount?: number;
  report?: string;
}

export interface TeamMember extends BaseRecord {
  personId?: string;
  name: string;
  role: string;
  territoryId?: string;
  availability?: string;
  assigneeId?: string;
  team?: string;
  status: "Ativo" | "Temporariamente indisponível" | "Inativo";
  notes?: string;
}

export interface Territory extends BaseRecord {
  name: string;
  type: "Estado" | "Município" | "Bairro/Região";
  parentId?: string;
  stateCode?: string;
}

export interface Activity extends BaseRecord {
  title: string;
  type: string;
  date: string;
  territoryId?: string;
  team?: string;
  assigneeId?: string;
  eventId?: string;
  notes?: string;
}

export interface DocumentRecord extends BaseRecord {
  name: string;
  description?: string;
  category: string;
  tags: string[];
  assigneeId?: string;
  relatedType?: string;
  relatedId?: string;
  size?: number;
  mimeType?: string;
  localBlobId?: string;
  accessLevel: "Geral" | "Restrito" | "Jurídico" | "Financeiro";
}

export interface Expense extends BaseRecord {
  description: string;
  category: string;
  supplier?: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  assigneeId?: string;
  eventId?: string;
  costCenter?: string;
  notes?: string;
}

export interface Reminder extends BaseRecord {
  title: string;
  type: string;
  dueAt: string;
  assigneeId?: string;
  relatedType?: string;
  relatedId?: string;
  done: boolean;
}

export interface Interaction extends BaseRecord {
  personId: string;
  type: string;
  occurredAt: string;
  subject: string;
  summary?: string;
  result?: string;
  nextAction?: string;
  nextActionAt?: string;
  assigneeId?: string;
}

export type PermissionAction = "view" | "create" | "edit" | "delete" | "restore" | "export" | "assign" | "documents" | "reports" | "settings";

export interface RoleDefinition extends BaseRecord {
  name: string;
  description: string;
  permissions: Record<string, PermissionAction[]>;
  scope: "all" | "region" | "team" | "assigned" | "specific";
}

export interface UserRecord extends BaseRecord {
  username: string;
  name: string;
  email?: string;
  roleId: string;
  active: boolean;
  blockedUntil?: string;
  regionIds: string[];
  teamIds: string[];
  permissionOverrides: Record<string, PermissionAction[]>;
}

export interface AuditEntry extends BaseRecord {
  action: string;
  module: string;
  recordId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  deviceId: string;
}

export interface PrivacyRequest extends BaseRecord {
  personId?: string;
  type: "Acesso" | "Correção" | "Exclusão" | "Não contato" | "Outro";
  status: "Nova" | "Em análise" | "Em processamento" | "Concluída";
  request: string;
  assigneeId?: string;
  result?: string;
}

export interface NotificationRecord extends BaseRecord {
  title: string;
  message: string;
  recipientId: string;
  relatedType?: string;
  relatedId?: string;
  readAt?: string;
}

export interface CommentRecord extends BaseRecord {
  module: "processes" | "tasks" | "events";
  recordId: string;
  body: string;
  mentions: string[];
}

export interface CampaignSettings {
  id: string;
  name: string;
  candidateName: string;
  office: string;
  party?: string;
  electionNumber?: string;
  state?: string;
  primaryColor: string;
  accentColor: string;
}

export interface AppData {
  people: Person[];
  processes: ProcessRecord[];
  tasks: TaskRecord[];
  calendar: CalendarEntry[];
  events: CampaignEvent[];
  team: TeamMember[];
  territories: Territory[];
  activities: Activity[];
  documents: DocumentRecord[];
  expenses: Expense[];
  reminders: Reminder[];
  interactions: Interaction[];
  roles: RoleDefinition[];
  users: UserRecord[];
  audit: AuditEntry[];
  privacyRequests: PrivacyRequest[];
  notifications: NotificationRecord[];
  comments: CommentRecord[];
}

export type CollectionName = keyof AppData;
