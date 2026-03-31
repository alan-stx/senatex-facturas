'use client';

import type { UploadResponse } from '@/types';

interface ResultCardProps {
  /** Respuesta del backend */
  result: UploadResponse;
  /** Callback para subir otra factura */
  onReset: () => void;
}

/**
 * Tarjeta de resultado del procesamiento
 * Muestra datos de la factura, estado y acciones
 */
export default function ResultCard({ result, onReset }: ResultCardProps) {
  const { status, message, invoice, preview } = result;

  // Determinar clase y metadata según estado
  const isSuccess = status === 'processed';
  const isDuplicate = status === 'duplicate_invoice' || status === 'duplicate_file';
  const isError = status === 'error' || status === 'processing_error';

  const cardClass = isSuccess
    ? 'result-card--success'
    : isDuplicate
    ? 'result-card--duplicate'
    : 'result-card--error';

  const statusLabel = isSuccess
    ? 'Procesada'
    : status === 'duplicate_invoice'
    ? 'Factura ya registrada'
    : status === 'duplicate_file'
    ? 'Archivo ya cargado'
    : 'Error de procesamiento';

  const statusClass = isSuccess
    ? 'result-header__status--success'
    : isDuplicate
    ? 'result-header__status--duplicate'
    : 'result-header__status--error';

  const icon = isSuccess ? '✅' : isDuplicate ? '⚠️' : '❌';

  return (
    <div className={`result-card ${cardClass}`} id="result-card" role="status">
      {/* Encabezado del resultado */}
      <div className="result-header">
        <div className="result-header__icon">{icon}</div>
        <div className="result-header__content">
          <span className={`result-header__status ${statusClass}`}>
            {statusLabel}
          </span>
          <h3 className="result-header__title">{message}</h3>
        </div>
      </div>

      {preview && (
        <div className="result-preview">
          <div className="result-preview__label">Texto extraído (preview)</div>
          <pre className="result-preview__content">
            {preview.length > 1200 ? `${preview.slice(0, 1200)}...` : preview}
          </pre>
        </div>
      )}

      {/* Detalles de la factura (solo si hay datos) */}
      {invoice && (
        <div className="result-details">
          {invoice.nro_factura && (
            <div className="result-detail">
              <div className="result-detail__label">Nro. Factura</div>
              <div className="result-detail__value">{invoice.nro_factura}</div>
            </div>
          )}

          {invoice.cliente_nombre && (
            <div className="result-detail">
              <div className="result-detail__label">Cliente</div>
              <div className="result-detail__value">{invoice.cliente_nombre}</div>
            </div>
          )}

          {invoice.total !== undefined && invoice.total !== null && (
            <div className="result-detail">
              <div className="result-detail__label">Total</div>
              <div className="result-detail__value">
                Bs. {invoice.total.toFixed(2)}
              </div>
            </div>
          )}

          {invoice.fecha_emision && (
            <div className="result-detail">
              <div className="result-detail__label">Fecha Emisión</div>
              <div className="result-detail__value">
                {invoice.fecha_emision}
                {invoice.hora_emision ? ` — ${invoice.hora_emision}` : ''}
              </div>
            </div>
          )}

          {invoice.cliente_nit_ci && (
            <div className="result-detail">
              <div className="result-detail__label">NIT / CI</div>
              <div className="result-detail__value">{invoice.cliente_nit_ci}</div>
            </div>
          )}

          {invoice.items_count !== undefined && invoice.items_count !== null && (
            <div className="result-detail">
              <div className="result-detail__label">Ítems Detectados</div>
              <div className="result-detail__value">{invoice.items_count}</div>
            </div>
          )}

          {invoice.invoice_uid && (
            <div className="result-detail" style={{ gridColumn: '1 / -1' }}>
              <div className="result-detail__label">ID Único</div>
              <div className="result-detail__value" style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                {invoice.invoice_uid}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botón para nueva factura */}
      <div className="result-actions">
        <button
          className="btn-secondary"
          onClick={onReset}
          type="button"
          id="btn-new-upload"
        >
          📄 Subir otra factura
        </button>
      </div>
    </div>
  );
}
