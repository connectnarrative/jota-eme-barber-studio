import { NextResponse } from "next/server";
import { and, eq, gt, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { appointments, blockedTime } from "@/db/schema";
import { loadBarbers, loadService, loadSettings } from "@/lib/catalog";
import { minutesToLabel, timeToMinutes, toEpoch, weekdayKey } from "@/lib/studio";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? "";
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const requestedBarber = url.searchParams.get("barber") ?? "any";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    const [service, barbers, settings] = await Promise.all([loadService(serviceId), loadBarbers(), loadSettings()]);
    if (!service) return NextResponse.json({ error: "Servicio no disponible" }, { status: 404 });
    if (settings[weekdayKey(date)] === "closed") return NextResponse.json({ slots: [] });
    const candidates = requestedBarber === "any" ? barbers : barbers.filter((barber) => barber.id === requestedBarber);
    if (!candidates.length) return NextResponse.json({ slots: [] });
    const interval = Math.max(5, Number(settings.slotInterval) || 15);
    const buffer = Math.max(0, Number(settings.bufferMinutes) || 0) * 60;
    const globalOpen = timeToMinutes(settings.openingTime || "09:15");
    const globalClose = timeToMinutes(settings.closingTime || "20:20");
    const dayStart = toEpoch(date, "00:00");
    const dayEnd = dayStart + 86400;
    const db = getDb();
    const [bookings, blocks] = await Promise.all([
      db.select().from(appointments).where(and(lt(appointments.startAt, dayEnd), gt(appointments.endAt, dayStart), or(eq(appointments.status, "pending"), eq(appointments.status, "confirmed"), eq(appointments.status, "arrived"), eq(appointments.status, "in_progress")))),
      db.select().from(blockedTime).where(and(lt(blockedTime.startAt, dayEnd), gt(blockedTime.endAt, dayStart))),
    ]);
    const now = Math.floor(Date.now() / 1000) + Math.max(0, Number(settings.bookingLeadMinutes) || 0) * 60;
    const slots = [] as { time: string; availableBarbers: string[] }[];
    for (let minute = globalOpen; minute + service.minutes <= globalClose; minute += interval) {
      const time = minutesToLabel(minute);
      const startAt = toEpoch(date, time);
      const endAt = startAt + service.minutes * 60;
      if (startAt < now) continue;
      const availableBarbers = candidates.filter((barber) => {
        let open = globalOpen;
        let close = globalClose;
        try {
          const hours = JSON.parse(barber.workingHours || "{}") as Record<string, [string, string] | null>;
          const ownHours = hours[weekdayKey(date)];
          if (ownHours === null) return false;
          if (ownHours) [open, close] = ownHours.map(timeToMinutes) as [number, number];
        } catch { /* Global hours are the safe fallback. */ }
        if (minute < open || minute + service.minutes > close) return false;
        const bookingConflict = bookings.some((row) => row.barberId === barber.id && row.startAt < endAt + buffer && row.endAt + buffer > startAt);
        const blockConflict = blocks.some((row) => row.barberId === barber.id && row.startAt < endAt && row.endAt > startAt);
        return !bookingConflict && !blockConflict;
      }).map((barber) => barber.id);
      if (availableBarbers.length) slots.push({ time, availableBarbers });
    }
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Availability unavailable", error);
    return NextResponse.json({ error: "No pudimos cargar la disponibilidad." }, { status: 503 });
  }
}
