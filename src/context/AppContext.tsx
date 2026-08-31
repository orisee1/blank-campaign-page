import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CAMPAIGN_ID, MASTER_USER_ID } from "../data/defaults";
import { loadData, loadSettings, saveRecord, saveSettings as persistSettings } from "../lib/db";
import { filterByScope, hasPermission } from "../lib/access";
import type { AppData, AuditEntry, BaseRecord, CampaignSettings, CollectionName, PermissionAction, UserRecord } from "../types";

type Draft<T> = Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>;

interface AppContextValue {
  data: AppData;
  settings: CampaignSettings;
  currentUser: UserRecord | null;
  loading: boolean;
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  setCurrentUser: (user: UserRecord | null) => void;
  createRecord: <C extends CollectionName>(collection: C, draft: Draft<AppData[C][number]>, auditSummary?: string) => Promise<AppData[C][number]>;
  updateRecord: <C extends CollectionName>(collection: C, id: string, patch: Partial<AppData[C][number]>, auditSummary?: string) => Promise<void>;
  softDelete: <C extends CollectionName>(collection: C, id: string) => Promise<void>;
  restore: <C extends CollectionName>(collection: C, id: string) => Promise<void>;
  updateSettings: (settings: CampaignSettings) => Promise<void>;
  can: (module: string, action?: PermissionAction) => boolean;
  visible: <T extends BaseRecord>(rows: T[]) => T[];
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const DEVICE_KEY = "central-campanha-device";
const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>({ people: [], processes: [], tasks: [], calendar: [], events: [], team: [], territories: [], activities: [], documents: [], expenses: [], reminders: [], interactions: [], roles: [], users: [], audit: [], privacyRequests: [], notifications: [], comments: [] });
  const [settings, setSettings] = useState<CampaignSettings>({ id: CAMPAIGN_ID, name: "Central de Campanha", candidateName: "Candidata", office: "Deputada Estadual", primaryColor: "#183f34", accentColor: "#e6a85c" });
  const [currentUser, setCurrentUserState] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [nextData, nextSettings] = await Promise.all([loadData(), loadSettings()]);
    setData(nextData); setSettings(nextSettings); setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onOnline = () => setOnline(true); const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const setCurrentUser = useCallback((user: UserRecord | null) => setCurrentUserState(user), []);

  const appendAudit = useCallback(async (entry: Omit<AuditEntry, keyof BaseRecord>) => {
    const now = new Date().toISOString();
    const audit: AuditEntry = { ...entry, id: crypto.randomUUID(), campaignId: CAMPAIGN_ID, createdAt: now, createdBy: currentUser?.id ?? MASTER_USER_ID, updatedAt: now, updatedBy: currentUser?.id ?? MASTER_USER_ID, version: 1, syncStatus: "pending" };
    await saveRecord("audit", audit);
    setData((previous) => ({ ...previous, audit: [audit, ...previous.audit] }));
  }, [currentUser]);

  const createRecord = useCallback(async <C extends CollectionName>(collection: C, draft: Draft<AppData[C][number]>, auditSummary?: string) => {
    const now = new Date().toISOString(); const userId = currentUser?.id ?? MASTER_USER_ID;
    const record = { ...draft, id: draft.id ?? crypto.randomUUID(), campaignId: CAMPAIGN_ID, createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId, version: 1, syncStatus: "pending" } as AppData[C][number];
    await saveRecord(collection, record);
    setData((previous) => ({ ...previous, [collection]: [record, ...previous[collection]] } as AppData));
    if (collection !== "audit") await appendAudit({ action: "create", module: collection, recordId: record.id, summary: auditSummary ?? `Registro criado em ${collection}`, after: record, deviceId: getDeviceId() });
    return record;
  }, [appendAudit, currentUser]);

  const updateRecord = useCallback(async <C extends CollectionName>(collection: C, id: string, patch: Partial<AppData[C][number]>, auditSummary?: string) => {
    const before = data[collection].find((row) => row.id === id) as AppData[C][number] | undefined;
    if (!before) return;
    const next = { ...before, ...patch, updatedAt: new Date().toISOString(), updatedBy: currentUser?.id ?? MASTER_USER_ID, version: before.version + 1, syncStatus: "pending" } as AppData[C][number];
    await saveRecord(collection, next);
    setData((previous) => ({ ...previous, [collection]: previous[collection].map((row) => row.id === id ? next : row) } as AppData));
    if (collection !== "audit") await appendAudit({ action: "update", module: collection, recordId: id, summary: auditSummary ?? `Registro atualizado em ${collection}`, before, after: next, deviceId: getDeviceId() });
  }, [appendAudit, currentUser, data]);

  const softDelete = useCallback(async <C extends CollectionName>(collection: C, id: string) => updateRecord(collection, id, { deletedAt: new Date().toISOString() } as Partial<AppData[C][number]>, "Registro movido para a lixeira"), [updateRecord]);
  const restore = useCallback(async <C extends CollectionName>(collection: C, id: string) => updateRecord(collection, id, { deletedAt: undefined } as Partial<AppData[C][number]>, "Registro restaurado"), [updateRecord]);
  const updateSettings = useCallback(async (next: CampaignSettings) => { await persistSettings(next); setSettings(next); await appendAudit({ action: "settings", module: "admin", recordId: next.id, summary: "Identidade da campanha atualizada", after: next, deviceId: getDeviceId() }); }, [appendAudit]);

  const role = data.roles.find((item) => item.id === currentUser?.roleId);
  const can = useCallback((module: string, action: PermissionAction = "view") => hasPermission(currentUser, role, module, action), [currentUser, role]);

  const visible = useCallback(<T extends BaseRecord>(rows: T[]) => {
    return filterByScope(rows, currentUser, role);
  }, [currentUser, role]);

  const pendingCount = useMemo(() => Object.values(data).flat().filter((row) => row.syncStatus === "pending" || row.syncStatus === "error" || row.syncStatus === "conflict").length, [data]);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
    if (!online || !apiUrl || pendingCount === 0 || !currentUser) return;
    const sync = async () => {
      setSyncing(true);
      try {
        const pending = (Object.entries(data) as [CollectionName, BaseRecord[]][]).flatMap(([collection, rows]) => rows.filter((row) => row.syncStatus === "pending").map((record) => ({ collection, record })));
        const response = await fetch(`${apiUrl}/api/sync`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId(), changes: pending }) });
        if (response.ok) await refresh();
      } finally { setSyncing(false); }
    };
    void sync();
  }, [currentUser, data, online, pendingCount, refresh]);

  const value = useMemo(() => ({ data, settings, currentUser, loading, online, syncing, pendingCount, setCurrentUser, createRecord, updateRecord, softDelete, restore, updateSettings, can, visible, refresh }), [data, settings, currentUser, loading, online, syncing, pendingCount, setCurrentUser, createRecord, updateRecord, softDelete, restore, updateSettings, can, visible, refresh]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp deve ser usado dentro de AppProvider");
  return value;
};
