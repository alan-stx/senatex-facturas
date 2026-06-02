'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

type ModuleKey =
  | 'facturas'
  | 'clientes'
  | 'operaciones'
  | 'pagos'
  | 'dashboard'
  | 'configuracion';

type AccessInfo = {
  ok: boolean;
  email: string;
  role: 'admin' | 'comercial' | 'tienda' | 'sin_acceso';
  modules: Record<ModuleKey, boolean>;
};

const navItems: Array<{
  key: 'inicio' | ModuleKey;
  label: string;
  href: string;
  icon: string;
}> = [
  { key: 'inicio', label: 'Inicio', href: '/', icon: '🏠' },
  { key: 'facturas', label: 'Facturas PDF', href: '/facturas', icon: '📄' },
  { key: 'clientes', label: 'Clientes', href: '/clientes', icon: '👥' },
  { key: 'operaciones', label: 'Operaciones', href: '/operaciones', icon: '📋' },
  { key: 'pagos', label: 'Pagos', href: '/pagos', icon: '💰' },
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { key: 'configuracion', label: 'Configuración', href: '/configuracion', icon: '⚙️' },
];

function getCurrentModule(pathname: string) {
  if (pathname === '/') {
    return navItems[0];
  }

  return (
    navItems
      .filter((item) => item.key !== 'inicio')
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) || null
  );
}

function getRoleLabel(role?: AccessInfo['role']) {
  if (role === 'admin') return 'Administrador';
  if (role === 'comercial') return 'Comercial';
  if (role === 'tienda') return 'Tienda';
  return 'Usuario';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('senatex-sidebar-collapsed');
    setSidebarCollapsed(stored === 'true');
  }, []);

  useEffect(() => {
    if (!session?.user?.email) {
      setAccess(null);
      return;
    }

    setAccessLoading(true);

    fetch('/api/access')
      .then((response) => response.json())
      .then((data) => setAccess(data))
      .catch(() => setAccess(null))
      .finally(() => setAccessLoading(false));
  }, [session?.user?.email]);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.key === 'inicio') return true;
      if (!access?.modules) return false;

      return access.modules[item.key as ModuleKey];
    });
  }, [access]);

  const currentModule = getCurrentModule(pathname);

  const canViewCurrentPage = useMemo(() => {
    const currentKey = currentModule?.key;

    if (!currentKey || currentKey === 'inicio') return true;
    if (!access?.modules) return false;

    return access.modules[currentKey as ModuleKey];
  }, [currentModule, access]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('senatex-sidebar-collapsed', String(next));
      return next;
    });
  }

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

  if (accessLoading || !access) {
    return (
      <main className="landing-page">
        <section className="landing-card">
          <p>Validando permisos...</p>
        </section>
      </main>
    );
  }

  return (
    <div className={sidebarCollapsed ? 'shell shell--collapsed' : 'shell'}>
      <aside className="shell-sidebar">
        <div className="shell-sidebar__brand">
          <span className="shell-sidebar__brand-title">SENATEX</span>
          <small>Gestión interna</small>
        </div>

        <nav className="shell-nav">
          {visibleNavItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                className={active ? 'shell-nav__item shell-nav__item--active' : 'shell-nav__item'}
              >
                <span className="shell-nav__icon">{item.icon}</span>
                <span className="shell-nav__label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar__left">
            <button
              type="button"
              className="shell-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'}
            >
              ☰
            </button>

            <div className="shell-page-title">
              <strong>{currentModule?.label || 'SENATEX'}</strong>
              <span>{getRoleLabel(access?.role)}</span>
            </div>
          </div>

          <div className="shell-user-actions">
            <div className="shell-user-info">
              <strong>{session.user.name || session.user.email}</strong>
              <span>{session.user.email}</span>
            </div>

            <button type="button" className="btn-secondary" onClick={() => signOut()}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="shell-content">
          {canViewCurrentPage ? (
            children
          ) : (
            <section className="module-page">
              <div className="module-page__header">
                <div>
                  <span className="module-page__kicker">Acceso restringido</span>
                  <h1>Módulo no disponible</h1>
                  <p>
                    Este módulo está habilitado solo para personal comercial o administrativo
                    autorizado.
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}