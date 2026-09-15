import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "jota_eme_admin";

function adminPassword() {
  return (env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD?.trim() ?? "";
}

async function sessionValue(password: string) {
  const bytes = new TextEncoder().encode(`jota-eme-admin-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isAdminConfigured() {
  return Boolean(adminPassword());
}

export async function verifyAdminPassword(password: string) {
  const configured = adminPassword();
  if (!configured || password.length > 200) return false;
  const [given, expected] = await Promise.all([sessionValue(password), sessionValue(configured)]);
  return given === expected;
}

export async function createAdminSessionValue() {
  const configured = adminPassword();
  if (!configured) throw new Error("ADMIN_PASSWORD is not configured");
  return sessionValue(configured);
}

export async function isAdminAuthorized() {
  const configured = adminPassword();
  if (!configured) return false;
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(session && session === await sessionValue(configured));
}
