import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Facturas SENATEX — Carga de Facturas',
  description:
    'Sistema interno de carga y procesamiento automático de facturas PDF para Servicio Nacional Textil (SENATEX).',
  robots: 'noindex, nofollow', // App interna, no indexar
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
