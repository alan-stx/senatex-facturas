
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


// ============================================
// Operaciones / Contrataciones
// ============================================
export type NivelCerteza = 'Alta' | 'Media' | 'Baja';

/**
 * Tipos de operación disponibles para nuevas operaciones.
 * Se eliminaron 'Cotización' y 'Otro': la situación de cotización ahora se
 * representa con el estado comercial, no con el tipo. Los registros históricos
 * con tipos no válidos se conservan, pero al editar se exige reseleccionar.
 */
export const TIPO_OPERACION_OPTIONS = [
  'Contrato',
  'Adjudicación',
  'Venta institucional',
] as const;

export type TipoOperacion = typeof TIPO_OPERACION_OPTIONS[number];

/** Modo del formulario de operaciones. */
export type FormMode = 'create' | 'edit' | 'activate';

/**
 * Estado comercial simplificado: solo tres valores posibles en la columna
 * `estado_operacion`. El estado de cobro va aparte (ver ESTADO_COBRO_OPTIONS).
 *  - Cotización: todavía no aprobada.
 *  - Vigente: aprobada / confirmada.
 *  - Cerrada: no continúa o ya se cerró.
 */
export const ESTADO_COMERCIAL_OPTIONS = [
  'Cotización',
  'Vigente',
  'Cerrada',
] as const;

export type EstadoComercial = typeof ESTADO_COMERCIAL_OPTIONS[number];

/** Estado de cobro derivado de Pagos_Programados y Depositos (no se guarda en Operaciones). */
export const ESTADO_COBRO_OPTIONS = [
  'Sin plan',
  'Pendiente',
  'Cobro parcial',
  'Pagado',
  'Vencido',
] as const;

export type EstadoCobro = typeof ESTADO_COBRO_OPTIONS[number];

/**
 * Normaliza el estado comercial al modelo de 3 valores
 * (Cotización | Vigente | Cerrada). Mapea valores históricos sin tocar los
 * datos almacenados en carga; al guardar se persiste ya normalizado.
 */
export function normalizeEstadoComercial(value: string | undefined): string {
  const current = String(value || '').trim();

  // Vigente (incluye el histórico "Cobro parcial").
  if (current === 'Vigente' || current === 'Cobro parcial') return 'Vigente';

  // Cierre / no continúa (incluye estados históricos eliminados).
  if (
    current === 'Cerrada' ||
    current === 'No aprobada' ||
    current === 'No aceptada' ||
    current === 'Anulada' ||
    current === 'Perdida'
  ) {
    return 'Cerrada';
  }

  // Todo lo relacionado a cotización (y valores vacíos/desconocidos) → Cotización.
  return 'Cotización';
}

export interface PagoProgramadoForm {
  numero_pago: number;
  concepto_pago: string;
  porcentaje_programado: number;
  monto_programado: number;
  fecha_programada: string;
  estado_pago: string;
}

export interface Operacion {
  operacion_id: string;
  cliente_id: string;
  cliente_nombre?: string;
  fecha_registro: string;
  descripcion_operacion: string;
  cantidad?: number;
  tipo_operacion: string;
  tipo_empresa: string;
  responsable: string;
  estado_operacion: string;
  nivel_certeza?: NivelCerteza;
  probabilidad?: number;
  /** Opcional: la modalidad real se selecciona al registrar el pago, no aquí. */
  modalidad_pago?: string;
  monto_total_comprometido: number;
  monto_total_ponderado?: number;
  vigencia_desde?: string;
  vigencia_hasta?: string;
  observaciones?: string;
  estado_general?: string;
  /** Derivados del listado (calculados en n8n desde Pagos_Programados/Depositos). */
  tiene_pagos?: boolean;
  tiene_depositos?: boolean;
  estado_cobro?: string;
  /**
   * Marcado por n8n en `list`: la fila histórica figura como "Cotización"
   * pero ya tiene pagos o depósitos, por lo que su estado efectivo es "Vigente".
   */
  requiere_regularizacion?: boolean;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_at?: string;
}

export interface OperacionCreatePayload {
  cliente_id: string;
  fecha_registro: string;
  descripcion_operacion: string;
  cantidad?: number;
  tipo_operacion: string;
  tipo_empresa: string;
  responsable: string;
  estado_operacion: string;
  nivel_certeza?: NivelCerteza;
  probabilidad?: number;
  /** Opcional: en nuevas operaciones se envía vacía. */
  modalidad_pago?: string;
  monto_total_comprometido: number;
  monto_total_ponderado?: number;
  vigencia_desde?: string;
  vigencia_hasta?: string;
  observaciones?: string;
  estado_general?: string;
  pagos_programados: PagoProgramadoForm[];
}

export interface OperacionUpdatePayload extends OperacionCreatePayload {
  operacion_id: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_at?: string;
}

/**
 * Payload para aprobar/activar una cotización (PATCH /api/operaciones).
 * Solo transporta lo necesario para volver Vigente una operación y crear su plan.
 */
export interface OperacionActivarPayload {
  operacion_id: string;
  monto_total_comprometido: number;
  vigencia_desde: string;
  vigencia_hasta: string;
  pagos_programados: PagoProgramadoForm[];
}

export interface OperacionesResponse {
  ok: boolean;
  message: string;
  operaciones?: Operacion[];
  operacion?: Operacion;
}

// ============================================
// Pagos y Depósitos
// ============================================
export interface PagoProgramado {
  pago_id: string;
  operacion_id: string;
  cliente_id: string;
  cliente_nombre?: string;
  descripcion_operacion?: string;
  numero_pago: number;
  concepto_pago: string;
  porcentaje_programado: number;
  monto_programado: number;
  fecha_programada: string;
  estado_pago: string;
  monto_pagado_acumulado: number;
  saldo_pago: number;
  fecha_ultimo_pago?: string;
  modalidad_pago?: string;
  observaciones?: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_at?: string;
}

export interface DepositoCreatePayload {
  pago_id: string;
  operacion_id: string;
  cliente_id: string;
  fecha_deposito: string;
  monto_depositado: number;
  modalidad_pago: string;
  nro_comprobante?: string;
  observacion?: string;
}

export interface PagosResponse {
  ok: boolean;
  message: string;
  pagos?: PagoProgramado[];
  pago?: PagoProgramado;
}