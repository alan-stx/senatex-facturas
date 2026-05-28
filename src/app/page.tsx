'use client';

import Link from 'next/link';
import Image from 'next/image';
import { signIn, signOut, useSession } from 'next-auth/react';

const modules = [
  {
    title: 'Facturas PDF',
    description: 'Subir facturas, procesarlas con n8n y registrar ventas reales.',
    href: '/facturas',
    icon: '📄',
  },
  {
    title: 'Clientes',
    description: 'Registrar, buscar y actualizar clientes institucionales.',
    href: '/clientes',
    icon: '👥',
  },
  {
    title: 'Operaciones',
    description: 'Crear contrataciones, adjudicaciones y ventas futuras.',
    href: '/operaciones',
    icon: '📋',
  },
  {
    title: 'Pagos',
    description: 'Gestionar planes de pago, anticipos, saldos y cuotas.',
    href: '/pagos',
    icon: '💰',
  },
  {
    title: 'Seguimiento',
    description: 'Registrar avances, próximos hitos y observaciones comerciales.',
    href: '/seguimiento',
    icon: '🗓️',
  },
  {
    title: 'Dashboard',
    description: 'Ver reportes y visualizaciones de Looker Studio.',
    href: '/dashboard',
    icon: '📊',
  },
];

export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <main className="landing-page">
        <section className="landing-card">
          <p>Cargando sesión...</p>
        </section>
      </main>
    );
  }

  if (!session?.user?.email) {
    return (
      <main className="landing-page">
        <section className="landing-card landing-card--login">
          <Image
            src="/Logo_Senatex.png"
            alt="Logo SENATEX"
            width={320}
            height={118}
            className="landing-logo"
            priority
          />

          <div className="landing-login-content">
            <span className="landing-kicker">Sistema interno</span>
            <h1>Plataforma SENATEX</h1>
            <p>
              Ingresa con un correo autorizado para cargar facturas, registrar clientes,
              hacer seguimiento comercial y consultar dashboards.
            </p>
          </div>

          <button
            type="button"
            className="btn-primary landing-login-button"
            onClick={() => signIn('google')}
          >
            Iniciar sesión con Google
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="landing-page">
      <div className="landing-topbar">
        <div>
          <strong>{session.user.name || session.user.email}</strong>
          <span>{session.user.email}</span>
        </div>

        <button type="button" className="btn-secondary" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>

      <section className="landing-hero">
        <Image
          src="/Logo_Senatex.png"
          alt="Logo SENATEX"
          width={300}
          height={110}
          className="landing-logo"
          priority
        />

        <h1>¿Qué deseas gestionar?</h1>
        <p>
          Selecciona un módulo para continuar.
        </p>
      </section>

      <section className="module-grid">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="module-card">
            <span className="module-card__icon">{module.icon}</span>
            <div>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </div>
            <span className="module-card__arrow">→</span>
          </Link>
        ))}
      </section>
    </main>
  );
}