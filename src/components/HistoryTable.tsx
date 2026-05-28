'use client';

import type { HistoryEntry, UploadStatus } from '@/types';

interface HistoryTableProps {
  /** Entradas del historial */
  entries: HistoryEntry[];
}

/**
 * Mapeo de estado a badge visual
 */
function StatusBadge({ status }: { status: UploadStatus }) {
  const labels: Record<string, string> = {
    completed: '✓ Procesada',
    duplicate_invoice: '⚠ Factura Duplicada',
    duplicate_file: '⚠ Archivo Duplicado',
    error: '✕ Error',
    uploading: '↑ Subiendo',
    processing: '⟳ Procesando',
    idle: '— Pendiente',
  };

  // Convert duplicate types to duplicate for base class if needed, or target them directly in CSS
  const cssClass = status.startsWith('duplicate') ? 'duplicate' : status;

  return (
    <span className={`status-badge status-badge--${cssClass}`}>
      {labels[status] || status}
    </span>
  );
}

/**
 * Tabla del historial de envíos de la sesión actual
 */
export default function HistoryTable({ entries }: HistoryTableProps) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📋</div>
        <div>No hay envíos en esta sesión aún.</div>
      </div>
    );
  }

  return (
    <div className="history-table-wrapper">
      <table className="history-table" id="history-table">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Archivo</th>
            <th>Usuario</th>
            <th>Sucursal</th>
            <th>Método</th>
            <th>Estado</th>
            <th>Ítems</th>
            <th>Mensaje</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                {new Date(entry.timestamp).toLocaleTimeString('es-BO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td title={entry.filename} style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.filename}
              </td>
              <td>{entry.uploaded_by}</td>
              <td>{entry.sucursal_usuario}</td>
              <td>{entry.metodo_pago ?? '—'}</td>
              <td>
                <StatusBadge status={entry.status} />
              </td>
              <td>{entry.items_count ?? '—'}</td>
              <td title={entry.message} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
