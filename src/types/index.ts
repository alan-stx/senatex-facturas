/**
 * Tipos compartidos para la aplicación Facturas SENATEX
 * Definen el contrato entre frontend y backend
 */

// ============================================
// Estados de la UI
// ============================================
export type UploadStatus =
  | 'idle'                // Listo para subir
  | 'uploading'           // Subiendo archivo
  | 'processing'          // Procesando en n8n
  | 'completed'           // Completado exitosamente
  | 'duplicate_invoice'   // Factura duplicada
  | 'duplicate_file'      // Archivo duplicado
  | 'error';              // Error en el proceso

// ============================================
// Metadatos del formulario de envío
// ============================================
export interface UploadMetadata {
  /** Nombre del usuario que sube la factura */
  uploaded_by: string;
  /** Sucursal desde donde se sube */
  sucursal_usuario: string;
  /** Punto de venta */
  punto_venta_usuario: string;
  /** Observación opcional */
  observacion?: string;
}

// ============================================
// Datos de la factura procesada
// ============================================
export interface InvoiceData {
  /** ID único de la factura en el sistema */
  invoice_uid?: string;
  /** Número de factura detectado */
  nro_factura?: string;
  /** Nombre del cliente */
  cliente_nombre?: string;
  /** NIT o CI del cliente */
  cliente_nit_ci?: string;
  /** Total de la factura */
  total?: number;
  /** Fecha de emisión */
  fecha_emision?: string;
  /** Hora de emisión */
  hora_emision?: string;
  /** Cantidad de ítems detectados */
  items_count?: number;
}

// ============================================
// Respuesta del backend al frontend
// ============================================
export interface UploadResponse {
  /** Indica si la operación fue exitosa */
  ok: boolean;
  /** Estado del procesamiento */
  status: 'processed' | 'duplicate_invoice' | 'duplicate_file' | 'processing_error' | 'error';
  /** Mensaje descriptivo para el usuario */
  message: string;
  /** Datos de la factura (si se procesó correctamente) */
  invoice?: InvoiceData;
  preview?: string;
}

// ============================================
// Entrada del historial de sesión
// ============================================
export interface HistoryEntry {
  /** ID único del registro */
  id: string;
  /** Fecha y hora del envío */
  timestamp: string;
  /** Nombre del archivo PDF */
  filename: string;
  /** Usuario que subió */
  uploaded_by: string;
  /** Sucursal */
  sucursal_usuario: string;
  /** Estado final */
  status: UploadStatus;
  /** Número de factura detectado */
  nro_factura?: string;
  /** Mensaje del resultado */
  items_count?: number;
  message: string;
}

// ============================================
// Configuración de la app (del servidor)
// ============================================
export interface AppConfig {
  appName: string;
  companyName: string;
  maxPdfMb: number;
  defaultBranch: string;
  defaultPos: string;
}

export interface BatchItemResult {
  id: string;
  filename: string;
  status: UploadStatus;
  message: string;
  nro_factura?: string;
  invoice_uid?: string;
}

export interface BatchSummary {
  total: number;
  processed: number;
  completed: number;
  duplicate_invoice: number;
  duplicate_file: number;
  error: number;
}
