import AppShell from '@/components/AppShell';

export default function DashboardPage() {
  return (
    <AppShell>
      <section className="module-page module-page--dashboard">
        <div className="dashboard-frame dashboard-frame--full">
          {process.env.NEXT_PUBLIC_LOOKER_STUDIO_URL ? (
            <iframe
              src={process.env.NEXT_PUBLIC_LOOKER_STUDIO_URL}
              width="100%"
              height="900"
              style={{ border: 0 }}
              allowFullScreen
            />
          ) : (
            <div className="dashboard-empty">
              <span className="module-page__kicker">Analítica</span>
              <h1>Dashboard</h1>
              <p>
                Configura la variable NEXT_PUBLIC_LOOKER_STUDIO_URL para mostrar el reporte de
                Looker Studio.
              </p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}