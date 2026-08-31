import { describe, expect, it } from "vitest";
import { verifyBootstrapCredentials } from "./auth";

describe("autenticação inicial", () => {
  it("aceita somente a credencial master solicitada", async () => {
    await expect(verifyBootstrapCredentials("admin19", "admin04")).resolves.toBe(true);
    await expect(verifyBootstrapCredentials("admin19", "senha-errada")).resolves.toBe(false);
    await expect(verifyBootstrapCredentials("outro", "admin04")).resolves.toBe(false);
  });
});
