import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getServerConfig } from '@/lib/config';
import { getUserRole } from '@/lib/permissions';
import type { DepositoCreatePayload, PagoProgramado, PagosResponse } from '@/types';

export const runtime = 'nodejs';

function buildErrorResponse(message: string, status: number) {
  const response: PagosResponse = {
    ok: false,
    message,
  };

  return NextResponse.json(response, { status });
}

/**
 * Parsea la respuesta de n8n de forma segura. Si el cuerpo viene vacío o no es
 * JSON válido devuelve null en lugar de lanzar, evitando el error
 * "Unexpected end of JSON input" que tumbaba la ruta con un 500 sin cuerpo.
 */
async function parseN8nJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text().catch(() => '');

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error('[pagos] Respuesta de n8n no es JSON válido:', text.slice(0, 500));
    return null;
  }
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para consultar pagos.', 401);
  }

  const role = getUserRole(session.user.email);

  if (role !== 'admin' && role !== 'comercial') {
    return buildErrorResponse('No tienes permiso para acceder a este módulo.', 403);
  }

  const config = getServerConfig();

  if (!config.n8nPagosWebhookUrl) {
    const mockPagos: PagoProgramado[] = [
      {
        pago_id: 'PAG-0001',
        operacion_id: 'OP-0001',
        cliente_id: 'CLI-0001',
        cliente_nombre: 'Cliente de prueba',
        descripcion_operacion: 'Operación de prueba',
        numero_pago: 1,
        concepto_pago: 'Anticipo',
        porcentaje_programado: 50,
        monto_programado: 12500,
        fecha_programada: new Date().toISOString().slice(0, 10),
        estado_pago: 'Pendiente',
        monto_pagado_acumulado: 0,
        saldo_pago: 12500,
        modalidad_pago: 'Transferencia bancaria',
      },
    ];

    return NextResponse.json({
      ok: true,
      message: 'Pagos obtenidos en modo prueba.',
      pagos: mockPagos,
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.n8nApiKey) {
    headers['x-api-key'] = config.n8nApiKey;
  }

  let n8nResponse: Response;

  try {
    n8nResponse = await fetch(config.n8nPagosWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'list',
        actor: {
          email: session.user.email,
          name: session.user.name || session.user.email,
          role,
        },
        // Compatibilidad con versiones previas del workflow.
        requested_by: session.user.email,
        requested_by_name: session.user.name || session.user.email,
      }),
    });
  } catch (error) {
    console.error('[pagos] Error de conexión con n8n:', error);

    return buildErrorResponse(
      'No se pudo conectar con n8n para consultar pagos.',
      502
    );
  }

  if (!n8nResponse.ok) {
    return buildErrorResponse('Error al consultar pagos en n8n.', 502);
  }

  const data = await parseN8nJson(n8nResponse);

  if (!data) {
    return buildErrorResponse('n8n devolvió una respuesta vacía o inválida al listar pagos.', 502);
  }

  if (data.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: (data.message as string) || 'No se pudieron consultar los pagos.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: (data.message as string) || 'Pagos obtenidos correctamente.',
    pagos: data.pagos || [],
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para registrar depósitos.', 401);
  }

  const role = getUserRole(session.user.email);

  if (role !== 'admin' && role !== 'comercial') {
    return buildErrorResponse('No tienes permiso para acceder a este módulo.', 403);
  }

  const config = getServerConfig();

  let payload: DepositoCreatePayload;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('El cuerpo de la solicitud no es un JSON válido.', 400);
  }

  if (!payload.pago_id) {
    return buildErrorResponse('El pago_id es obligatorio.', 400);
  }

  if (!payload.operacion_id) {
    return buildErrorResponse('El operacion_id es obligatorio.', 400);
  }

  if (!payload.cliente_id) {
    return buildErrorResponse('El cliente_id es obligatorio.', 400);
  }

  if (!payload.fecha_deposito) {
    return buildErrorResponse('La fecha de depósito es obligatoria.', 400);
  }

  if (!payload.monto_depositado || Number(payload.monto_depositado) <= 0) {
    return buildErrorResponse('El monto depositado debe ser mayor a 0.', 400);
  }

  if (!payload.modalidad_pago) {
    return buildErrorResponse('La modalidad de pago es obligatoria.', 400);
  }

  const now = new Date().toISOString();

  const actor = {
    email: session.user.email,
    name: session.user.name || session.user.email,
    role,
  };

  const depositoData = {
    ...payload,
    monto_depositado: Number(payload.monto_depositado),
    created_by: session.user.email,
    created_by_name: session.user.name || session.user.email,
    created_at: now,
  };

  if (!config.n8nPagosWebhookUrl) {
    return NextResponse.json({
      ok: true,
      message: 'Depósito registrado en modo prueba.',
      pago: {
        pago_id: depositoData.pago_id,
        operacion_id: depositoData.operacion_id,
        cliente_id: depositoData.cliente_id,
        numero_pago: 1,
        concepto_pago: 'Pago prueba',
        porcentaje_programado: 100,
        monto_programado: depositoData.monto_depositado,
        fecha_programada: depositoData.fecha_deposito,
        estado_pago: 'Pagado',
        monto_pagado_acumulado: depositoData.monto_depositado,
        saldo_pago: 0,
        fecha_ultimo_pago: depositoData.fecha_deposito,
        modalidad_pago: depositoData.modalidad_pago,
      },
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.n8nApiKey) {
    headers['x-api-key'] = config.n8nApiKey;
  }

  let n8nResponse: Response;

  try {
    n8nResponse = await fetch(config.n8nPagosWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'register_deposit',
        actor,
        deposito: depositoData,
      }),
    });
  } catch (error) {
    console.error('[pagos] Error de conexión con n8n register_deposit:', error);

    return buildErrorResponse(
      'No se pudo conectar con n8n para registrar el depósito.',
      502
    );
  }

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[pagos] Error n8n:', errorText);

    return buildErrorResponse('Error al registrar el depósito en n8n.', 502);
  }

  const data = await parseN8nJson(n8nResponse);

  if (!data) {
    return buildErrorResponse('n8n devolvió una respuesta vacía o inválida al registrar el depósito.', 502);
  }

  if (data.ok === false) {
    // n8n marca con `forbidden` los intentos de registrar pagos de operaciones
    // ajenas (comercial sobre operación que no le pertenece).
    const status = data.forbidden ? 403 : 400;

    return NextResponse.json(
      {
        ok: false,
        message:
          data.message ||
          (data.forbidden
            ? 'No tienes permiso para registrar este pago.'
            : 'No se pudo registrar el depósito.'),
      },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    message: data.message || 'Depósito registrado correctamente.',
    pago: data.pago,
  });
}