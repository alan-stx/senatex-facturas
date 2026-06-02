import AppShell from '@/components/AppShell';

export default function SeguimientoPage() {
  return (
    <AppShell>
      <section className="module-page">
        <span className="module-page__kicker">Módulo no habilitado</span>
        <h1>Seguimiento</h1>
        <p>
          Este módulo no está habilitado por ahora. El seguimiento operativo se realizará desde
          Operaciones y Pagos.
        </p>
      </section>
    </AppShell>
  );
}