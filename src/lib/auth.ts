const BOOTSTRAP_SALT = "f1eff2d0fa60a2ececd8b6f192f388cb";
const BOOTSTRAP_HASH = "18245a5cef345bfc7c58a54c640e3c401ab4e378c1fc885060729b3df5e2583b";
const ITERATIONS = 210_000;

const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
const bytesToHex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: ITERATIONS }, key, 256);
  return bytesToHex(bits);
}

export async function verifyBootstrapCredentials(username: string, password: string) {
  if (username.trim().toLowerCase() !== "admin19") return false;
  return (await hashPassword(password, BOOTSTRAP_SALT)) === BOOTSTRAP_HASH;
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  return (await hashPassword(password, salt)) === expectedHash;
}

export async function createPasswordCredential(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = [...salt].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { salt: saltHex, hash: await hashPassword(password, saltHex) };
}

export const sessionStorageKey = "central-campanha-session";
