import AppShell from '@/components/AppShell';

export default function DashboardPage() {
  return (
    <AppShell>
      <section className="module-page">
        <span className="module-page__kicker">Analítica</span>
        <h1>Dashboard</h1>
        <p>Vista integrada de reportes en Looker Studio.</p>

        <div className="dashboard-frame">
          <iframe
            src={process.env.NEXT_PUBLIC_LOOKER_STUDIO_URL}
            width="100%"
            height="900"
            style={{ border: 0 }}
            allowFullScreen
          />
        </div>
      </section>
    </AppShell>
  );
}