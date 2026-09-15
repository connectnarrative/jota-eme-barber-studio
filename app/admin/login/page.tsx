"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No pudimos iniciar sesión.");
        return;
      }
      window.location.assign("/admin");
    } catch {
      setError("Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#090909] px-5 py-12 text-[#f5f3ed]">
    <div className="barber-stripe absolute inset-x-0 top-0 h-1.5" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,.08),transparent_38%)]" />
    <section className="relative w-full max-w-md border border-white/12 bg-[#111]/92 p-7 shadow-2xl sm:p-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-white/55 hover:text-white"><ArrowLeft size={16}/> Volver al sitio</Link>
      <img src="/jota-eme-logo.jpg" alt="Jota Eme Barber Studio" className="mx-auto h-28 w-28 rounded-full bg-white object-cover" />
      <div className="mt-6 text-center">
        <p className="eyebrow text-white/45">STUDIO OS</p>
        <h1 className="mt-2 text-2xl font-black">Acceso administrativo</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/45">Agenda, clientes y reservas de Jota Eme.</p>
      </div>
      <form onSubmit={submit} className="mt-8">
        <label htmlFor="password" className="mb-2 block text-sm font-semibold">Contraseña</label>
        <div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18}/><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-13 rounded-none border-white/15 bg-white/[.04] pl-11" required /></div>
        {error && <p role="alert" className="mt-3 border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        <Button disabled={!password || loading} className="mt-5 h-13 w-full rounded-none font-black">{loading ? "ENTRANDO…" : "ENTRAR"}</Button>
      </form>
    </section>
  </main>;
}
