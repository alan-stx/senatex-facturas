export type UserRole = 'admin' | 'comercial' | 'tienda' | 'sin_acceso';

function parseEmails(value?: string) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getUserRole(email?: string | null): UserRole {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) return 'sin_acceso';

  const adminEmails = parseEmails(process.env.ADMIN_EMAILS);
  const comercialEmails = parseEmails(process.env.COMERCIAL_EMAILS);
  const tiendaEmails = parseEmails(process.env.TIENDA_EMAILS);

  if (adminEmails.includes(normalizedEmail)) return 'admin';
  if (comercialEmails.includes(normalizedEmail)) return 'comercial';
  if (tiendaEmails.includes(normalizedEmail)) return 'tienda';

  return 'sin_acceso';
}

export function canAccessPath(role: UserRole, pathname: string) {
  if (role === 'admin') return true;

  if (role === 'comercial') {
    return [
      '/',
      '/facturas',
      '/facturas/cuentas-por-cobrar',
      '/clientes',
      '/operaciones',
      '/pagos',
      '/dashboard',
    ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }

  if (role === 'tienda') {
    return pathname === '/' || pathname === '/facturas' || pathname.startsWith('/facturas/');
  }

  return false;
}