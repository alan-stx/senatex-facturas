'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import type {
  Cliente,
  NivelCerteza,
  Operacion,
  OperacionCreatePayload,
  PagoProgramadoForm,
} from '@/types';
import Link from 'next/link';

type PlanPagos = '1' | '2' | '3' | '4' | 'personalizado';

const initialPagos: PagoProgramadoForm[] = [
  {
    numero_pago: 1,
    concepto_pago: 'Pago total',
    porcentaje_programado: 100,
    monto_programado: 0,
    fecha_programada: '',
    estado_pago: 'Pendiente',
  },
];

const initialForm: OperacionCreatePayload = {
  cliente_id: '',
  fecha_registro: new Date().toISOString().slice(0, 10),
  descripcion_operacion: '',
  cantidad: 0,
  tipo_operacion: 'Contrato',
  tipo_empresa: 'Institucional',
  responsable: 'Ejecutivo comercial',
  estado_operacion: 'Propuesta enviada',
  nivel_certeza: 'Alta',
  probabilidad: 0.9,
  modalidad_pago: 'SIGEP',
  monto_total_comprometido: 0,
  monto_total_ponderado: 0,
  vigencia_desde: '',
  vigencia_hasta: '',
  observaciones: '',
  estado_general: 'Activo',
  pagos_programados: initialPagos,
};

function probabilityFromCerteza(value: NivelCerteza) {
  if (value === 'Alta') return 0.9;
  if (value === 'Media') return 0.6;
  return 0.3;
}

function formatCurrency(value: number | string | undefined) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(number);
}

function buildPagosByPlan(plan: PlanPagos, montoTotal: number): PagoProgramadoForm[] {
  const count = plan === 'personalizado' ? 1 : Number(plan);

  if (plan === '1') {
    return [
      {
        numero_pago: 1,
        concepto_pago: 'Pago total',
        porcentaje_programado: 100,
        monto_programado: montoTotal,
        fecha_programada: '',
        estado_pago: 'Pendiente',
      },
    ];
  }

  const pagos: PagoProgramadoForm[] = [];
  const basePercent = Number((100 / count).toFixed(2));
  let accumulatedPercent = 0;

  for (let index = 1; index <= count; index += 1) {
    const isLast = index === count;
    const porcentaje = isLast
      ? Number((100 - accumulatedPercent).toFixed(2))
      : basePercent;

    accumulatedPercent += porcentaje;

    pagos.push({
      numero_pago: index,
      concepto_pago: index === 1 && count === 2 ? 'Anticipo' : isLast && count === 2 ? 'Saldo' : `Pago ${index}`,
      porcentaje_programado: porcentaje,
      monto_programado: Number(((montoTotal * porcentaje) / 100).toFixed(2)),
      fecha_programada: '',
      estado_pago: 'Pendiente',
    });
  }

  return pagos;
}

export default function OperacionesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [form, setForm] = useState<OperacionCreatePayload>(initialForm);
  const [planPagos, setPlanPagos] = useState<PlanPagos>('1');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadData() {
    setLoading(true);
    setMessage('');

    try {
      const [clientesResponse, operacionesResponse] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/operaciones'),
      ]);

      const clientesData = await clientesResponse.json();
      const operacionesData = await operacionesResponse.json();

      if (!clientesResponse.ok || !clientesData.ok) {
        throw new Error(clientesData.message || 'No se pudieron cargar los clientes.');
      }

      if (!operacionesResponse.ok || !operacionesData.ok) {
        throw new Error(operacionesData.message || 'No se pudieron cargar las operaciones.');
      }

      setClientes(clientesData.clientes || []);
      setOperaciones(operacionesData.operaciones || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const operacionesConCliente = useMemo(() => {
    return operaciones.map((operacion) => {
      const cliente = clientes.find((item) => item.cliente_id === operacion.cliente_id);

      return {
        ...operacion,
        cliente_nombre: operacion.cliente_nombre || cliente?.razon_social || operacion.cliente_id,
      };
    });
  }, [operaciones, clientes]);

  const filteredOperaciones = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return operacionesConCliente;

    return operacionesConCliente.filter((operacion) =>
      [
        operacion.operacion_id,
        operacion.cliente_nombre,
        operacion.descripcion_operacion,
        operacion.responsable,
        operacion.estado_operacion,
        operacion.nivel_certeza,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [operacionesConCliente, search]);

  const totalComprometido = operaciones.reduce(
    (sum, operacion) => sum + Number(operacion.monto_total_comprometido || 0),
    0
  );

  const operacionesActivas = operaciones.filter(
    (operacion) => operacion.estado_general !== 'Inactivo' && operacion.estado_operacion !== 'Perdida'
  ).length;

  function updateFormField<K extends keyof OperacionCreatePayload>(
    field: K,
    value: OperacionCreatePayload[K]
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === 'nivel_certeza') {
        const probabilidad = probabilityFromCerteza(value as NivelCerteza);
        next.probabilidad = probabilidad;
        next.monto_total_ponderado = Number(
          (Number(next.monto_total_comprometido || 0) * probabilidad).toFixed(2)
        );
      }

      if (field === 'monto_total_comprometido') {
        const monto = Number(value || 0);
        next.monto_total_ponderado = Number((monto * Number(next.probabilidad || 0)).toFixed(2));

        if (planPagos !== 'personalizado') {
          next.pagos_programados = buildPagosByPlan(planPagos, monto);
        }
      }

      return next;
    });
  }

  function updatePlanPagos(value: PlanPagos) {
    setPlanPagos(value);

    setForm((current) => ({
      ...current,
      pagos_programados:
        value === 'personalizado'
          ? current.pagos_programados
          : buildPagosByPlan(value, Number(current.monto_total_comprometido || 0)),
    }));
  }

  function updatePago(index: number, field: keyof PagoProgramadoForm, value: string) {
    setForm((current) => {
      const pagos = current.pagos_programados.map((pago, pagoIndex) => {
        if (pagoIndex !== index) return pago;

        const nextPago = {
          ...pago,
          [field]:
            field === 'porcentaje_programado' || field === 'monto_programado'
              ? Number(value || 0)
              : value,
        };

        if (field === 'porcentaje_programado') {
          nextPago.monto_programado = Number(
            ((Number(current.monto_total_comprometido || 0) * Number(value || 0)) / 100).toFixed(2)
          );
        }

        return nextPago;
      });

      return {
        ...current,
        pagos_programados: pagos,
      };
    });
  }

  function addPagoPersonalizado() {
    setPlanPagos('personalizado');

    setForm((current) => ({
      ...current,
      pagos_programados: [
        ...current.pagos_programados,
        {
          numero_pago: current.pagos_programados.length + 1,
          concepto_pago: `Pago ${current.pagos_programados.length + 1}`,
          porcentaje_programado: 0,
          monto_programado: 0,
          fecha_programada: '',
          estado_pago: 'Pendiente',
        },
      ],
    }));
  }

  function removePago(index: number) {
    setPlanPagos('personalizado');

    setForm((current) => ({
      ...current,
      pagos_programados: current.pagos_programados
        .filter((_, pagoIndex) => pagoIndex !== index)
        .map((pago, pagoIndex) => ({
          ...pago,
          numero_pago: pagoIndex + 1,
        })),
    }));
  }

  const totalPorcentaje = form.pagos_programados.reduce(
    (sum, pago) => sum + Number(pago.porcentaje_programado || 0),
    0
  );

  const totalPagos = form.pagos_programados.reduce(
    (sum, pago) => sum + Number(pago.monto_programado || 0),
    0
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.cliente_id) {
      setMessage('Debe seleccionar un cliente.');
      return;
    }

    if (!form.descripcion_operacion.trim()) {
      setMessage('La descripción de la operación es obligatoria.');
      return;
    }

    if (Math.abs(totalPorcentaje - 100) > 0.01) {
      setMessage('La suma de porcentajes del plan de pagos debe ser 100%.');
      return;
    }

    if (Math.abs(totalPagos - Number(form.monto_total_comprometido || 0)) > 0.05) {
      setMessage('La suma de montos programados debe igualar el monto total comprometido.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/operaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo registrar la operación.');
      }

      if (data.operacion) {
        setOperaciones((current) => [data.operacion, ...current]);
      }

      setForm(initialForm);
      setPlanPagos('1');
      setShowForm(false);
      setMessage(data.message || 'Operación registrada correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al registrar operación.');
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
            <h1>Operaciones</h1>
            <p>Contrataciones, adjudicaciones, propuestas y ventas futuras.</p>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? 'Cerrar formulario' : '+ Nueva operación'}
          </button>
        </div>

        {message && <div className="notice">{message}</div>}

        <div className="client-summary-grid">
          <div className="client-summary-card">
            <span>Total operaciones</span>
            <strong>{operaciones.length}</strong>
          </div>

          <div className="client-summary-card">
            <span>Operaciones activas</span>
            <strong>{operacionesActivas}</strong>
          </div>

          <div className="client-summary-card">
            <span>Monto comprometido</span>
            <strong>{formatCurrency(totalComprometido)}</strong>
          </div>
        </div>

        {showForm && (
          <form className="client-form" onSubmit={handleSubmit}>
            <h2>Nueva operación</h2>

            <div className="client-form-grid">
              <label>
                Cliente *
                <select
                  value={form.cliente_id}
                  onChange={(event) => updateFormField('cliente_id', event.target.value)}
                >
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.cliente_id} value={cliente.cliente_id}>
                      {cliente.razon_social}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Fecha registro
                <input
                  type="date"
                  value={form.fecha_registro}
                  onChange={(event) => updateFormField('fecha_registro', event.target.value)}
                />
              </label>

              <label className="client-form-full">
                Descripción de la operación *
                <input
                  value={form.descripcion_operacion}
                  onChange={(event) => updateFormField('descripcion_operacion', event.target.value)}
                  placeholder="Ej. Contratación de prendas institucionales"
                />
              </label>

              <label>
                Cantidad (Unidades)
                <input
                  type="number"
                  value={form.cantidad || ''}
                  onChange={(event) => updateFormField('cantidad', Number(event.target.value || 0))}
                  placeholder="Ej. 1200"
                />
              </label>

              <label>
                Responsable
                <select
                  value={form.responsable}
                  onChange={(event) => updateFormField('responsable', event.target.value)}
                >
                  <option value="Adriana Fuentes">Adriana Fuentes</option>
                  <option value="Gloria Mamani">Gloria Mamani</option>
                  <option value="Omar Torrico">Omar Torrico</option>
                  <option value="Ejecutivo comercial">Ejecutivo comercial</option>
                </select>
              </label>

              <label>
                Tipo operación
                <select
                  value={form.tipo_operacion}
                  onChange={(event) => updateFormField('tipo_operacion', event.target.value)}
                >
                  <option value="Contrato">Contrato</option>
                  <option value="Adjudicación">Adjudicación</option>
                  <option value="Venta institucional">Venta institucional</option>
                  <option value="Propuesta enviada">Propuesta enviada</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>

              <label>
                Tipo empresa
                <select
                  value={form.tipo_empresa}
                  onChange={(event) => updateFormField('tipo_empresa', event.target.value)}
                >
                  <option value="Público">Público</option>
                  <option value="Privado">Privado</option>
                  <option value="Institucional">Institucional</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>

              <label>
                Estado operación
                <select
                  value={form.estado_operacion}
                  onChange={(event) => updateFormField('estado_operacion', event.target.value)}
                >
                  <option value="Propuesta enviada">Propuesta enviada</option>
                  <option value="Vigente">Vigente</option>
                  <option value="Cobro parcial">Cobro parcial</option>
                  <option value="Cerrada">Cerrada</option>
                  <option value="Perdida">Perdida</option>
                  <option value="En espera">En espera</option>
                </select>
              </label>

              <label>
                Nivel certeza
                <select
                  value={form.nivel_certeza}
                  onChange={(event) =>
                    updateFormField('nivel_certeza', event.target.value as NivelCerteza)
                  }
                >
                  <option value="Alta">Alta - 90%</option>
                  <option value="Media">Media - 60%</option>
                  <option value="Baja">Baja - 30%</option>
                </select>
              </label>

              <label>
                Modalidad pago
                <select
                  value={form.modalidad_pago}
                  onChange={(event) => updateFormField('modalidad_pago', event.target.value)}
                >
                  <option value="SIGEP">SIGEP</option>
                  <option value="Transferencia bancaria">Transferencia bancaria</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="QR">QR</option>
                  <option value="Billetera móvil">Billetera móvil</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>

              <label>
                Monto total comprometido * (Bs.)
                <input
                  type="number"
                  value={form.monto_total_comprometido || ''}
                  onChange={(event) =>
                    updateFormField('monto_total_comprometido', Number(event.target.value || 0))
                  }
                  placeholder="Ej. 205700"
                />
              </label>

              <label>
                Vigencia desde
                <input
                  type="date"
                  value={form.vigencia_desde}
                  onChange={(event) => updateFormField('vigencia_desde', event.target.value)}
                />
              </label>

              <label>
                Vigencia hasta
                <input
                  type="date"
                  value={form.vigencia_hasta}
                  onChange={(event) => updateFormField('vigencia_hasta', event.target.value)}
                />
              </label>

              <label className="client-form-full">
                Observaciones
                <textarea
                  value={form.observaciones}
                  onChange={(event) => updateFormField('observaciones', event.target.value)}
                  placeholder="Notas comerciales, condiciones o datos pendientes."
                />
              </label>
            </div>

            <div className="payment-plan-box">
              <div className="payment-plan-header">
                <div>
                  <h3>Plan de pagos</h3>
                  <p>Define los pagos esperados para esta operación.</p>
                </div>

                <select value={planPagos} onChange={(event) => updatePlanPagos(event.target.value as PlanPagos)}>
                  <option value="1">1 pago</option>
                  <option value="2">2 pagos</option>
                  <option value="3">3 pagos</option>
                  <option value="4">4 pagos</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              <div className="payment-table-wrap">
                <table className="client-table payment-table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Concepto</th>
                      <th>%</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {form.pagos_programados.map((pago, index) => (
                      <tr key={`${pago.numero_pago}-${index}`}>
                        <td>{pago.numero_pago}</td>
                        <td>
                          <input
                            value={pago.concepto_pago}
                            onChange={(event) => updatePago(index, 'concepto_pago', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={pago.porcentaje_programado}
                            onChange={(event) => updatePago(index, 'porcentaje_programado', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={pago.monto_programado}
                            onChange={(event) => updatePago(index, 'monto_programado', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={pago.fecha_programada}
                            onChange={(event) => updatePago(index, 'fecha_programada', event.target.value)}
                          />
                        </td>
                        <td>{pago.estado_pago}</td>
                        <td>
                          {form.pagos_programados.length > 1 && (
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => removePago(index)}
                            >
                              Quitar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="payment-plan-footer">
                <span>Total %: {totalPorcentaje.toFixed(2)}%</span>
                <span>Total pagos: {formatCurrency(totalPagos)}</span>
                <button type="button" className="btn-secondary btn-small" onClick={addPagoPersonalizado}>
                  + Agregar pago
                </button>
              </div>
            </div>

            <div className="client-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setForm(initialForm);
                  setPlanPagos('1');
                  setShowForm(false);
                }}
              >
                Cancelar
              </button>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar operación'}
              </button>
            </div>
          </form>
        )}

        <div className="client-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, descripción, responsable, estado o certeza..."
          />
        </div>

        <div className="client-table-card">
          {loading ? (
            <p>Cargando operaciones...</p>
          ) : filteredOperaciones.length === 0 ? (
            <p>No se encontraron operaciones.</p>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Descripción</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Certeza</th>
                  <th>Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredOperaciones.map((operacion) => (
                  <tr key={operacion.operacion_id}>
                    <td>{operacion.operacion_id}</td>
                    <td>{operacion.cliente_nombre || operacion.cliente_id}</td>
                    <td>
                      <strong>{operacion.descripcion_operacion}</strong>
                      <span>{operacion.tipo_operacion}</span>
                    </td>
                    <td>{operacion.responsable || '-'}</td>
                    <td>
                      <span className="status-pill">{operacion.estado_operacion}</span>
                    </td>
                    <td>{operacion.nivel_certeza}</td>
                    <td>{formatCurrency(operacion.monto_total_comprometido)}</td>
                    <td>
                      <Link
                        href={`/pagos?operacion_id=${encodeURIComponent(operacion.operacion_id)}`}
                        className="btn-secondary btn-small"
                      >
                        Ver pagos
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
