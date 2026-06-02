'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';

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
  modules: Record<ModuleKey | 'configuracion', boolean>;
};

const modules: Array<{
  key: ModuleKey;
  title: string;
  description: string;
  href: string;
  icon: string;
}> = [
  {
    key: 'facturas',
    title: 'Facturas PDF',
    description: 'Subir facturas, procesarlas con n8n y registrar ventas reales.',
    href: '/facturas',
    icon: '📄',
  },
  {
    key: 'clientes',
    title: 'Clientes',
    description: 'Registrar, buscar y actualizar clientes institucionales.',
    href: '/clientes',
    icon: '👥',
  },
  {
    key: 'operaciones',
    title: 'Operaciones',
    description: 'Crear contrataciones, adjudicaciones y ventas futuras.',
    href: '/operaciones',
    icon: '📋',
  },
  {
    key: 'pagos',
    title: 'Pagos',
    description: 'Gestionar planes de pago, anticipos, saldos y cuotas.',
    href: '/pagos',
    icon: '💰',
  },
  {
    key: 'dashboard',
    title: 'Dashboard',
    description: 'Ver reportes y visualizaciones de Looker Studio.',
    href: '/dashboard',
    icon: '📊',
  },
  {
    key: 'configuracion',
    title: 'Configuración',
    description: 'Ver accesos, roles, catálogos y conexiones del sistema.',
    href: '/configuracion',
    icon: '⚙️',
  },
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

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

  const visibleModules = useMemo(() => {
    return modules.filter((module) => {
      if (!access?.modules) return false;
      return access.modules[module.key];
    });
  }, [access]);

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
              operaciones comerciales y consultar reportes.
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

  if (accessLoading) {
    return (
      <main className="landing-page">
        <section className="landing-card">
          <p>Validando permisos...</p>
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
        <p>Selecciona un módulo para continuar.</p>
      </section>

      <section className="module-grid">
        {visibleModules.length === 0 ? (
          <div className="landing-card">
            <span className="landing-kicker">Acceso restringido</span>
            <h1>Sin módulos disponibles</h1>
            <p>
              Tu correo inició sesión correctamente, pero no tiene módulos asignados. Solicita
              acceso al administrador del sistema.
            </p>
          </div>
        ) : (
          visibleModules.map((module) => (
            <Link key={module.href} href={module.href} className="module-card">
              <span className="module-card__icon">{module.icon}</span>
              <div>
                <h2>{module.title}</h2>
                <p>{module.description}</p>
              </div>
              <span className="module-card__arrow">→</span>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}