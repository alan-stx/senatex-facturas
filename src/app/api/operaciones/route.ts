import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getServerConfig } from '@/lib/config';
import { getUserRole } from '@/lib/permissions';
import type { Operacion, OperacionCreatePayload, OperacionesResponse } from '@/types';

export const runtime = 'nodejs';

function buildErrorResponse(message: string, status: number) {
  const response: OperacionesResponse = {
    ok: false,
    message,
  };

  return NextResponse.json(response, { status });
}

function generateMockOperacionId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `OP-${random}`;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para consultar operaciones.', 401);
  }

  const role = getUserRole(session.user.email);

  if (role !== 'admin' && role !== 'comercial') {
    return buildErrorResponse('No tienes permiso para acceder a este módulo.', 403);
  }

  const config = getServerConfig();

  if (!config.n8nOperacionesWebhookUrl) {
    const mockOperaciones: Operacion[] = [
      {
        operacion_id: 'OP-0001',
        cliente_id: 'CLI-0001',
        cliente_nombre: 'Cliente de prueba',
        fecha_registro: new Date().toISOString().slice(0, 10),
        descripcion_operacion: 'Contratación institucional de prueba',
        cantidad: 100,
        tipo_operacion: 'Contrato',
        tipo_empresa: 'Institucional',
        responsable: session.user.name || session.user.email,
        estado_operacion: 'Propuesta enviada',
        nivel_certeza: 'Alta',
        probabilidad: 0.9,
        modalidad_pago: 'SIGEP',
        monto_total_comprometido: 100000,
        monto_total_ponderado: 90000,
        vigencia_desde: '',
        vigencia_hasta: '',
        observaciones: 'Registro mock mientras se configura n8n.',
        estado_general: 'Activo',
        created_by: session.user.email,
        created_by_name: session.user.name || session.user.email,
        created_at: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      ok: true,
      message: 'Operaciones obtenidas en modo prueba.',
      operaciones: mockOperaciones,
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
    n8nResponse = await fetch(config.n8nOperacionesWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'list',
        requested_by: session.user.email,
        requested_by_name: session.user.name || session.user.email,
      }),
    });
  } catch (error) {
    console.error('[operaciones] Error de conexión con n8n:', error);

    return buildErrorResponse(
      'No se pudo conectar con n8n para consultar operaciones.',
      502
    );
  }

  if (!n8nResponse.ok) {
    return buildErrorResponse('Error al consultar operaciones en n8n.', 502);
  }

  const data = await n8nResponse.json();

  return NextResponse.json({
    ok: true,
    message: data.message || 'Operaciones obtenidas correctamente.',
    operaciones: data.operaciones || [],
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para registrar operaciones.', 401);
  }

  const role = getUserRole(session.user.email);

  if (role !== 'admin' && role !== 'comercial') {
    return buildErrorResponse('No tienes permiso para acceder a este módulo.', 403);
  }

  const config = getServerConfig();

  let payload: OperacionCreatePayload;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('El cuerpo de la solicitud no es un JSON válido.', 400);
  }

  if (!payload.cliente_id) {
    return buildErrorResponse('Debe seleccionar un cliente.', 400);
  }

  if (!payload.descripcion_operacion?.trim()) {
    return buildErrorResponse('La descripción de la operación es obligatoria.', 400);
  }

  if (!payload.monto_total_comprometido || payload.monto_total_comprometido <= 0) {
    return buildErrorResponse('El monto total comprometido debe ser mayor a 0.', 400);
  }

  if (!payload.pagos_programados || payload.pagos_programados.length === 0) {
    return buildErrorResponse('Debe definir al menos un pago programado.', 400);
  }

  const totalPorcentaje = payload.pagos_programados.reduce(
    (sum, pago) => sum + Number(pago.porcentaje_programado || 0),
    0
  );

  if (Math.abs(totalPorcentaje - 100) > 0.01) {
    return buildErrorResponse('La suma de porcentajes del plan de pagos debe ser 100%.', 400);
  }

  const totalPagos = payload.pagos_programados.reduce(
    (sum, pago) => sum + Number(pago.monto_programado || 0),
    0
  );

  if (Math.abs(totalPagos - payload.monto_total_comprometido) > 0.05) {
    return buildErrorResponse('La suma de montos programados debe igualar el monto total comprometido.', 400);
  }

  const now = new Date().toISOString();

  const operacionData = {
    ...payload,
    descripcion_operacion: payload.descripcion_operacion.trim(),
    estado_general: payload.estado_general || 'Activo',
    created_by: session.user.email,
    created_by_name: session.user.name || session.user.email,
    created_at: now,
  };

  const seguimientoInicial = {
    tipo_evento: 'Registro',
    comentario: 'Registro inicial de operación comercial.',
    estado_operacion_resultante: payload.estado_operacion,
    created_by: session.user.email,
    created_by_name: session.user.name || session.user.email,
    created_at: now,
  };

  if (!config.n8nOperacionesWebhookUrl) {
    const mockOperacion: Operacion = {
      operacion_id: generateMockOperacionId(),
      cliente_id: operacionData.cliente_id,
      fecha_registro: operacionData.fecha_registro,
      descripcion_operacion: operacionData.descripcion_operacion,
      cantidad: operacionData.cantidad,
      tipo_operacion: operacionData.tipo_operacion,
      tipo_empresa: operacionData.tipo_empresa,
      responsable: operacionData.responsable,
      estado_operacion: operacionData.estado_operacion,
      nivel_certeza: operacionData.nivel_certeza,
      probabilidad: operacionData.probabilidad,
      modalidad_pago: operacionData.modalidad_pago,
      monto_total_comprometido: operacionData.monto_total_comprometido,
      monto_total_ponderado: operacionData.monto_total_ponderado,
      vigencia_desde: operacionData.vigencia_desde,
      vigencia_hasta: operacionData.vigencia_hasta,
      observaciones: operacionData.observaciones,
      estado_general: operacionData.estado_general,
      created_by: operacionData.created_by,
      created_by_name: operacionData.created_by_name,
      created_at: operacionData.created_at,
    };

    return NextResponse.json({
      ok: true,
      message: 'Operación registrada en modo prueba.',
      operacion: mockOperacion,
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
    n8nResponse = await fetch(config.n8nOperacionesWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create',
        operacion: operacionData,
        pagos_programados: payload.pagos_programados,
        seguimiento_inicial: seguimientoInicial,
      }),
    });
  } catch (error) {
    console.error('[operaciones] Error de conexión con n8n create:', error);

    return buildErrorResponse(
      'No se pudo conectar con n8n para registrar la operación.',
      502
    );
  }

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[operaciones] Error n8n:', errorText);

    return buildErrorResponse('Error al guardar la operación en n8n.', 502);
  }

  const data = await n8nResponse.json();

  if (data.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: data.message || 'No se pudo registrar la operación.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: data.message || 'Operación registrada correctamente.',
    operacion: data.operacion,
  });
}