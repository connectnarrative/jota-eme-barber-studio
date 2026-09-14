import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSessionValue, isAdminConfigured, verifyAdminPassword } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "El acceso administrativo aún no está configurado." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (!body.password || !(await verifyAdminPassword(body.password))) {
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await createAdminSessionValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
