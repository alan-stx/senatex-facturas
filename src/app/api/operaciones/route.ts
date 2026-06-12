import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getServerConfig } from '@/lib/config';
import { getUserRole } from '@/lib/permissions';
import {
  normalizeEstadoComercial,
  type Operacion,
  type OperacionActivarPayload,
  type OperacionCreatePayload,
  type OperacionUpdatePayload,
  type OperacionesResponse,
  type PagoProgramadoForm,
} from '@/types';

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

/**
 * Al crear solo se aceptan dos estados comerciales: "Cotización enviada" y
 * "Vigente". Cualquier otro valor se trata como "Cotización enviada".
 */
function coerceEstadoCreate(value: string | undefined): 'Cotización enviada' | 'Vigente' {
  return normalizeEstadoComercial(value) === 'Vigente' ? 'Vigente' : 'Cotización enviada';
}

/**
 * Valida el plan completo de una operación vigente: monto, vigencias y pagos.
 * Se reutiliza al crear como Vigente (POST) y al activar una cotización (PATCH).
 * Devuelve un mensaje de error o null si todo es válido.
 */
function validatePlanVigente(input: {
  monto_total_comprometido: number | undefined;
  vigencia_desde: string | undefined;
  vigencia_hasta: string | undefined;
  pagos_programados: PagoProgramadoForm[] | undefined;
}): string | null {
  const monto = Number(input.monto_total_comprometido || 0);

  if (!monto || monto <= 0) {
    return 'El monto de la operación debe ser mayor a 0.';
  }

  const desde = String(input.vigencia_desde || '').trim();
  const hasta = String(input.vigencia_hasta || '').trim();

  if (!desde || !hasta) {
    return 'Debe indicar la vigencia desde y la vigencia hasta.';
  }

  if (hasta < desde) {
    return 'La vigencia hasta no puede ser anterior a la vigencia desde.';
  }

  const pagos = input.pagos_programados || [];

  if (!pagos.length) {
    return 'Debe definir al menos un pago programado.';
  }

  for (const pago of pagos) {
    if (!String(pago.fecha_programada || '').trim()) {
      return 'Cada pago programado debe tener una fecha programada.';
    }
  }

  const totalPorcentaje = pagos.reduce(
    (sum, pago) => sum + Number(pago.porcentaje_programado || 0),
    0
  );

  if (Math.abs(totalPorcentaje - 100) > 0.01) {
    return 'La suma de porcentajes del plan de pagos debe ser 100%.';
  }

  const totalPagos = pagos.reduce(
    (sum, pago) => sum + Number(pago.monto_programado || 0),
    0
  );

  if (Math.abs(totalPagos - monto) > 0.05) {
    return 'La suma de montos programados debe igualar el monto total.';
  }

  return null;
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
        estado_operacion: 'Cotización enviada',
        modalidad_pago: '',
        monto_total_comprometido: 100000,
        vigencia_desde: '',
        vigencia_hasta: '',
        observaciones: 'Registro mock mientras se configura n8n.',
        estado_general: 'Activo',
        tiene_pagos: false,
        tiene_depositos: false,
        estado_cobro: 'Sin plan',
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

  // Solo se permite crear como "Cotización enviada" o "Vigente".
  const estado = coerceEstadoCreate(payload.estado_operacion);

  let pagosProgramados: PagoProgramadoForm[] = [];
  let vigenciaDesde = '';
  let vigenciaHasta = '';

  if (estado === 'Vigente') {
    const planError = validatePlanVigente({
      monto_total_comprometido: payload.monto_total_comprometido,
      vigencia_desde: payload.vigencia_desde,
      vigencia_hasta: payload.vigencia_hasta,
      pagos_programados: payload.pagos_programados,
    });

    if (planError) {
      return buildErrorResponse(planError, 400);
    }

    pagosProgramados = payload.pagos_programados || [];
    vigenciaDesde = String(payload.vigencia_desde || '').trim();
    vigenciaHasta = String(payload.vigencia_hasta || '').trim();
  }

  const now = new Date().toISOString();

  const operacionData = {
    ...payload,
    descripcion_operacion: payload.descripcion_operacion.trim(),
    estado_operacion: estado,
    // La modalidad real se selecciona al registrar el pago (módulo Pagos).
    modalidad_pago: '',
    vigencia_desde: vigenciaDesde,
    vigencia_hasta: vigenciaHasta,
    // Compatibilidad con columnas históricas de Sheets (ya no se usan en la UI).
    nivel_certeza: payload.nivel_certeza || '',
    probabilidad: payload.probabilidad ?? 0,
    monto_total_ponderado: payload.monto_total_ponderado ?? 0,
    estado_general: payload.estado_general || 'Activo',
    pagos_programados: pagosProgramados,
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
      modalidad_pago: '',
      monto_total_comprometido: operacionData.monto_total_comprometido,
      vigencia_desde: operacionData.vigencia_desde,
      vigencia_hasta: operacionData.vigencia_hasta,
      observaciones: operacionData.observaciones,
      estado_general: operacionData.estado_general,
      tiene_pagos: pagosProgramados.length > 0,
      tiene_depositos: false,
      estado_cobro: pagosProgramados.length > 0 ? 'Pendiente' : 'Sin plan',
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
        pagos_programados: pagosProgramados,
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

export async function PUT(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para actualizar operaciones.', 401);
  }

  const role = getUserRole(session.user.email);

  if (role !== 'admin' && role !== 'comercial') {
    return buildErrorResponse('No tienes permiso para acceder a este módulo.', 403);
  }

  const config = getServerConfig();

  let payload: OperacionUpdatePayload;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('El cuerpo de la solicitud no es un JSON válido.', 400);
  }

  if (!payload.operacion_id) {
    return buildErrorResponse('Falta el identificador de la operación a actualizar.', 400);
  }

  if (!payload.cliente_id) {
    return buildErrorResponse('Debe seleccionar un cliente.', 400);
  }

  if (!payload.descripcion_operacion?.trim()) {
    return buildErrorResponse('La descripción de la operación es obligatoria.', 400);
  }

  const now = new Date().toISOString();

  // PUT solo edita datos generales: nunca crea pagos y no cambia el estado
  // comercial (n8n preserva el estado existente cuando action = update).
  const operacionData = {
    ...payload,
    descripcion_operacion: payload.descripcion_operacion.trim(),
    // Vacía: n8n conserva la modalidad previa si esta llega vacía.
    modalidad_pago: '',
    nivel_certeza: payload.nivel_certeza || '',
    probabilidad: payload.probabilidad ?? 0,
    monto_total_ponderado: payload.monto_total_ponderado ?? 0,
    estado_general: payload.estado_general || 'Activo',
    pagos_programados: [],
    updated_by: session.user.email,
    updated_by_name: session.user.name || session.user.email,
    updated_at: now,
  };

  if (!config.n8nOperacionesWebhookUrl) {
    const mockOperacion: Operacion = {
      operacion_id: payload.operacion_id,
      cliente_id: operacionData.cliente_id,
      fecha_registro: operacionData.fecha_registro,
      descripcion_operacion: operacionData.descripcion_operacion,
      cantidad: operacionData.cantidad,
      tipo_operacion: operacionData.tipo_operacion,
      tipo_empresa: operacionData.tipo_empresa,
      responsable: operacionData.responsable,
      estado_operacion: normalizeEstadoComercial(payload.estado_operacion),
      modalidad_pago: payload.modalidad_pago || '',
      monto_total_comprometido: operacionData.monto_total_comprometido,
      vigencia_desde: operacionData.vigencia_desde,
      vigencia_hasta: operacionData.vigencia_hasta,
      observaciones: operacionData.observaciones,
      estado_general: operacionData.estado_general,
      updated_by: operacionData.updated_by,
      updated_by_name: operacionData.updated_by_name,
      updated_at: operacionData.updated_at,
    };

    return NextResponse.json({
      ok: true,
      message: 'Operación actualizada en modo prueba.',
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
        action: 'update',
        operacion: operacionData,
        pagos_programados: [],
      }),
    });
  } catch (error) {
    console.error('[operaciones] Error de conexión con n8n update:', error);

    return buildErrorResponse(
      'No se pudo conectar con n8n para actualizar la operación.',
      502
    );
  }

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[operaciones] Error n8n update:', errorText);

    return buildErrorResponse('Error al actualizar la operación en n8n.', 502);
  }

  const data = await n8nResponse.json();

  if (data.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: data.message || 'No se pudo actualizar la operación.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: data.message || 'Operación actualizada correctamente.',
    operacion: data.operacion,
  });
}

/**
 * PATCH = aprobar/activar una cotización.
 * Valida el plan completo y delega en n8n (action = activate), que de forma
 * idempotente vuelve Vigente la operación y crea el plan de pagos si no existe.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para activar operaciones.', 401);
  }

  const role = getUserRole(session.user.email);

  if (role !== 'admin' && role !== 'comercial') {
    return buildErrorResponse('No tienes permiso para acceder a este módulo.', 403);
  }

  const config = getServerConfig();

  let payload: OperacionActivarPayload;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('El cuerpo de la solicitud no es un JSON válido.', 400);
  }

  if (!payload.operacion_id) {
    return buildErrorResponse('Falta el identificador de la operación a activar.', 400);
  }

  const planError = validatePlanVigente({
    monto_total_comprometido: payload.monto_total_comprometido,
    vigencia_desde: payload.vigencia_desde,
    vigencia_hasta: payload.vigencia_hasta,
    pagos_programados: payload.pagos_programados,
  });

  if (planError) {
    return buildErrorResponse(planError, 400);
  }

  const now = new Date().toISOString();

  const operacion = {
    operacion_id: payload.operacion_id,
    monto_total_comprometido: Number(payload.monto_total_comprometido || 0),
    vigencia_desde: String(payload.vigencia_desde || '').trim(),
    vigencia_hasta: String(payload.vigencia_hasta || '').trim(),
    updated_by: session.user.email,
    updated_by_name: session.user.name || session.user.email,
    updated_at: now,
  };

  const pagosProgramados = payload.pagos_programados || [];

  if (!config.n8nOperacionesWebhookUrl) {
    const mockOperacion: Operacion = {
      operacion_id: operacion.operacion_id,
      cliente_id: '',
      fecha_registro: now.slice(0, 10),
      descripcion_operacion: '',
      tipo_operacion: '',
      tipo_empresa: '',
      responsable: session.user.name || session.user.email,
      estado_operacion: 'Vigente',
      modalidad_pago: '',
      monto_total_comprometido: operacion.monto_total_comprometido,
      vigencia_desde: operacion.vigencia_desde,
      vigencia_hasta: operacion.vigencia_hasta,
      estado_general: 'Activo',
      tiene_pagos: true,
      tiene_depositos: false,
      estado_cobro: 'Pendiente',
      updated_by: operacion.updated_by,
      updated_by_name: operacion.updated_by_name,
      updated_at: operacion.updated_at,
    };

    return NextResponse.json({
      ok: true,
      message: 'Operación activada en modo prueba.',
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
        action: 'activate',
        operacion,
        pagos_programados: pagosProgramados,
      }),
    });
  } catch (error) {
    console.error('[operaciones] Error de conexión con n8n activate:', error);

    return buildErrorResponse(
      'No se pudo conectar con n8n para activar la operación.',
      502
    );
  }

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[operaciones] Error n8n activate:', errorText);

    return buildErrorResponse('Error al activar la operación en n8n.', 502);
  }

  const data = await n8nResponse.json();

  if (data.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: data.message || 'No se pudo activar la operación.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: data.message || 'Operación activada correctamente.',
    operacion: data.operacion,
  });
}
