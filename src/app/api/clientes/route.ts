import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getServerConfig } from '@/lib/config';
import type { Cliente, ClienteCreatePayload, ClienteUpdatePayload, ClientesResponse } from '@/types';

export const runtime = 'nodejs';

function buildErrorResponse(message: string, status: number) {
  const response: ClientesResponse = {
    ok: false,
    message,
  };

  return NextResponse.json(response, { status });
}

function generateMockClienteId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CLI-${random}`;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para consultar clientes.', 401);
  }

  const config = getServerConfig();

  if (!config.n8nClientesWebhookUrl) {
    const mockClientes: Cliente[] = [
      {
        cliente_id: 'CLI-0001',
        razon_social: 'Cliente institucional de prueba',
        nombre_contacto: 'Contacto de prueba',
        nit: '1234567',
        tipo_cliente: 'Institucional',
        telefono: '70000000',
        correo: 'cliente@ejemplo.com',
        direccion: 'La Paz',
        estado_cliente: 'Activo',
        observaciones: 'Registro de prueba mientras se configura n8n.',
        created_by: session.user.email,
        created_by_name: session.user.name || session.user.email,
        created_at: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      ok: true,
      message: 'Clientes obtenidos en modo prueba.',
      clientes: mockClientes,
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.n8nApiKey) {
    headers['x-api-key'] = config.n8nApiKey;
  }

  const n8nResponse = await fetch(config.n8nClientesWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'list',
      requested_by: session.user.email,
      requested_by_name: session.user.name || session.user.email,
    }),
  });

  if (!n8nResponse.ok) {
    return buildErrorResponse('Error al consultar clientes en n8n.', 502);
  }

  const data = await n8nResponse.json();

  return NextResponse.json({
    ok: true,
    message: data.message || 'Clientes obtenidos correctamente.',
    clientes: data.clientes || [],
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para registrar clientes.', 401);
  }

  const config = getServerConfig();

  let payload: ClienteCreatePayload;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('El cuerpo de la solicitud no es un JSON válido.', 400);
  }

  const razonSocial = payload.razon_social?.trim();

  if (!razonSocial) {
    return buildErrorResponse('La razón social es obligatoria.', 400);
  }

  const now = new Date().toISOString();

  const clienteData = {
    ...payload,
    razon_social: razonSocial,
    estado_cliente: payload.estado_cliente || 'Activo',
    created_by: session.user.email,
    created_by_name: session.user.name || session.user.email,
    created_at: now,
  };

  if (!config.n8nClientesWebhookUrl) {
    const mockCliente: Cliente = {
      cliente_id: generateMockClienteId(),
      ...clienteData,
    };

    return NextResponse.json({
      ok: true,
      message: 'Cliente registrado en modo prueba. Configura N8N_CLIENTES_WEBHOOK_URL para guardar en Google Sheets.',
      cliente: mockCliente,
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.n8nApiKey) {
    headers['x-api-key'] = config.n8nApiKey;
  }

  const n8nResponse = await fetch(config.n8nClientesWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'create',
      cliente: clienteData,
    }),
  });

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[clientes] Error n8n:', errorText);

    return buildErrorResponse('Error al guardar el cliente en n8n.', 502);
  }

  const data = await n8nResponse.json();

  return NextResponse.json({
    ok: true,
    message: data.message || 'Cliente registrado correctamente.',
    cliente: data.cliente,
  });
}
export async function PUT(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para actualizar clientes.', 401);
  }

  const config = getServerConfig();

  let payload: ClienteUpdatePayload;

  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('El cuerpo de la solicitud no es un JSON válido.', 400);
  }

  const clienteId = payload.cliente_id?.trim();
  const razonSocial = payload.razon_social?.trim();

  if (!clienteId) {
    return buildErrorResponse('El cliente_id es obligatorio para actualizar.', 400);
  }

  if (!razonSocial) {
    return buildErrorResponse('La razón social es obligatoria.', 400);
  }

  const now = new Date().toISOString();

  const clienteData = {
    ...payload,
    cliente_id: clienteId,
    razon_social: razonSocial,
    estado_cliente: payload.estado_cliente || 'Activo',
    updated_by: session.user.email,
    updated_by_name: session.user.name || session.user.email,
    updated_at: now,
  };

  if (!config.n8nClientesWebhookUrl) {
    const mockCliente: Cliente = {
      ...clienteData,
    };

    return NextResponse.json({
      ok: true,
      message: 'Cliente actualizado en modo prueba.',
      cliente: mockCliente,
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.n8nApiKey) {
    headers['x-api-key'] = config.n8nApiKey;
  }

  const n8nResponse = await fetch(config.n8nClientesWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'update',
      cliente: clienteData,
    }),
  });

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text().catch(() => '');
    console.error('[clientes] Error n8n update:', errorText);

    return buildErrorResponse('Error al actualizar el cliente en n8n.', 502);
  }

  const data = await n8nResponse.json();

  if (data.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: data.message || 'No se pudo actualizar el cliente.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: data.message || 'Cliente actualizado correctamente.',
    cliente: data.cliente,
  });
}