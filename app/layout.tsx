import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jota Eme Barber Studio | Barbería premium en Bocagrande",
  description: "Reserva tu corte, barba, facial o experiencia VIP en Jota Eme Barber Studio, Bocagrande, Cartagena.",
  keywords: ["barbería Cartagena", "barbería Bocagrande", "barber shop Cartagena", "haircut Cartagena"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
