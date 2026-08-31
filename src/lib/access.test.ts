import { describe, expect, it } from "vitest";
import { defaultRoles, masterUser } from "../data/defaults";
import type { TaskRecord, UserRecord } from "../types";
import { filterByScope, hasPermission } from "./access";

const base = { campaignId: "campaign-default", createdAt: "2026-08-31T00:00:00Z", createdBy: "user-a", updatedAt: "2026-08-31T00:00:00Z", updatedBy: "user-a", version: 1, syncStatus: "synced" as const };

describe("controle de acesso", () => {
  it("não exibe financeiro para voluntário", () => {
    const role = defaultRoles.find((item) => item.id === "role-volunteer");
    const user: UserRecord = { ...masterUser, id: "volunteer", username: "volunteer", roleId: "role-volunteer" };
    expect(hasPermission(user, role, "finance", "view")).toBe(false);
    expect(hasPermission(user, role, "tasks", "view")).toBe(true);
  });

  it("limita coordenador regional aos registros de sua região", () => {
    const role = defaultRoles.find((item) => item.id === "role-regional");
    const user: UserRecord = { ...masterUser, id: "regional", username: "regional", roleId: "role-regional", regionIds: ["region-a"] };
    const tasks = [
      { ...base, id: "1", title: "A", priority: "Normal", status: "A fazer", checklist: [], territoryId: "region-a" },
      { ...base, id: "2", title: "B", priority: "Normal", status: "A fazer", checklist: [], territoryId: "region-b" },
    ] as unknown as TaskRecord[];
    expect(filterByScope(tasks, user, role).map((item) => item.id)).toEqual(["1"]);
  });
});
