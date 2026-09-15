import { barbers, services } from "@/app/data";

export const DEFAULT_SETTINGS = {
  businessName: "Jota Eme Barber Studio",
  whatsapp: "+57 321 469 2733",
  address: "Av. San Martín, Edificio San Martín, Local 7, Bocagrande",
  timezone: "America/Bogota",
  openingTime: "09:15",
  closingTime: "20:20",
  slotInterval: "15",
  bookingLeadMinutes: "60",
  bookingWindowDays: "45",
  bufferMinutes: "0",
  cancellationHours: "4",
  monday: "open",
  tuesday: "open",
  wednesday: "open",
  thursday: "open",
  friday: "open",
  saturday: "open",
  sunday: "closed",
} as const;

export const DEFAULT_SERVICES = services.map((service, sortOrder) => ({
  id: service.id,
  nameEs: service.es,
  nameEn: service.en,
  price: service.price,
  minutes: service.minutes,
  active: true,
  featured: Boolean(service.featured),
  sortOrder,
}));

export const DEFAULT_BARBERS = barbers.map((barber, index) => ({
  id: barber.id,
  name: barber.name,
  handle: barber.handle,
  specialties: barber.specialties,
  phone: "",
  color: index === 0 ? "#e84c3d" : "#4f8cff",
  active: true,
  workingHours: JSON.stringify({
    monday: ["09:15", "20:20"],
    tuesday: ["09:15", "20:20"],
    wednesday: ["09:15", "20:20"],
    thursday: ["09:15", "20:20"],
    friday: ["09:15", "20:20"],
    saturday: ["09:15", "20:20"],
    sunday: null,
  }),
}));

export function timeToMinutes(value: string) {
  const twelve = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2]);
    if (hour < 1 || hour > 12 || minute > 59) throw new Error("Invalid time");
    if (twelve[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (twelve[3].toUpperCase() === "AM" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
  const twentyFour = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFour) throw new Error("Invalid time");
  const hour = Number(twentyFour[1]);
  const minute = Number(twentyFour[2]);
  if (hour > 23 || minute > 59) throw new Error("Invalid time");
  return hour * 60 + minute;
}

export function minutesToLabel(total: number) {
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function toEpoch(date: string, time: string) {
  const total = timeToMinutes(time);
  const hour = String(Math.floor(total / 60)).padStart(2, "0");
  const minute = String(total % 60).padStart(2, "0");
  return Math.floor(new Date(`${date}T${hour}:${minute}:00-05:00`).getTime() / 1000);
}

export function bogotaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(date);
}

export function weekdayKey(date: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(`${date}T12:00:00Z`)).toLowerCase();
}
