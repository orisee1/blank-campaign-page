import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { defaultSettings, emptyData } from "../data/defaults";
import type { AppData, CampaignSettings, CollectionName } from "../types";

interface CentralDB extends DBSchema {
  records: {
    key: [CollectionName, string];
    value: { collection: CollectionName; id: string; value: AppData[CollectionName][number] };
    indexes: { "by-collection": CollectionName };
  };
  meta: { key: string; value: unknown };
  blobs: { key: string; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<CentralDB>> | null = null;

const getDB = () => {
  dbPromise ??= openDB<CentralDB>("central-campanha", 1, {
    upgrade(db) {
      const records = db.createObjectStore("records", { keyPath: ["collection", "id"] });
      records.createIndex("by-collection", "collection");
      db.createObjectStore("meta");
      db.createObjectStore("blobs");
    },
  });
  return dbPromise;
};

export async function loadData(): Promise<AppData> {
  const db = await getDB();
  const initialized = await db.get("meta", "initialized");
  if (!initialized) {
    const tx = db.transaction(["records", "meta"], "readwrite");
    for (const [collection, rows] of Object.entries(emptyData) as [CollectionName, AppData[CollectionName]][]) {
      for (const value of rows) await tx.objectStore("records").put({ collection, id: value.id, value });
    }
    await tx.objectStore("meta").put(true, "initialized");
    await tx.objectStore("meta").put(defaultSettings, "campaign-settings");
    await tx.done;
  }

  const result = {} as AppData;
  for (const collection of Object.keys(emptyData) as CollectionName[]) {
    const rows = await db.getAllFromIndex("records", "by-collection", collection);
    (result[collection] as AppData[CollectionName]) = rows.map((row) => row.value) as AppData[CollectionName];
  }
  return result;
}

export async function saveRecord<C extends CollectionName>(collection: C, value: AppData[C][number]) {
  const db = await getDB();
  await db.put("records", { collection, id: value.id, value });
}

export async function saveMany<C extends CollectionName>(collection: C, values: AppData[C]) {
  const db = await getDB();
  const tx = db.transaction("records", "readwrite");
  for (const value of values) await tx.store.put({ collection, id: value.id, value });
  await tx.done;
}

export async function loadSettings(): Promise<CampaignSettings> {
  const db = await getDB();
  return (await db.get("meta", "campaign-settings")) as CampaignSettings ?? defaultSettings;
}

export async function saveSettings(settings: CampaignSettings) {
  const db = await getDB();
  await db.put("meta", settings, "campaign-settings");
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDB()).get("meta", key)) as T | undefined;
}

export async function setMeta<T>(key: string, value: T) {
  await (await getDB()).put("meta", value, key);
}

export async function storeBlob(id: string, blob: Blob) {
  await (await getDB()).put("blobs", blob, id);
}

export async function readBlob(id: string) {
  return (await getDB()).get("blobs", id);
}
