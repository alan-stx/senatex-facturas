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

function createNoAccess(email: string): AccessInfo {
  return {
    ok: false,
    email,
    role: 'sin_acceso',
    modules: {
      facturas: false,
      clientes: false,
      operaciones: false,
      pagos: false,
      dashboard: false,
      configuracion: false,
    },
  };
}

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

type Role = AccessInfo['role'];

/** Nombre visible del rol (barra expandida y topbar). */
const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  comercial: 'Oficial de venta',
  tienda: 'Vendedor',
  sin_acceso: 'Sin acceso',
};

/** Indicador compacto del rol cuando el sidebar está contraído. */
const ROLE_SHORT_LABELS: Record<Role, string> = {
  admin: 'A',
  comercial: 'O',
  tienda: 'V',
  sin_acceso: '–',
};

function getRoleLabel(role?: Role) {
  return role ? ROLE_LABELS[role] : ROLE_LABELS.sin_acceso;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const email = session?.user?.email;

    if (!email) {
      return;
    }

    let active = true;

    fetch('/api/access')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No se pudieron consultar los permisos.');
        }

        return (await response.json()) as AccessInfo;
      })
      .then((data) => {
        if (active) {
          setAccess(data);
        }
      })
      .catch(() => {
        if (active) {
          setAccess(createNoAccess(email));
        }
      });

    return () => {
      active = false;
    };
  }, [session?.user?.email]);

    const accessReady =
    Boolean(session?.user?.email) &&
    Boolean(access) &&
    access?.email.toLowerCase() === session?.user?.email?.toLowerCase();

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
    setSidebarCollapsed((current) => !current);
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

  if (!accessReady) {
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

          {access?.role && (
            <>
              {/* Barra expandida: nombre completo del rol. */}
              <span className="sidebar-role-badge" title={ROLE_LABELS[access.role]}>
                <span className="sidebar-role-badge__dot" aria-hidden="true">
                  ●
                </span>
                {ROLE_LABELS[access.role]}
              </span>

              {/* Barra contraída: indicador compacto con el nombre accesible. */}
              <span
                className="sidebar-role-badge-collapsed"
                title={ROLE_LABELS[access.role]}
                aria-label={`Rol: ${ROLE_LABELS[access.role]}`}
              >
                {ROLE_SHORT_LABELS[access.role]}
              </span>
            </>
          )}
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