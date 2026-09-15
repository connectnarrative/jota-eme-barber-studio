import { NextResponse } from "next/server";
import { and, asc, eq, gt, gte, lt, ne, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appointments, blockedTime, clients, notificationLogs } from "@/db/schema";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { loadService, loadSettings } from "@/lib/catalog";
import { toEpoch } from "@/lib/studio";

const appointmentInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.string().email().optional().or(z.literal("")),
  serviceId: z.string().min(1),
  barberId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(4).max(12),
  status: z.enum(["pending", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"]).default("confirmed"),
  notes: z.string().max(500).optional(),
});

async function conflict(barberId: string, startAt: number, endAt: number, ignoreId?: string) {
  const db = getDb();
  const appointmentFilters = [
    eq(appointments.barberId, barberId),
    lt(appointments.startAt, endAt),
    gt(appointments.endAt, startAt),
    or(eq(appointments.status, "pending"), eq(appointments.status, "confirmed"), eq(appointments.status, "arrived"), eq(appointments.status, "in_progress")),
  ];
  if (ignoreId) appointmentFilters.push(ne(appointments.id, ignoreId));
  const [bookings, blocks] = await Promise.all([
    db.select({ id: appointments.id }).from(appointments).where(and(...appointmentFilters)).limit(1),
    db.select({ id: blockedTime.id }).from(blockedTime).where(and(eq(blockedTime.barberId, barberId), lt(blockedTime.startAt, endAt), gt(blockedTime.endAt, startAt))).limit(1),
  ]);
  return Boolean(bookings.length || blocks.length);
}

export async function GET() {
  if (!(await isAdminAuthorized())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const since = Math.floor(Date.now() / 1000) - 86400 * 120;
    const rows = await getDb().select().from(appointments).where(gte(appointments.startAt, since)).orderBy(asc(appointments.startAt)).limit(1000);
    return NextResponse.json({ appointments: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Agenda no disponible", unavailable: true }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthorized())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = appointmentInput.parse(await request.json());
    const [service, settings] = await Promise.all([loadService(input.serviceId), loadSettings()]);
    if (!service) return NextResponse.json({ error: "Servicio no disponible." }, { status: 400 });
    const startAt = toEpoch(input.date, input.time);
    const endAt = startAt + service.minutes * 60;
    const conflictEndAt = endAt + Math.max(0, Number(settings.bufferMinutes) || 0) * 60;
    if (await conflict(input.barberId, startAt, conflictEndAt)) return NextResponse.json({ error: "Ese barbero ya tiene una cita o bloqueo en ese horario." }, { status: 409 });
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const [existingClient] = await db.select({ id: clients.id }).from(clients).where(eq(clients.phone, input.phone)).limit(1);
    const clientId = existingClient?.id ?? crypto.randomUUID();
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(clients).values({ id: clientId, name: input.name, phone: input.phone, email: input.email || null, preferredBarber: input.barberId, visitCount: 0, createdAt: now }).onConflictDoUpdate({ target: clients.phone, set: { name: input.name, email: input.email || null, preferredBarber: input.barberId } }),
      db.insert(appointments).values({ id, publicToken: crypto.randomUUID().replaceAll("-", ""), clientId, clientName: input.name, phone: input.phone, email: input.email || null, serviceId: input.serviceId, barberId: input.barberId, date: input.date, time: input.time, startAt, endAt, price: service.price, status: input.status, notes: input.notes || null, createdAt: now }),
      db.insert(notificationLogs).values({ id: crypto.randomUUID(), appointmentId: id, channel: "staff", kind: "manual_booking", status: "logged", createdAt: now }),
    ]);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Revisa los datos de la cita." }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "No pudimos guardar la cita." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthorized())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string") return NextResponse.json({ error: "Cita inválida." }, { status: 400 });
    if (typeof body.status === "string" && Object.keys(body).length <= 2) {
      const allowed = ["pending", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"];
      if (!allowed.includes(body.status)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
      await getDb().update(appointments).set({ status: body.status }).where(eq(appointments.id, body.id));
      return NextResponse.json({ ok: true });
    }
    const input = appointmentInput.parse(body);
    const appointmentId = input.id ?? String(body.id);
    const service = await loadService(input.serviceId);
    if (!service) return NextResponse.json({ error: "Servicio no disponible." }, { status: 400 });
    const startAt = toEpoch(input.date, input.time);
    const endAt = startAt + service.minutes * 60;
    if (await conflict(input.barberId, startAt, endAt, appointmentId)) return NextResponse.json({ error: "Ese barbero ya tiene una cita o bloqueo en ese horario." }, { status: 409 });
    await getDb().update(appointments).set({ clientName: input.name, phone: input.phone, email: input.email || null, serviceId: input.serviceId, barberId: input.barberId, date: input.date, time: input.time, startAt, endAt, price: service.price, status: input.status, notes: input.notes || null }).where(eq(appointments.id, appointmentId));
    await getDb().update(clients).set({ name: input.name, email: input.email || null, preferredBarber: input.barberId }).where(eq(clients.phone, input.phone));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Revisa los datos de la cita." }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "No pudimos actualizar la cita." }, { status: 503 });
  }
}
