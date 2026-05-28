
// ============================================
// Estados de la UI
// ============================================
export const PAYMENT_METHOD_OPTIONS = [
  'Efectivo',
  'QR',
  'Billetera Móvil',
  'Tarjeta',
  'Transferencia',
] as const;

export type PaymentMethod = typeof PAYMENT_METHOD_OPTIONS[number];

export const INCOME_STATUS_OPTIONS = [
  'Ya ingresado',
  'Cuenta por cobrar',
] as const;

export type IncomeStatus = typeof INCOME_STATUS_OPTIONS[number];

export const INVOICE_LEVEL_OPTIONS = [
  'Venta en tienda',
  'Empresa privada',
  'Empresa pública',
  'Institucional',
] as const;

export type InvoiceLevel = typeof INVOICE_LEVEL_OPTIONS[number];


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
  /** Correo del usuario que sube la factura */
  uploaded_by: string;

  /** Nombre del usuario que sube la factura */
  uploaded_by_name?: string;

  /** Sucursal desde donde se sube */
  sucursal_usuario: string;

  /** Punto de venta */
  punto_venta_usuario: string;

  metodo_pago: PaymentMethod;

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

  metodo_pago?: PaymentMethod;

  estado_ingreso?: IncomeStatus;
  fecha_estimada_ingreso?: string;
  fecha_ingreso_real?: string;
  nivel?: InvoiceLevel;
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

  metodo_pago?: PaymentMethod;

  estado_ingreso?: IncomeStatus;
  fecha_estimada_ingreso?: string;
  fecha_ingreso_real?: string;
  nivel?: InvoiceLevel;

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
  metodo_pago?: PaymentMethod;
  estado_ingreso?: IncomeStatus;
  fecha_estimada_ingreso?: string;
  fecha_ingreso_real?: string;
  nivel?: InvoiceLevel;
}



export interface BatchSummary {
  total: number;
  processed: number;
  completed: number;
  duplicate_invoice: number;
  duplicate_file: number;
  error: number;
}

// ============================================
// Clientes
// ============================================
export interface Cliente {
  cliente_id: string;
  razon_social: string;
  nombre_contacto?: string;
  nit?: string;
  tipo_cliente?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  estado_cliente?: string;
  observaciones?: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_at?: string;
}

export interface ClienteCreatePayload {
  razon_social: string;
  nombre_contacto?: string;
  nit?: string;
  tipo_cliente?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  estado_cliente?: string;
  observaciones?: string;
}

export interface ClienteUpdatePayload extends ClienteCreatePayload {
  cliente_id: string;
}

export interface ClientesResponse {
  ok: boolean;
  message: string;
  clientes?: Cliente[];
  cliente?: Cliente;
}

export interface CuentaPorCobrarFactura {
  invoice_uid: string;
  nro_factura?: string;
  cliente_nombre?: string;
  cliente_nit_ci?: string;
  fecha_emision?: string;
  fecha_iso?: string;
  fecha_estimada_ingreso?: string;
  fecha_ingreso_real?: string;
  monto_pagar?: number | string;
  total?: number | string;
  metodo_pago?: PaymentMethod;
  estado_ingreso?: IncomeStatus;
  nivel?: InvoiceLevel;
  uploaded_by?: string;
  uploaded_by_name?: string;
  filename_original?: string;
}

export interface CuentasPorCobrarResponse {
  ok: boolean;
  message: string;
  facturas?: CuentaPorCobrarFactura[];
  factura?: CuentaPorCobrarFactura;
}

export interface MarcarIngresoPayload {
  invoice_uid: string;
  fecha_ingreso_real: string;
  observacion?: string;
}
