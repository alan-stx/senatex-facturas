import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { getServerConfig } from '@/lib/config';

import type {
  CuentaPorCobrarFactura,
  CuentasPorCobrarResponse,
  MarcarIngresoPayload,
} from '@/types';

export const runtime = 'nodejs';

function buildErrorResponse(message: string, status: number) {
  const response: CuentasPorCobrarResponse = {
    ok: false,
    message,
  };

  return NextResponse.json(response, { status });
}

function normalizeDate(value: string) {
  return String(value || '').trim();
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse(
      'No autenticado. Inicia sesión para consultar cuentas por cobrar.',
      401
    );
  }

  const config = getServerConfig();

  if (!config.n8nFacturasIngresoWebhookUrl) {
    const mockFacturas: CuentaPorCobrarFactura[] = [
      {
        invoice_uid: 'INV_MOCK_001',
        nro_factura: '1001',
        cliente_nombre: 'Cliente de prueba',
        cliente_nit_ci: '1234567',
        fecha_emision: '01/06/2026',
        fecha_iso: '2026-06-01',
        fecha_estimada_ingreso: '2026-06-30',
        monto_pagar: 1500,
        metodo_pago: 'Transferencia',
        estado_ingreso: 'Cuenta por cobrar',
        nivel: 'Empresa privada',
        uploaded_by: session.user.email,
        uploaded_by_name: session.user.name || session.user.email,
      },
    ];

    return NextResponse.json({
      ok: true,
      message:
        'Cuentas por cobrar obtenidas en modo prueba. Configura N8N_FACTURAS_INGRESO_WEBHOOK_URL.',
      facturas: mockFacturas,
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.n8nApiKey) {
    headers['x-api-key'] = config.n8nApiKey;
  }

  const n8nResponse = await fetch(config.n8nFacturasIngresoWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'list_pending',
      requested_by: session.user.email,
      requested_by_name: session.user.name || session.user.email,
    }),
  });

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[cuentas-por-cobrar] Error n8n GET:', errorText);

    return buildErrorResponse(
      'Error al consultar cuentas por cobrar en n8n.',
      502
    );
  }

  const data = await n8nResponse.json();

  return NextResponse.json({
    ok: data.ok !== false,
    message: data.message || 'Cuentas por cobrar obtenidas correctamente.',
    facturas: data.facturas || [],
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse(
      'No autenticado. Inicia sesión para actualizar la cuenta por cobrar.',
      401
    );
  }

  const config = getServerConfig();

  let payload: MarcarIngresoPayload;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('El cuerpo de la solicitud no es JSON válido.', 400);
  }

  const invoiceUid = String(payload.invoice_uid || '').trim();
  const fechaIngresoReal = normalizeDate(payload.fecha_ingreso_real);

  if (!invoiceUid) {
    return buildErrorResponse('El invoice_uid es obligatorio.', 400);
  }

  if (!fechaIngresoReal) {
    return buildErrorResponse('La fecha real de ingreso es obligatoria.', 400);
  }

  const updatePayload = {
    invoice_uid: invoiceUid,
    estado_ingreso: 'Ya ingresado',
    fecha_ingreso_real: fechaIngresoReal,
    observacion: payload.observacion || '',
    updated_by: session.user.email,
    updated_by_name: session.user.name || session.user.email,
    updated_at: new Date().toISOString(),
  };

  if (!config.n8nFacturasIngresoWebhookUrl) {
    return NextResponse.json({
      ok: true,
      message: 'Cuenta por cobrar actualizada en modo prueba.',
      factura: {
        invoice_uid: invoiceUid,
        estado_ingreso: 'Ya ingresado',
        fecha_ingreso_real: fechaIngresoReal,
      },
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.n8nApiKey) {
    headers['x-api-key'] = config.n8nApiKey;
  }

  const n8nResponse = await fetch(config.n8nFacturasIngresoWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'mark_as_paid',
      ingreso: updatePayload,
    }),
  });

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[cuentas-por-cobrar] Error n8n PUT:', errorText);

    return buildErrorResponse(
      'Error al actualizar la cuenta por cobrar en n8n.',
      502
    );
  }

  const data = await n8nResponse.json();

  if (data.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: data.message || 'No se pudo actualizar la cuenta por cobrar.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: data.message || 'Cuenta por cobrar marcada como ya ingresada.',
    factura: data.factura,
  });
}