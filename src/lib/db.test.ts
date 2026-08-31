import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadData, saveRecord } from "./db";
import type { Person } from "../types";

describe("persistência offline", () => {
  it("mantém cadastro local após recarregar os dados", async () => {
    const now = new Date().toISOString();
    const person: Person = { id: "offline-test", campaignId: "campaign-default", name: "Pessoa de Teste", phone: "", tags: [], groups: [], doNotContact: false, createdAt: now, createdBy: "user-master", updatedAt: now, updatedBy: "user-master", version: 1, syncStatus: "pending" };
    await loadData();
    await saveRecord("people", person);
    const reloaded = await loadData();
    expect(reloaded.people.find((item) => item.id === person.id)?.name).toBe("Pessoa de Teste");
  });
});
