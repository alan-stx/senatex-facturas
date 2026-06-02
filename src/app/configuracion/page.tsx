import AppShell from '@/components/AppShell';

const configCards = [
  {
    title: 'Usuarios y permisos',
    description:
      'Los accesos se gestionan por correo mediante ADMIN_EMAILS, COMERCIAL_EMAILS y TIENDA_EMAILS.',
    items: [
      'Admin: acceso total',
      'Comercial: clientes, operaciones, pagos y dashboard',
      'Tienda: solo facturas PDF',
    ],
  },
  {
    title: 'Conexiones n8n',
    description: 'Webhooks que conectan la plataforma con Google Sheets.',
    items: ['Clientes', 'Operaciones', 'Pagos', 'Facturas de ingreso'],
  },
  {
    title: 'Catálogos comerciales',
    description: 'Valores usados en formularios y filtros.',
    items: [
      'Responsables comerciales',
      'Modalidades de pago',
      'Estados de operación',
      'Tipos de cliente',
    ],
  },
  {
    title: 'Dashboard',
    description: 'Reporte embebido mediante Looker Studio.',
    items: ['Variable: NEXT_PUBLIC_LOOKER_STUDIO_URL', 'Visible para admin y comercial'],
  },
];

export default function ConfiguracionPage() {
  return (
    <AppShell>
      <section className="module-page">
        <div className="module-page__header">
          <div>
            <span className="module-page__kicker">Sistema</span>
            <h1>Configuración</h1>
            <p>Panel de control de parámetros, accesos y conexiones del sistema.</p>
          </div>
        </div>

        <div className="config-grid">
          {configCards.map((card) => (
            <article key={card.title} className="config-card">
              <h2>{card.title}</h2>
              <p>{card.description}</p>

              <ul>
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="notice">
          Por seguridad, los cambios de correos autorizados y webhooks se realizan desde las
          variables de entorno del proyecto.
        </div>
      </section>
    </AppShell>
  );
}