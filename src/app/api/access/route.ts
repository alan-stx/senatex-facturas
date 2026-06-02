import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { canAccessPath, getUserRole } from '@/lib/permissions';

export async function GET() {
  const session = await auth();
  const email = session?.user?.email || '';
  const role = getUserRole(email);

  const modules = {
    facturas: canAccessPath(role, '/facturas'),
    clientes: canAccessPath(role, '/clientes'),
    operaciones: canAccessPath(role, '/operaciones'),
    pagos: canAccessPath(role, '/pagos'),
    dashboard: canAccessPath(role, '/dashboard'),
    configuracion: role === 'admin',
  };

  return NextResponse.json({
    ok: true,
    email,
    role,
    modules,
  });
}