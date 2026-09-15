import { NextResponse } from "next/server";
import { loadBarbers, loadServices, loadSettings } from "@/lib/catalog";
import { DEFAULT_BARBERS, DEFAULT_SERVICES, DEFAULT_SETTINGS } from "@/lib/studio";

export async function GET() {
  try {
    const [services, barbers, settings] = await Promise.all([loadServices(), loadBarbers(), loadSettings()]);
    return NextResponse.json({ services, barbers, settings });
  } catch (error) {
    console.error("Catalog unavailable", error);
    return NextResponse.json({ services: DEFAULT_SERVICES, barbers: DEFAULT_BARBERS, settings: DEFAULT_SETTINGS });
  }
}
