import { NextResponse } from "next/server";
import { and, asc, desc, eq, gt, gte, lt, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appointments, blockedTime, clients, notificationLogs, waitlist } from "@/db/schema";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { loadBarbers, loadServices, loadSettings } from "@/lib/catalog";
import { toEpoch } from "@/lib/studio";

const serviceSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{2,80}$/), nameEs: z.string().min(2).max(100), nameEn: z.string().min(2).max(100), price: z.coerce.number().int().min(0).max(5000000), minutes: z.coerce.number().int().min(5).max(480), active: z.boolean(), featured: z.boolean(), sortOrder: z.coerce.number().int().min(0).max(999) });
const barberSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{2,80}$/), name: z.string().min(2).max(100), handle: z.string().max(100).optional().default(""), specialties: z.string().max(300).optional().default(""), phone: z.string().max(30).optional().default(""), color: z.string().regex(/^#[0-9a-f]{6}$/i), active: z.boolean(), workingHours: z.string().max(3000) });

function unauthorized() { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

export async function GET() {
  if (!(await isAdminAuthorized())) return unauthorized();
  try {
    const db = getDb();
    const since = Math.floor(Date.now() / 1000) - 86400 * 365;
    const [appointmentRows, clientRows, blockRows, waitlistRows, services, barbers, settings] = await Promise.all([
      db.select().from(appointments).where(gte(appointments.startAt, since)).orderBy(asc(appointments.startAt)).limit(2000),
      db.select().from(clients).orderBy(desc(clients.createdAt)).limit(2000),
      db.select().from(blockedTime).where(gte(blockedTime.endAt, Math.floor(Date.now() / 1000) - 86400 * 30)).orderBy(asc(blockedTime.startAt)).limit(500),
      db.select().from(waitlist).orderBy(desc(waitlist.createdAt)).limit(500),
      loadServices(true), loadBarbers(true), loadSettings(),
    ]);
    return NextResponse.json({ appointments: appointmentRows, clients: clientRows, blockedTime: blockRows, waitlist: waitlistRows, services, barbers, settings });
  } catch (error) {
    console.error("Studio OS load failed", error);
    return NextResponse.json({ error: "Studio OS no está disponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthorized())) return unauthorized();
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    if (action === "block:create") {
      const input = z.object({ barberId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().min(4), endTime: z.string().min(4), reason: z.string().min(2).max(120) }).parse(body);
      const startAt = toEpoch(input.date, input.startTime);
      const endAt = toEpoch(input.date, input.endTime);
      if (endAt <= startAt) return NextResponse.json({ error: "La hora final debe ser después de la inicial." }, { status: 400 });
      const [bookingConflict, blockConflict] = await Promise.all([
        db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.barberId, input.barberId), lt(appointments.startAt, endAt), gt(appointments.endAt, startAt), or(eq(appointments.status, "pending"), eq(appointments.status, "confirmed"), eq(appointments.status, "arrived"), eq(appointments.status, "in_progress")))).limit(1),
        db.select({ id: blockedTime.id }).from(blockedTime).where(and(eq(blockedTime.barberId, input.barberId), lt(blockedTime.startAt, endAt), gt(blockedTime.endAt, startAt))).limit(1),
      ]);
      if (bookingConflict.length || blockConflict.length) return NextResponse.json({ error: "Ese horario ya contiene una cita o bloqueo." }, { status: 409 });
      const id = crypto.randomUUID();
      await db.insert(blockedTime).values({ id, barberId: input.barberId, startAt, endAt, reason: input.reason, createdAt: now });
      return NextResponse.json({ ok: true, id }, { status: 201 });
    }
    if (action === "block:delete") {
      const id = z.string().uuid().parse(body.id);
      await db.delete(blockedTime).where(eq(blockedTime.id, id));
      return NextResponse.json({ ok: true });
    }
    if (action === "waitlist:create") {
      const input = z.object({ name: z.string().min(2).max(100), phone: z.string().min(7).max(30), serviceId: z.string().min(1), barberId: z.string().nullable().optional(), preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), preferredTime: z.string().max(20).nullable().optional() }).parse(body);
      const id = crypto.randomUUID();
      await db.insert(waitlist).values({ id, name: input.name, phone: input.phone, serviceId: input.serviceId, barberId: input.barberId || null, preferredDate: input.preferredDate, preferredTime: input.preferredTime || null, status: "waiting", createdAt: now });
      return NextResponse.json({ ok: true, id }, { status: 201 });
    }
    if (action === "waitlist:update") {
      const input = z.object({ id: z.string().uuid(), status: z.enum(["waiting", "contacted", "booked", "expired"]) }).parse(body);
      await db.update(waitlist).set({ status: input.status }).where(eq(waitlist.id, input.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "waitlist:delete") {
      const id = z.string().uuid().parse(body.id);
      await db.delete(waitlist).where(eq(waitlist.id, id));
      return NextResponse.json({ ok: true });
    }
    if (action === "service:save") {
      const value = serviceSchema.parse(body.value);
      await db.batch([
        db.delete(notificationLogs).where(and(eq(notificationLogs.channel, "studio_config"), eq(notificationLogs.kind, `service:${value.id}`))),
        db.insert(notificationLogs).values({ id: crypto.randomUUID(), appointmentId: "studio", channel: "studio_config", kind: `service:${value.id}`, status: JSON.stringify({ ...value, updatedAt: now }), createdAt: now }),
      ]);
      return NextResponse.json({ ok: true });
    }
    if (action === "barber:save") {
      const value = barberSchema.parse(body.value);
      JSON.parse(value.workingHours);
      await db.batch([
        db.delete(notificationLogs).where(and(eq(notificationLogs.channel, "studio_config"), eq(notificationLogs.kind, `barber:${value.id}`))),
        db.insert(notificationLogs).values({ id: crypto.randomUUID(), appointmentId: "studio", channel: "studio_config", kind: `barber:${value.id}`, status: JSON.stringify({ ...value, updatedAt: now }), createdAt: now }),
      ]);
      return NextResponse.json({ ok: true });
    }
    if (action === "settings:save") {
      const value = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).parse(body.value);
      const normalized = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
      await db.batch([
        db.delete(notificationLogs).where(and(eq(notificationLogs.channel, "studio_config"), eq(notificationLogs.kind, "settings"))),
        db.insert(notificationLogs).values({ id: crypto.randomUUID(), appointmentId: "studio", channel: "studio_config", kind: "settings", status: JSON.stringify(normalized), createdAt: now }),
      ]);
      return NextResponse.json({ ok: true });
    }
    if (action === "client:save") {
      const input = z.object({ id: z.string().uuid(), name: z.string().min(2).max(100), email: z.string().email().nullable().optional(), preferredBarber: z.string().nullable().optional(), notes: z.string().max(1000).nullable().optional() }).parse(body);
      await db.update(clients).set({ name: input.name, email: input.email || null, preferredBarber: input.preferredBarber || null, notes: input.notes || null }).where(eq(clients.id, input.id));
      await db.update(appointments).set({ clientName: input.name, email: input.email || null }).where(eq(appointments.clientId, input.id));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Revisa los datos enviados." }, { status: 400 });
    console.error("Studio OS action failed", error);
    return NextResponse.json({ error: "No pudimos completar la acción." }, { status: 503 });
  }
}
