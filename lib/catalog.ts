import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notificationLogs } from "@/db/schema";
import { DEFAULT_BARBERS, DEFAULT_SERVICES, DEFAULT_SETTINGS } from "@/lib/studio";

type ServiceRow = (typeof DEFAULT_SERVICES)[number] & { updatedAt?: number };
type BarberRow = (typeof DEFAULT_BARBERS)[number] & { updatedAt?: number };

async function configRows() {
  return getDb().select().from(notificationLogs).where(eq(notificationLogs.channel, "studio_config")).orderBy(asc(notificationLogs.createdAt));
}

export async function loadServices(includeInactive = false) {
  const merged = new Map<string, ServiceRow>(DEFAULT_SERVICES.map((row) => [row.id, { ...row, updatedAt: 0 }]));
  for (const row of await configRows()) {
    if (!row.kind.startsWith("service:")) continue;
    try {
      const value = JSON.parse(row.status) as ServiceRow;
      if (value.id) merged.set(value.id, value);
    } catch { /* Ignore malformed historical configuration. */ }
  }
  const values = [...merged.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  return includeInactive ? values : values.filter((row) => row.active);
}

export async function loadBarbers(includeInactive = false) {
  const merged = new Map<string, BarberRow>(DEFAULT_BARBERS.map((row) => [row.id, { ...row, updatedAt: 0 }]));
  for (const row of await configRows()) {
    if (!row.kind.startsWith("barber:")) continue;
    try {
      const value = JSON.parse(row.status) as BarberRow;
      if (value.id) merged.set(value.id, value);
    } catch { /* Ignore malformed historical configuration. */ }
  }
  const values = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  return includeInactive ? values : values.filter((row) => row.active);
}

export async function loadSettings() {
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of await configRows()) {
    if (row.kind !== "settings") continue;
    try { Object.assign(settings, JSON.parse(row.status)); } catch { /* Ignore malformed historical configuration. */ }
  }
  return settings;
}

export async function loadService(id: string) {
  return (await loadServices(true)).find((row) => row.id === id && row.active) ?? null;
}
