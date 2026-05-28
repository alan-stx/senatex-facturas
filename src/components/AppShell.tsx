'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';

const navItems = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Facturas PDF', href: '/facturas', icon: '📄' },
  { label: 'Clientes', href: '/clientes', icon: '👥' },
  { label: 'Operaciones', href: '/operaciones', icon: '📋' },
  { label: 'Pagos', href: '/pagos', icon: '💰' },
  { label: 'Seguimiento', href: '/seguimiento', icon: '🗓️' },
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Configuración', href: '/configuracion', icon: '⚙️' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
          <span className="landing-kicker">Acceso SENATEX</span>
          <h1>Debes iniciar sesión</h1>
          <p>Usa un correo autorizado para acceder a este módulo.</p>

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
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-sidebar__brand">
          <span>SENATEX</span>
          <small>Gestión interna</small>
        </div>

        <nav className="shell-nav">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'shell-nav__item shell-nav__item--active' : 'shell-nav__item'}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div>
            <strong>{session.user.name || session.user.email}</strong>
            <span>{session.user.email}</span>
          </div>

          <button type="button" className="btn-secondary" onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </header>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}