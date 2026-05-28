'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

import type {
  CuentaPorCobrarFactura,
  CuentasPorCobrarResponse,
} from '@/types';

function formatMoney(value: number | string | undefined) {
  const num = Number(value || 0);

  if (!Number.isFinite(num)) return 'Bs. 0,00';

  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(num);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysDiff(dateIso?: string) {
  if (!dateIso) return null;

  const target = new Date(`${dateIso}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);

  if (Number.isNaN(target.getTime())) return null;

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function dueLabel(dateIso?: string) {
  const diff = daysDiff(dateIso);

  if (diff === null) return 'Sin fecha';
  if (diff < 0) return `Vencida hace ${Math.abs(diff)} día(s)`;
  if (diff === 0) return 'Vence hoy';
  return `Faltan ${diff} día(s)`;
}

export default function CuentasPorCobrarPage() {
  const [facturas, setFacturas] = useState<CuentaPorCobrarFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedFactura, setSelectedFactura] =
    useState<CuentaPorCobrarFactura | null>(null);

  const [fechaIngresoReal, setFechaIngresoReal] = useState(todayISO());
  const [observacion, setObservacion] = useState('');

  const loadFacturas = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/facturas/cuentas-por-cobrar', {
        method: 'GET',
      });

      const data: CuentasPorCobrarResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo cargar la información.');
      }

      setFacturas(data.facturas || []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar cuentas por cobrar.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacturas();
  }, [loadFacturas]);

  const totalPorCobrar = useMemo(() => {
    return facturas.reduce((acc, factura) => {
      const value = Number(factura.monto_pagar || factura.total || 0);
      return acc + (Number.isFinite(value) ? value : 0);
    }, 0);
  }, [facturas]);

  const vencidas = useMemo(() => {
    return facturas.filter((factura) => {
      const diff = daysDiff(factura.fecha_estimada_ingreso);
      return diff !== null && diff < 0;
    }).length;
  }, [facturas]);

  const openModal = (factura: CuentaPorCobrarFactura) => {
    setSelectedFactura(factura);
    setFechaIngresoReal(todayISO());
    setObservacion('');
    setError(null);
    setMessage(null);
  };

  const closeModal = () => {
    if (updatingUid) return;

    setSelectedFactura(null);
    setFechaIngresoReal(todayISO());
    setObservacion('');
  };

  const handleMarkAsPaid = async () => {
    if (!selectedFactura?.invoice_uid) return;

    if (!fechaIngresoReal) {
      setError('Debes indicar la fecha real de ingreso.');
      return;
    }

    setUpdatingUid(selectedFactura.invoice_uid);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/facturas/cuentas-por-cobrar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_uid: selectedFactura.invoice_uid,
          fecha_ingreso_real: fechaIngresoReal,
          observacion,
        }),
      });

      const data: CuentasPorCobrarResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo actualizar la factura.');
      }

      setFacturas((prev) =>
        prev.filter((f) => f.invoice_uid !== selectedFactura.invoice_uid)
      );

      setMessage(data.message || 'Factura marcada como ya ingresada.');
      closeModal();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la cuenta por cobrar.'
      );
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <AppShell>
      <div className="app-container">
        <section className="card">
          <div className="accounts-header">
            <div>
              <span className="module-page__kicker">Facturación</span>
              <h1>Cuentas por cobrar</h1>
              <p>
                Facturas emitidas que todavía no fueron marcadas como ingreso
                percibido.
              </p>
            </div>

            <div className="accounts-header__actions">

              <button
                type="button"
                className="btn-primary"
                onClick={loadFacturas}
                disabled={loading}
              >
                {loading ? 'Actualizando...' : 'Actualizar lista'}
              </button>
            </div>
          </div>

          <div className="accounts-summary-grid">
            <div className="batch-summary-stat">
              <span className="batch-summary-stat__label">Facturas pendientes</span>
              <strong className="batch-summary-stat__value">
                {facturas.length}
              </strong>
            </div>

            <div className="batch-summary-stat">
              <span className="batch-summary-stat__label">Monto por cobrar</span>
              <strong className="batch-summary-stat__value">
                {formatMoney(totalPorCobrar)}
              </strong>
            </div>

            <div className="batch-summary-stat">
              <span className="batch-summary-stat__label">Vencidas</span>
              <strong className="batch-summary-stat__value">
                {vencidas}
              </strong>
            </div>
          </div>
        </section>

        <nav className="module-tabs">
          <Link href="/facturas" className="module-tab">
            Carga de facturas
          </Link>

          <Link
            href="/facturas/cuentas-por-cobrar"
            className="module-tab module-tab--active"
          >
            Cuentas por cobrar
          </Link>
        </nav>

        {message && (
          <div className="success-message section-gap">
            ✅ {message}
          </div>
        )}

        {error && (
          <div className="error-message section-gap">
            ⚠️ {error}
          </div>
        )}

        <section className="card section-gap">
          <h2 className="card__title">
            <span className="card__title-icon">💳</span>
            Facturas pendientes de ingreso
          </h2>

          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
              <div>Cargando cuentas por cobrar...</div>
            </div>
          ) : facturas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">✅</div>
              <div>No hay cuentas por cobrar pendientes.</div>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Monto</th>
                    <th>Emisión</th>
                    <th>Fecha estimada</th>
                    <th>Estado</th>
                    <th>Método</th>
                    <th>Nivel</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {facturas.map((factura) => (
                    <tr key={factura.invoice_uid}>
                      <td>
                        <strong>{factura.nro_factura || '—'}</strong>
                        <br />
                        <small>{factura.invoice_uid}</small>
                      </td>

                      <td>
                        {factura.cliente_nombre || '—'}
                        {factura.cliente_nit_ci && (
                          <>
                            <br />
                            <small>NIT/CI: {factura.cliente_nit_ci}</small>
                          </>
                        )}
                      </td>

                      <td>
                        {formatMoney(factura.monto_pagar || factura.total)}
                      </td>

                      <td>{factura.fecha_emision || factura.fecha_iso || '—'}</td>

                      <td>
                        {factura.fecha_estimada_ingreso || '—'}
                        <br />
                        <small>{dueLabel(factura.fecha_estimada_ingreso)}</small>
                      </td>

                      <td>
                        <span className="status-badge status-badge--duplicate">
                          Cuenta por cobrar
                        </span>
                      </td>

                      <td>{factura.metodo_pago || '—'}</td>

                      <td>{factura.nivel || '—'}</td>

                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openModal(factura)}
                          disabled={!!updatingUid}
                        >
                          Marcar ingresado
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedFactura && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal-card" role="dialog" aria-modal="true">
              <h2>Confirmar ingreso</h2>

              <p>
                Se marcará la factura{' '}
                <strong>{selectedFactura.nro_factura || selectedFactura.invoice_uid}</strong>{' '}
                como <strong>Ya ingresado</strong>.
              </p>

              <label className="file-setting">
                <span>Fecha real de ingreso</span>
                <input
                  type="date"
                  value={fechaIngresoReal}
                  onChange={(e) => setFechaIngresoReal(e.target.value)}
                  disabled={!!updatingUid}
                />
              </label>

              <label className="file-setting">
                <span>Observación</span>
                <textarea
                  className="form-textarea"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Ej.: Pago confirmado por transferencia."
                  disabled={!!updatingUid}
                  rows={3}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                  disabled={!!updatingUid}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleMarkAsPaid}
                  disabled={!!updatingUid}
                >
                  {updatingUid ? 'Actualizando...' : 'Confirmar ingreso'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}