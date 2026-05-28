
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerConfig } from '@/lib/config';
import {
  PAYMENT_METHOD_OPTIONS,
  INCOME_STATUS_OPTIONS,
  INVOICE_LEVEL_OPTIONS,
} from '@/types';

import type {
  PaymentMethod,
  IncomeStatus,
  InvoiceLevel,
  UploadResponse,
} from '@/types';
import { auth } from '../../../../auth';

/** Tamaño máximo del body (25MB para cubrir overhead de multipart) */
export const runtime = 'nodejs';

/**
 * Handler POST para subir facturas
 */
export async function POST(request: NextRequest) {
  const config = getServerConfig();

  const session = await auth();

  if (!session?.user?.email) {
    return buildErrorResponse('No autenticado. Inicia sesión para cargar facturas.', 401);
  }

  const uploadedByEmail = session.user.email;
  const uploadedByName = session.user.name || session.user.email;

  try {
    // ── Parsear el multipart/form-data ────────────────────────
    const formData = await request.formData();
    const file = formData.get('archivo') as File | null;
    // ── Validar que exista archivo ────────────────────────────
    if (!file) {
      return buildErrorResponse('No se recibió ningún archivo.', 400);
    }

    // ── Validar tipo MIME ────────────────────────────────────
    if (file.type !== 'application/pdf') {
      return buildErrorResponse(
        'El archivo debe ser un PDF válido. Se recibió: ' + file.type,
        400
      );
    }

    // ── Validar extensión ────────────────────────────────────
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return buildErrorResponse(
        'El archivo debe tener extensión .pdf',
        400
      );
    }

    // ── Validar tamaño ──────────────────────────────────────
    const maxBytes = config.maxPdfMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return buildErrorResponse(
        `El archivo excede el tamaño máximo permitido de ${config.maxPdfMb} MB.`,
        400
      );
    }

    // ── Generar hash SHA-256 del archivo ────────────────────
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

    const metodoPago = normalizePaymentMethod(
      (formData.get('metodo_pago') as string) || 'Efectivo'
    );

    const estadoIngreso = normalizeIncomeStatus(
      (formData.get('estado_ingreso') as string) || 'Ya ingresado'
    );

    const fechaEstimadaIngreso =
      ((formData.get('fecha_estimada_ingreso') as string) || '').trim();

    const nivel = normalizeInvoiceLevel(
      (formData.get('nivel') as string) || 'Venta en tienda'
    );

    if (estadoIngreso === 'Cuenta por cobrar' && !fechaEstimadaIngreso) {
      return buildErrorResponse(
        'Debes indicar una fecha estimada de ingreso para las facturas por cobrar.',
        400
      );
    }

    // MOCK RESPONSE SI NO HAY WEBHOOK
    if (!config.n8nWebhookUrl) {
      // Simular un retardo de procesamiento (1-2s)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const fileName = file.name.toLowerCase();

      // Decidir tipo de mock basado en el nombre del archivo para facilitar pruebas
      let mockResponse: UploadResponse;

      if (fileName.includes('error')) {
        mockResponse = {
          ok: false,
          status: 'processing_error',
          message: 'Error al procesar el archivo en el motor OCR.',
        };
      } else if (fileName.includes('dup_file')) {
        mockResponse = {
          ok: true,
          status: 'duplicate_file',
          message: 'Este archivo exacto ya fue procesado anteriormente.',
        };
      } else if (fileName.includes('dup_inv')) {
        mockResponse = {
          ok: true,
          status: 'duplicate_invoice',
          message: 'Esta factura ya existe en el sistema.',
          invoice: {
            nro_factura: '728',
            cliente_nombre: 'MOCK EXCEPTION SR.',
            cliente_nit_ci: '9876543',
            total: 345.50,
            metodo_pago: metodoPago,
          }
        };
      } else {
        mockResponse = {
          ok: true,
          status: 'processed',
          message: 'Factura procesada y guardada correctamente.',
          invoice: {
            invoice_uid: `SENATEX-${Math.floor(Math.random() * 100000000)}-${Math.floor(Math.random() * 10000)}`,
            nro_factura: `${Math.floor(Math.random() * 10000)}`,
            cliente_nombre: 'CLIENTE DE PRUEBA',
            cliente_nit_ci: `${1000000 + Math.floor(Math.random() * 9000000)}`,
            total: 154.20,
            fecha_emision: new Date().toLocaleDateString('es-BO'),
            hora_emision: new Date().toLocaleTimeString('es-BO', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            items_count: 3,
            metodo_pago: metodoPago,
          }
        };
      }

      return NextResponse.json(mockResponse, { status: 200 });
    }

    // ── Preparar FormData para enviar a n8n ─────────────────
    const n8nFormData = new FormData();

    // Recrear el File desde el buffer para enviarlo a n8n
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    n8nFormData.append('archivo', blob, file.name);

    // Metadatos enviados desde el frontend (fueron seteados a defaults vacíos/genéricos)
    n8nFormData.append('uploaded_by', uploadedByEmail);
    n8nFormData.append('uploaded_by_name', uploadedByName);

    n8nFormData.append('sucursal_usuario', (formData.get('sucursal_usuario') as string) || '');
    n8nFormData.append('punto_venta_usuario', (formData.get('punto_venta_usuario') as string) || '');
    n8nFormData.append('observacion', (formData.get('observacion') as string) || '');
    n8nFormData.append('metodo_pago', metodoPago);
    n8nFormData.append('estado_ingreso', estadoIngreso);
    n8nFormData.append('fecha_estimada_ingreso', fechaEstimadaIngreso);
    n8nFormData.append('nivel', nivel);
    n8nFormData.append('file_hash', fileHash);
    n8nFormData.append('file_size', file.size.toString());
    n8nFormData.append('file_name', file.name);

    // ── Enviar a n8n ────────────────────────────────────────
    const headers: Record<string, string> = {};
    if (config.n8nApiKey) {
      headers['x-api-key'] = config.n8nApiKey;
    }

    const n8nResponse = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers,
      body: n8nFormData,
    });

    // ── Procesar respuesta de n8n ───────────────────────────
    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text().catch(() => 'Sin detalle');
      console.error('[upload-factura] n8n respondió con error:', {
        status: n8nResponse.status,
        body: errorText,
      });
      return buildErrorResponse(
        `Error al procesar la factura en el servidor. (Código: ${n8nResponse.status})`,
        502
      );
    }

    // ── Parsear JSON de n8n ─────────────────────────────────
    let n8nData;
    try {
      n8nData = await n8nResponse.json();
    } catch {
      console.error('[upload-factura] n8n no devolvió JSON válido');
      return buildErrorResponse(
        'El servidor de procesamiento devolvió una respuesta inválida.',
        502
      );
    }

    // ── Normalizar respuesta para el frontend ───────────────
    let normalizedStatus = n8nData.status || 'processed';
    let normalizedMessage = n8nData.message || 'Factura procesada correctamente.';

    // Normalizar estados genéricos de n8n
    if (normalizedStatus === 'duplicate') {
      if (n8nData.duplicate_reason === 'factura_duplicada' || n8nData.processing_status === 'duplicate_invoice') {
        normalizedStatus = 'duplicate_invoice';
        normalizedMessage = 'Esta factura ya existe en el sistema.';
      } else {
        normalizedStatus = 'duplicate_file';
        normalizedMessage = 'Este archivo ya fue cargado anteriormente.';
      }
    }

    if (normalizedStatus === 'invalid') {
      normalizedStatus = 'processing_error';
      normalizedMessage = n8nData.message || 'La factura tiene datos incompletos o inconsistentes.';
    }

    const invoice = n8nData.invoice
    ? {
        ...n8nData.invoice,
        invoice_uid: n8nData.invoice.invoice_uid || n8nData.invoice_uid,
        metodo_pago: n8nData.invoice.metodo_pago || metodoPago,
        estado_ingreso: n8nData.invoice.estado_ingreso || estadoIngreso,
        fecha_estimada_ingreso:
          n8nData.invoice.fecha_estimada_ingreso || fechaEstimadaIngreso,
        fecha_ingreso_real: n8nData.invoice.fecha_ingreso_real || undefined,
        nivel: n8nData.invoice.nivel || nivel,
      }
    : n8nData.invoice_uid
      ? {
          invoice_uid: n8nData.invoice_uid,
          metodo_pago: metodoPago,
          estado_ingreso: estadoIngreso,
          fecha_estimada_ingreso: fechaEstimadaIngreso,
          nivel,
        }
      : undefined;

    const response: UploadResponse = {
      ok: normalizedStatus === 'processed' || normalizedStatus === 'duplicate_invoice' || normalizedStatus === 'duplicate_file',
      status: normalizedStatus,
      message: normalizedMessage,
      invoice,
      preview: n8nData.preview || undefined,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[upload-factura] Error inesperado:', error);
    return buildErrorResponse(
      'Ocurrió un error inesperado al procesar la solicitud.',
      500
    );
  }
}

/**
 * Construye una respuesta de error uniforme
 */
function normalizePaymentMethod(value: string): PaymentMethod {
  const clean = String(value || '').trim();

  return PAYMENT_METHOD_OPTIONS.includes(clean as PaymentMethod)
    ? (clean as PaymentMethod)
    : 'Efectivo';
}

function normalizeIncomeStatus(value: string): IncomeStatus {
  const clean = String(value || '').trim();

  return INCOME_STATUS_OPTIONS.includes(clean as IncomeStatus)
    ? (clean as IncomeStatus)
    : 'Ya ingresado';
}

function normalizeInvoiceLevel(value: string): InvoiceLevel {
  const clean = String(value || '').trim();

  return INVOICE_LEVEL_OPTIONS.includes(clean as InvoiceLevel)
    ? (clean as InvoiceLevel)
    : 'Venta en tienda';
}

function buildErrorResponse(message: string, httpStatus: number) {
  const response: UploadResponse = {
    ok: false,
    status: 'error',
    message,
  };
  return NextResponse.json(response, { status: httpStatus });
}
