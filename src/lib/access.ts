import type { BaseRecord, PermissionAction, RoleDefinition, UserRecord } from "../types";

export function hasPermission(user: UserRecord | null, role: RoleDefinition | undefined, module: string, action: PermissionAction = "view") {
  if (!user?.active || user.deletedAt) return false;
  return (user.permissionOverrides[module] ?? role?.permissions[module] ?? []).includes(action);
}

export function filterByScope<T extends BaseRecord>(rows: T[], user: UserRecord | null, role: RoleDefinition | undefined) {
  const active = rows.filter((row) => !row.deletedAt);
  if (!user || !role) return [];
  if (role.scope === "all") return active;
  if (role.scope === "assigned") return active.filter((row) => {
    const scoped = row as T & { assigneeId?: string; ownerId?: string };
    return scoped.assigneeId === user.id || scoped.ownerId === user.id || row.createdBy === user.id;
  });
  if (role.scope === "region") return active.filter((row) => {
    const scoped = row as T & { regionId?: string; territoryId?: string };
    return user.regionIds.includes(scoped.regionId ?? scoped.territoryId ?? "");
  });
  if (role.scope === "team") return active.filter((row) => user.teamIds.includes((row as T & { team?: string }).team ?? ""));
  return active.filter((row) => row.createdBy === user.id);
}
