'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import type { DepositoCreatePayload, PagoProgramado } from '@/types';
import { useRouter, useSearchParams } from 'next/navigation';

const modalidadesPago = [
  'SIGEP',
  'Transferencia bancaria',
  'Efectivo',
  'QR',
  'Billetera móvil',
  'Cheque',
  'Otro',
];

function toNumber(value: unknown) {
  const clean = String(value || '')
    .replace(/Bs\.?/gi, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');

  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(toNumber(value));
}

function isOverdue(pago: PagoProgramado) {
  if (!pago.fecha_programada) return false;
  if (pago.estado_pago === 'Pagado' || toNumber(pago.saldo_pago) <= 0) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${pago.fecha_programada}T00:00:00`);
  return dueDate < today;
}

function normalizeEstadoPago(pago: PagoProgramado) {
  if (pago.estado_pago === 'Pagado') return 'Pagado';
  if (isOverdue(pago)) return 'Vencido';
  return pago.estado_pago || 'Pendiente';
}

const initialDeposito: DepositoCreatePayload = {
  pago_id: '',
  operacion_id: '',
  cliente_id: '',
  fecha_deposito: new Date().toISOString().slice(0, 10),
  monto_depositado: 0,
  modalidad_pago: 'Transferencia bancaria',
  nro_comprobante: '',
  observacion: '',
};


function PagosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const operacionIdParam = searchParams.get('operacion_id') || '';

  const [pagos, setPagos] = useState<PagoProgramado[]>([]);
  const [selectedPago, setSelectedPago] = useState<PagoProgramado | null>(null);
  const [deposito, setDeposito] = useState<DepositoCreatePayload>(initialDeposito);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadPagos() {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/pagos');
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudieron cargar los pagos.');
      }

      setPagos(data.pagos || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al cargar pagos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPagos();
  }, []);

  useEffect(() => {
    if (operacionIdParam) {
      setSearch(operacionIdParam);
    }
  }, [operacionIdParam]);

  const pagosNormalizados = useMemo(() => {
    return pagos.map((pago) => ({
      ...pago,
      estado_pago: normalizeEstadoPago(pago),
      monto_programado: toNumber(pago.monto_programado),
      monto_pagado_acumulado: toNumber(pago.monto_pagado_acumulado),
      saldo_pago: toNumber(pago.saldo_pago),
    }));
  }, [pagos]);

  const filteredPagos = useMemo(() => {
    const value = search.trim().toLowerCase();

    return pagosNormalizados.filter((pago) => {
      const matchesSearch = !value
        ? true
        : [
            pago.pago_id,
            pago.operacion_id,
            pago.cliente_id,
            pago.cliente_nombre,
            pago.descripcion_operacion,
            pago.concepto_pago,
            pago.estado_pago,
            pago.modalidad_pago,
          ]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(value));

      const matchesEstado =
        estadoFilter === 'Todos' ? true : pago.estado_pago === estadoFilter;

      return matchesSearch && matchesEstado;
    });
  }, [pagosNormalizados, search, estadoFilter]);

  const pagosPendientes = pagosNormalizados.filter(
    (pago) => pago.estado_pago === 'Pendiente' || pago.estado_pago === 'Pagado parcial'
  );

  const pagosVencidos = pagosNormalizados.filter((pago) => pago.estado_pago === 'Vencido');

  const montoPendiente = pagosNormalizados.reduce(
    (sum, pago) => sum + toNumber(pago.saldo_pago),
    0
  );

  function openDepositoModal(pago: PagoProgramado) {
    setSelectedPago(pago);
    setDeposito({
      pago_id: pago.pago_id,
      operacion_id: pago.operacion_id,
      cliente_id: pago.cliente_id,
      fecha_deposito: new Date().toISOString().slice(0, 10),
      monto_depositado: toNumber(pago.saldo_pago),
      modalidad_pago: pago.modalidad_pago || 'Transferencia bancaria',
      nro_comprobante: '',
      observacion: '',
    });
    setMessage('');
  }

  function closeDepositoModal() {
    setSelectedPago(null);
    setDeposito(initialDeposito);
  }

  function updateDeposito<K extends keyof DepositoCreatePayload>(
    field: K,
    value: DepositoCreatePayload[K]
  ) {
    setDeposito((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmitDeposito(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPago) {
      setMessage('Debe seleccionar un pago.');
      return;
    }

    const montoDepositado = toNumber(deposito.monto_depositado);
    const saldoPago = toNumber(selectedPago.saldo_pago);

    if (montoDepositado <= 0) {
      setMessage('El monto recibido debe ser mayor a 0.');
      return;
    }

    if (montoDepositado > saldoPago) {
      setMessage('El monto recibido no puede ser mayor al saldo pendiente.');
      return;
    }

    if (!deposito.fecha_deposito) {
      setMessage('La fecha de pago es obligatoria.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/pagos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...deposito,
          monto_depositado: montoDepositado,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo registrar el depósito.');
      }

      if (data.pago) {
        setPagos((current) =>
          current.map((pago) => (pago.pago_id === data.pago.pago_id ? data.pago : pago))
        );
      }

      closeDepositoModal();
      setMessage(data.message || 'Depósito registrado correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al registrar depósito.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <section className="module-page">
        <div className="module-page__header">
          <div>
            <span className="module-page__kicker">Módulo comercial</span>
            <h1>Pagos</h1>
            <p>Planes de pago, anticipos, saldos, cuotas y depósitos reales.</p>
          </div>

          <button type="button" className="btn-primary" onClick={loadPagos}>
            Actualizar lista
          </button>
        </div>

        {message && <div className="notice">{message}</div>}

        <div className="client-summary-grid">
          <div className="client-summary-card">
            <span>Pagos pendientes</span>
            <strong>{pagosPendientes.length}</strong>
          </div>

          <div className="client-summary-card">
            <span>Monto pendiente</span>
            <strong>{formatCurrency(montoPendiente)}</strong>
          </div>

          <div className="client-summary-card">
            <span>Pagos vencidos</span>
            <strong>{pagosVencidos.length}</strong>
          </div>
        </div>

        <div className="client-toolbar pagos-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, operación, concepto, estado o modalidad..."
          />

          <select value={estadoFilter} onChange={(event) => setEstadoFilter(event.target.value)}>
            <option value="Todos">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado parcial">Pagado parcial</option>
            <option value="Pagado">Pagado</option>
            <option value="Vencido">Vencido</option>
            <option value="Reprogramado">Reprogramado</option>
            <option value="Anulado">Anulado</option>
          </select>
        </div>

        {operacionIdParam && (
          <div className="notice">
            Mostrando pagos de la operación {operacionIdParam}.{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setSearch('');
                router.push('/pagos');
              }}
            >
              Ver todos
            </button>
          </div>
        )}

        <div className="client-table-card">
          {loading ? (
            <p>Cargando pagos...</p>
          ) : filteredPagos.length === 0 ? (
            <p>No se encontraron pagos programados.</p>
          ) : (
            <table className="client-table pagos-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Operación</th>
                  <th>Concepto</th>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {filteredPagos.map((pago) => (
                  <tr key={pago.pago_id}>
                    <td>
                      <strong>{pago.cliente_nombre || pago.cliente_id}</strong>
                      <span>{pago.pago_id}</span>
                    </td>

                    <td>
                      <strong>{pago.operacion_id}</strong>
                      <span>{pago.descripcion_operacion || '-'}</span>
                    </td>

                    <td>
                      <strong>{pago.concepto_pago}</strong>
                      <span>{pago.porcentaje_programado}%</span>
                    </td>

                    <td>{pago.fecha_programada || '-'}</td>

                    <td>{formatCurrency(pago.monto_programado)}</td>

                    <td>{formatCurrency(pago.monto_pagado_acumulado)}</td>

                    <td>{formatCurrency(pago.saldo_pago)}</td>

                    <td>
                      <span className="status-pill">{pago.estado_pago}</span>
                    </td>

                    <td>
                      {toNumber(pago.saldo_pago) <= 0 || pago.estado_pago === 'Pagado' ? (
                        <span className="status-pill status-pill--muted">Registrado</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => openDepositoModal(pago)}
                        >
                          Registrar pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedPago && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="modal-card__header">
                <div>
                  <h2>Registrar pago recibido</h2>
                  <p>
                    {selectedPago.cliente_nombre || selectedPago.cliente_id} ·{' '}
                    {selectedPago.concepto_pago}
                  </p>
                </div>

                <button type="button" className="btn-secondary btn-small" onClick={closeDepositoModal}>
                  Cerrar
                </button>
              </div>

              <form className="client-form modal-form" onSubmit={handleSubmitDeposito}>
                <div className="client-form-grid">
                  <label>
                    Fecha de pago *
                    <input
                      type="date"
                      value={deposito.fecha_deposito}
                      onChange={(event) => updateDeposito('fecha_deposito', event.target.value)}
                    />
                  </label>

                  <label>
                    Monto recibido *
                    <input
                      type="number"
                      value={deposito.monto_depositado || ''}
                      onChange={(event) =>
                        updateDeposito('monto_depositado', Number(event.target.value || 0))
                      }
                    />
                  </label>

                  <label>
                    Modalidad pago *
                    <select
                      value={deposito.modalidad_pago}
                      onChange={(event) => updateDeposito('modalidad_pago', event.target.value)}
                    >
                      {modalidadesPago.map((modalidad) => (
                        <option key={modalidad} value={modalidad}>
                          {modalidad}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Nro. comprobante
                    <input
                      value={deposito.nro_comprobante || ''}
                      onChange={(event) => updateDeposito('nro_comprobante', event.target.value)}
                      placeholder="Ej. C-21, transferencia, recibo, etc."
                    />
                  </label>

                  <label className="client-form-full">
                    Observación
                    <textarea
                      value={deposito.observacion || ''}
                      onChange={(event) => updateDeposito('observacion', event.target.value)}
                      placeholder="Detalle del pago recibido o nota comercial."
                    />
                  </label>
                </div>

                <div className="deposit-summary">
                  <span>Saldo actual: {formatCurrency(selectedPago.saldo_pago)}</span>
                  <span>
                    Nuevo saldo:{' '}
                    {formatCurrency(toNumber(selectedPago.saldo_pago) - toNumber(deposito.monto_depositado))}
                  </span>
                </div>

                <div className="client-form-actions">
                  <button type="button" className="btn-secondary" onClick={closeDepositoModal}>
                    Cancelar
                  </button>

                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar pago'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

export default function PagosPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <section className="module-page">
            <div className="module-page__header">
              <div>
                <span className="module-page__kicker">Módulo comercial</span>
                <h1>Pagos</h1>
                <p>Cargando pagos...</p>
              </div>
            </div>
          </section>
        </AppShell>
      }
    >
      <PagosContent />
    </Suspense>
  );
}