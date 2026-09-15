import { NextResponse } from "next/server";
import { and, eq, gt, lt, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appointments, blockedTime, clients, notificationLogs } from "@/db/schema";
import { loadBarbers, loadService, loadSettings } from "@/lib/catalog";
import { timeToMinutes, toEpoch, weekdayKey } from "@/lib/studio";

const inputSchema = z.object({
  serviceId: z.string().min(1).max(80),
  barber: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(4).max(12),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const [service, barbers, settings] = await Promise.all([loadService(input.serviceId), loadBarbers(), loadSettings()]);
    if (!service) return NextResponse.json({ error: "Servicio no disponible." }, { status: 400 });
    if (settings[weekdayKey(input.date)] === "closed") return NextResponse.json({ error: "El estudio está cerrado ese día." }, { status: 409 });
    const startAt = toEpoch(input.date, input.time);
    const endAt = startAt + service.minutes * 60;
    const lead = Math.max(0, Number(settings.bookingLeadMinutes) || 0) * 60;
    if (startAt < Math.floor(Date.now() / 1000) + lead) return NextResponse.json({ error: "Ese horario ya no está disponible." }, { status: 409 });
    const open = timeToMinutes(settings.openingTime || "09:15");
    const close = timeToMinutes(settings.closingTime || "20:20");
    const requestedMinute = timeToMinutes(input.time);
    if (requestedMinute < open || requestedMinute + service.minutes > close) return NextResponse.json({ error: "Ese horario está fuera del horario del estudio." }, { status: 409 });
    const candidates = input.barber === "any" ? barbers : barbers.filter((barber) => barber.id === input.barber);
    if (!candidates.length) return NextResponse.json({ error: "Barbero no disponible." }, { status: 409 });
    const db = getDb();
    const buffer = Math.max(0, Number(settings.bufferMinutes) || 0) * 60;
    let barberId: string | null = null;
    for (const candidate of candidates) {
      try {
        const hours = JSON.parse(candidate.workingHours || "{}") as Record<string, [string, string] | null>;
        const ownHours = hours[weekdayKey(input.date)];
        if (ownHours === null) continue;
        if (ownHours) {
          const [ownOpen, ownClose] = ownHours.map(timeToMinutes);
          if (requestedMinute < ownOpen || requestedMinute + service.minutes > ownClose) continue;
        }
      } catch { /* Global hours are the safe fallback. */ }
      const [conflicts, blocks] = await Promise.all([
        db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.barberId, candidate.id), lt(appointments.startAt, endAt + buffer), gt(appointments.endAt, startAt - buffer), or(eq(appointments.status, "pending"), eq(appointments.status, "confirmed"), eq(appointments.status, "arrived"), eq(appointments.status, "in_progress")))).limit(1),
        db.select({ id: blockedTime.id }).from(blockedTime).where(and(eq(blockedTime.barberId, candidate.id), lt(blockedTime.startAt, endAt), gt(blockedTime.endAt, startAt))).limit(1),
      ]);
      if (!conflicts.length && !blocks.length) { barberId = candidate.id; break; }
    }
    if (!barberId) return NextResponse.json({ error: "Ese horario acaba de ocuparse. Elige otra hora." }, { status: 409 });
    const now = Math.floor(Date.now() / 1000);
    const [existingClient] = await db.select({ id: clients.id }).from(clients).where(eq(clients.phone, input.phone)).limit(1);
    const clientId = existingClient?.id ?? crypto.randomUUID();
    const id = crypto.randomUUID();
    const publicToken = crypto.randomUUID().replaceAll("-", "");
    await db.batch([
      db.insert(clients).values({ id: clientId, name: input.name, phone: input.phone, email: input.email || null, preferredBarber: barberId, visitCount: 0, createdAt: now }).onConflictDoUpdate({ target: clients.phone, set: { name: input.name, email: input.email || null, preferredBarber: barberId } }),
      db.insert(appointments).values({ id, publicToken, clientId, clientName: input.name, phone: input.phone, email: input.email || null, serviceId: service.id, barberId, date: input.date, time: input.time, startAt, endAt, price: service.price, status: "confirmed", notes: input.notes || null, createdAt: now }),
      db.insert(notificationLogs).values({ id: crypto.randomUUID(), appointmentId: id, channel: "whatsapp", kind: "confirmation_queued", status: "queued", createdAt: now }),
    ]);
    return NextResponse.json({ id, status: "confirmed", barberId, manageUrl: `/booking/${publicToken}` }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Revisa los datos de la reserva." }, { status: 400 });
    console.error("Booking failed", error);
    return NextResponse.json({ error: "No pudimos confirmar la cita. Intenta de nuevo." }, { status: 503 });
  }
}
