'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import type {
  Cliente,
  FormMode,
  Operacion,
  OperacionActivarPayload,
  OperacionCreatePayload,
  OperacionUpdatePayload,
  PagoProgramadoForm,
} from '@/types';
import { TIPO_OPERACION_OPTIONS, normalizeEstadoComercial } from '@/types';
import Link from 'next/link';

type PlanPagos = '1' | '2' | '3' | '4' | 'personalizado';
type SituacionInicial = 'cotizacion' | 'vigente';

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
  estado_operacion: 'Cotización enviada',
  modalidad_pago: '',
  monto_total_comprometido: 0,
  vigencia_desde: '',
  vigencia_hasta: '',
  observaciones: '',
  estado_general: 'Activo',
  pagos_programados: initialPagos,
};

function formatCurrency(value: number | string | undefined) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(number);
}

/**
 * Devuelve el tipo si es uno de los válidos actuales; en caso contrario ''.
 * No se mapean automáticamente los tipos históricos: al editar, un tipo no
 * válido deja el selector vacío y obliga a reseleccionar uno válido.
 */
function normalizeTipoOperacion(value: string | undefined): string {
  const current = String(value || '').trim();

  return (TIPO_OPERACION_OPTIONS as readonly string[]).includes(current) ? current : '';
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
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [situacionInicial, setSituacionInicial] = useState<SituacionInicial>('cotizacion');
  const [editingOperacion, setEditingOperacion] = useState<Operacion | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const editingId = editingOperacion?.operacion_id ?? null;

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
        normalizeEstadoComercial(operacion.estado_operacion),
        operacion.estado_cobro,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [operacionesConCliente, search]);

  const operacionesVigentes = operaciones.filter(
    (operacion) => normalizeEstadoComercial(operacion.estado_operacion) === 'Vigente'
  ).length;

  const montoVigente = operaciones.reduce((sum, operacion) => {
    const estado = normalizeEstadoComercial(operacion.estado_operacion);
    return estado === 'Vigente' || estado === 'Cerrada'
      ? sum + Number(operacion.monto_total_comprometido || 0)
      : sum;
  }, 0);

  const isCreate = formMode === 'create';
  const isEdit = formMode === 'edit';
  const isActivate = formMode === 'activate';

  const crearComoVigente = isCreate && situacionInicial === 'vigente';
  // Exige plan completo (monto > 0, vigencias y pagos): al crear como vigente o al activar.
  const exigeContrato = crearComoVigente || isActivate;

  const estadoComercial = normalizeEstadoComercial(form.estado_operacion);
  const esVigente = estadoComercial === 'Vigente';
  const esCerrada = estadoComercial === 'Cerrada';

  const bloquearMonto = isEdit && Boolean(editingOperacion?.tiene_depositos);
  const mostrarVigencias = exigeContrato || (isEdit && (esVigente || esCerrada));
  const mostrarPlanEditable = exigeContrato;
  const montoRequerido = exigeContrato;

  const montoLabel = isActivate
    ? 'Monto aprobado (Bs.) *'
    : crearComoVigente
    ? 'Monto de la operación (Bs.) *'
    : isCreate
    ? 'Monto de la cotización (Bs.)'
    : 'Monto de la operación (Bs.)';

  const formTitle = isActivate
    ? 'Aprobar cotización'
    : isEdit
    ? 'Editar operación'
    : 'Nueva operación';

  function updateFormField<K extends keyof OperacionCreatePayload>(
    field: K,
    value: OperacionCreatePayload[K]
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === 'monto_total_comprometido') {
        const monto = Number(value || 0);

        if (planPagos !== 'personalizado') {
          next.pagos_programados = buildPagosByPlan(planPagos, monto);
        }
      }

      return next;
    });
  }

  function updateSituacionInicial(value: SituacionInicial) {
    setSituacionInicial(value);

    setForm((current) => {
      if (value === 'vigente') {
        return {
          ...current,
          estado_operacion: 'Vigente',
          pagos_programados:
            planPagos === 'personalizado'
              ? current.pagos_programados
              : buildPagosByPlan(planPagos, Number(current.monto_total_comprometido || 0)),
        };
      }

      return {
        ...current,
        estado_operacion: 'Cotización enviada',
      };
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

  function resetForm() {
    setForm(initialForm);
    setPlanPagos('1');
    setEditingOperacion(null);
    setFormMode('create');
    setSituacionInicial('cotizacion');
  }

  /** Valida un plan completo de operación vigente. Devuelve el error o null. */
  function validateVigente(): string | null {
    if (!form.monto_total_comprometido || Number(form.monto_total_comprometido) <= 0) {
      return 'El monto de la operación debe ser mayor a 0.';
    }

    if (!form.vigencia_desde || !form.vigencia_hasta) {
      return 'Debe indicar la vigencia desde y la vigencia hasta.';
    }

    if (form.vigencia_hasta < form.vigencia_desde) {
      return 'La vigencia hasta no puede ser anterior a la vigencia desde.';
    }

    if (form.pagos_programados.length === 0) {
      return 'Debe definir al menos un pago programado.';
    }

    if (form.pagos_programados.some((pago) => !pago.fecha_programada)) {
      return 'Cada pago programado debe tener una fecha programada.';
    }

    if (Math.abs(totalPorcentaje - 100) > 0.01) {
      return 'La suma de porcentajes del plan de pagos debe ser 100%.';
    }

    if (Math.abs(totalPagos - Number(form.monto_total_comprometido || 0)) > 0.05) {
      return 'La suma de montos programados debe igualar el monto total.';
    }

    return null;
  }

  function startEdit(operacion: Operacion) {
    setFormMode('edit');
    setEditingOperacion(operacion);
    setForm({
      cliente_id: operacion.cliente_id || '',
      fecha_registro: operacion.fecha_registro || new Date().toISOString().slice(0, 10),
      descripcion_operacion: operacion.descripcion_operacion || '',
      cantidad: Number(operacion.cantidad || 0),
      tipo_operacion: normalizeTipoOperacion(operacion.tipo_operacion),
      tipo_empresa: operacion.tipo_empresa || 'Institucional',
      responsable: operacion.responsable || 'Ejecutivo comercial',
      estado_operacion: normalizeEstadoComercial(operacion.estado_operacion) || 'Cotización enviada',
      modalidad_pago: '',
      monto_total_comprometido: Number(operacion.monto_total_comprometido || 0),
      vigencia_desde: operacion.vigencia_desde || '',
      vigencia_hasta: operacion.vigencia_hasta || '',
      observaciones: operacion.observaciones || '',
      estado_general: operacion.estado_general || 'Activo',
      pagos_programados: initialPagos,
    });
    setPlanPagos('1');
    setShowForm(true);
    setMessage('');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function startActivate(operacion: Operacion) {
    setFormMode('activate');
    setEditingOperacion(operacion);

    const monto = Number(operacion.monto_total_comprometido || 0);

    setForm({
      cliente_id: operacion.cliente_id || '',
      fecha_registro: operacion.fecha_registro || new Date().toISOString().slice(0, 10),
      descripcion_operacion: operacion.descripcion_operacion || '',
      cantidad: Number(operacion.cantidad || 0),
      tipo_operacion: normalizeTipoOperacion(operacion.tipo_operacion),
      tipo_empresa: operacion.tipo_empresa || 'Institucional',
      responsable: operacion.responsable || 'Ejecutivo comercial',
      estado_operacion: 'Vigente',
      modalidad_pago: '',
      monto_total_comprometido: monto,
      vigencia_desde: operacion.vigencia_desde || '',
      vigencia_hasta: operacion.vigencia_hasta || '',
      observaciones: operacion.observaciones || '',
      estado_general: operacion.estado_general || 'Activo',
      pagos_programados: buildPagosByPlan('1', monto),
    });
    setPlanPagos('1');
    setShowForm(true);
    setMessage('');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function toggleForm() {
    if (showForm) {
      setShowForm(false);
      resetForm();
    } else {
      resetForm();
      setShowForm(true);
    }
  }

  function upsertOperacion(operacion: Operacion) {
    setOperaciones((current) => {
      const exists = current.some((item) => item.operacion_id === operacion.operacion_id);

      return exists
        ? current.map((item) =>
            item.operacion_id === operacion.operacion_id ? { ...item, ...operacion } : item
          )
        : [operacion, ...current];
    });
  }

  async function handleActivate() {
    if (!editingId) return;

    const validationError = validateVigente();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    setMessage('');

    const body: OperacionActivarPayload = {
      operacion_id: editingId,
      monto_total_comprometido: Number(form.monto_total_comprometido || 0),
      vigencia_desde: form.vigencia_desde || '',
      vigencia_hasta: form.vigencia_hasta || '',
      pagos_programados: form.pagos_programados,
    };

    try {
      const response = await fetch('/api/operaciones', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo activar la operación.');
      }

      if (data.operacion) {
        upsertOperacion(data.operacion);
      } else {
        loadData();
      }

      resetForm();
      setShowForm(false);
      setMessage(data.message || 'Operación activada correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al activar la operación.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isActivate) {
      handleActivate();
      return;
    }

    if (!form.cliente_id) {
      setMessage('Debe seleccionar un cliente.');
      return;
    }

    if (!form.descripcion_operacion.trim()) {
      setMessage('La descripción de la operación es obligatoria.');
      return;
    }

    if (!normalizeTipoOperacion(form.tipo_operacion)) {
      setMessage('Debe seleccionar un tipo de operación válido.');
      return;
    }

    let estadoFinal = form.estado_operacion;
    let pagosProgramados: PagoProgramadoForm[] = [];
    let vigenciaDesde = form.vigencia_desde || '';
    let vigenciaHasta = form.vigencia_hasta || '';

    if (isCreate) {
      if (situacionInicial === 'cotizacion') {
        estadoFinal = 'Cotización enviada';
        pagosProgramados = [];
        vigenciaDesde = '';
        vigenciaHasta = '';
      } else {
        estadoFinal = 'Vigente';

        const validationError = validateVigente();

        if (validationError) {
          setMessage(validationError);
          return;
        }

        pagosProgramados = form.pagos_programados;
      }
    } else {
      // Edición: nunca crea pagos; el estado comercial lo preserva el backend.
      pagosProgramados = [];
    }

    setSaving(true);
    setMessage('');

    const payloadBase: OperacionCreatePayload = {
      ...form,
      estado_operacion: estadoFinal,
      vigencia_desde: vigenciaDesde,
      vigencia_hasta: vigenciaHasta,
      modalidad_pago: '',
      pagos_programados: pagosProgramados,
      probabilidad: 0,
      monto_total_ponderado: 0,
    };

    const body: OperacionCreatePayload | OperacionUpdatePayload = editingId
      ? { ...payloadBase, operacion_id: editingId }
      : payloadBase;
    const isEditRequest = Boolean(editingId);

    try {
      const response = await fetch('/api/operaciones', {
        method: isEditRequest ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo guardar la operación.');
      }

      if (data.operacion) {
        upsertOperacion(data.operacion);
      } else if (isEditRequest) {
        loadData();
      }

      resetForm();
      setShowForm(false);
      setMessage(
        data.message ||
          (isEditRequest ? 'Operación actualizada correctamente.' : 'Operación registrada correctamente.')
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al guardar operación.');
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
            <p>Cotizaciones, contratos, adjudicaciones y ventas institucionales.</p>
          </div>

          <button type="button" className="btn-primary" onClick={toggleForm}>
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
            <span>Operaciones vigentes</span>
            <strong>{operacionesVigentes}</strong>
          </div>

          <div className="client-summary-card">
            <span>Monto vigente</span>
            <strong>{formatCurrency(montoVigente)}</strong>
          </div>
        </div>

        {showForm && (
          <form className="client-form" onSubmit={handleSubmit}>
            <h2>{formTitle}</h2>

            {isActivate && (
              <div className="notice">
                Revisa los datos de la cotización y define el monto aprobado, la vigencia y el plan de
                pagos. Al confirmar, la operación pasará a <strong>Vigente</strong>.
              </div>
            )}

            {isCreate && (
              <div className="payment-plan-box" style={{ marginTop: 0, marginBottom: 18 }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>Situación inicial</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
                  Define cómo nace la operación. Puedes aprobar la cotización más adelante.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <label
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="situacion_inicial"
                      style={{ width: 'auto' }}
                      checked={situacionInicial === 'cotizacion'}
                      onChange={() => updateSituacionInicial('cotizacion')}
                    />
                    Cotización enviada
                  </label>

                  <label
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="situacion_inicial"
                      style={{ width: 'auto' }}
                      checked={situacionInicial === 'vigente'}
                      onChange={() => updateSituacionInicial('vigente')}
                    />
                    Operación confirmada / venta directa
                  </label>
                </div>
              </div>
            )}

            <div className="client-form-grid">
              <label>
                Cliente *
                <select
                  value={form.cliente_id}
                  onChange={(event) => updateFormField('cliente_id', event.target.value)}
                  disabled={isActivate}
                >
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.cliente_id} value={cliente.cliente_id}>
                      {cliente.razon_social}
                    </option>
                  ))}
                </select>
              </label>

              {!isActivate && (
                <label>
                  Fecha registro
                  <input
                    type="date"
                    value={form.fecha_registro}
                    onChange={(event) => updateFormField('fecha_registro', event.target.value)}
                  />
                </label>
              )}

              <label className="client-form-full">
                Descripción de la operación *
                <input
                  value={form.descripcion_operacion}
                  onChange={(event) => updateFormField('descripcion_operacion', event.target.value)}
                  placeholder="Ej. Contratación de prendas institucionales"
                  disabled={isActivate}
                />
              </label>

              {!isActivate && (
                <label>
                  Cantidad (Unidades)
                  <input
                    type="number"
                    value={form.cantidad || ''}
                    onChange={(event) => updateFormField('cantidad', Number(event.target.value || 0))}
                    placeholder="Ej. 1200"
                  />
                </label>
              )}

              <label>
                Responsable
                <select
                  value={form.responsable}
                  onChange={(event) => updateFormField('responsable', event.target.value)}
                  disabled={isActivate}
                >
                  <option value="Adriana Fuentes">Adriana Fuentes</option>
                  <option value="Gloria Mamani">Gloria Mamani</option>
                  <option value="Omar Torrico">Omar Torrico</option>
                  <option value="Ejecutivo comercial">Ejecutivo comercial</option>
                </select>
              </label>

              <label>
                Tipo operación *
                <select
                  value={form.tipo_operacion}
                  onChange={(event) => updateFormField('tipo_operacion', event.target.value)}
                  disabled={isActivate}
                >
                  <option value="">Seleccionar tipo</option>
                  {TIPO_OPERACION_OPTIONS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>

              {!isActivate && (
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
              )}

              {isEdit && (
                <label>
                  Estado comercial
                  <input value={estadoComercial} disabled readOnly />
                  <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>
                    El estado comercial no se edita aquí; se gestiona al aprobar la cotización o
                    registrar pagos.
                  </span>
                </label>
              )}

              <label>
                {montoLabel}
                <input
                  type="number"
                  value={form.monto_total_comprometido || ''}
                  onChange={(event) =>
                    updateFormField('monto_total_comprometido', Number(event.target.value || 0))
                  }
                  placeholder="Ej. 205700"
                  disabled={bloquearMonto}
                  required={montoRequerido}
                />
                {bloquearMonto && (
                  <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>
                    La operación tiene depósitos registrados; el monto no se puede modificar.
                  </span>
                )}
              </label>

              {mostrarVigencias && (
                <label>
                  Vigencia desde{exigeContrato ? ' *' : ''}
                  <input
                    type="date"
                    value={form.vigencia_desde}
                    onChange={(event) => updateFormField('vigencia_desde', event.target.value)}
                  />
                </label>
              )}

              {mostrarVigencias && (
                <label>
                  Vigencia hasta{exigeContrato ? ' *' : ''}
                  <input
                    type="date"
                    value={form.vigencia_hasta}
                    onChange={(event) => updateFormField('vigencia_hasta', event.target.value)}
                  />
                </label>
              )}

              {!isActivate && (
                <label className="client-form-full">
                  Observaciones
                  <textarea
                    value={form.observaciones}
                    onChange={(event) => updateFormField('observaciones', event.target.value)}
                    placeholder="Notas comerciales, condiciones o datos pendientes."
                  />
                </label>
              )}
            </div>

            {mostrarPlanEditable && (
              <div className="payment-plan-box">
                <div className="payment-plan-header">
                  <div>
                    <h3>Plan de pagos</h3>
                    <p>Define los pagos esperados para esta operación vigente.</p>
                  </div>

                  <select
                    value={planPagos}
                    onChange={(event) => updatePlanPagos(event.target.value as PlanPagos)}
                  >
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
            )}

            {isEdit && editingOperacion?.tiene_pagos && (
              <div className="notice">
                Esta operación ya tiene un plan de pagos. Gestiónalo desde el módulo Pagos; aquí no se
                crean pagos nuevos.{' '}
                <Link href={`/pagos?operacion_id=${encodeURIComponent(editingId ?? '')}`}>
                  Ver pagos
                </Link>
              </div>
            )}

            <div className="client-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                {isActivate ? 'Cancelar' : isEdit ? 'Cancelar edición' : 'Cancelar'}
              </button>

              <button type="submit" className="btn-primary" disabled={saving}>
                {isActivate
                  ? saving
                    ? 'Activando...'
                    : 'Aprobar y activar operación'
                  : isEdit
                  ? saving
                    ? 'Actualizando...'
                    : 'Actualizar operación'
                  : saving
                  ? 'Guardando...'
                  : 'Guardar operación'}
              </button>
            </div>
          </form>
        )}

        <div className="client-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, descripción, responsable, estado o cobro..."
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
                  <th>Estado comercial</th>
                  <th>Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredOperaciones.map((operacion) => {
                  const estado = normalizeEstadoComercial(operacion.estado_operacion);
                  const tienePagos = Boolean(operacion.tiene_pagos);
                  const estadoCobro = operacion.estado_cobro || 'Sin plan';
                  const esCotizacion = estado === 'Cotización enviada';

                  return (
                    <tr key={operacion.operacion_id}>
                      <td>{operacion.operacion_id}</td>
                      <td>{operacion.cliente_nombre || operacion.cliente_id}</td>
                      <td>
                        <strong>{operacion.descripcion_operacion}</strong>
                        <span>{operacion.tipo_operacion}</span>
                      </td>
                      <td>{operacion.responsable || '-'}</td>
                      <td>
                        <span className="status-pill">{estado}</span>
                        <span>{estadoCobro}</span>
                        {operacion.requiere_regularizacion && (
                          <span>Requiere regularización</span>
                        )}
                      </td>
                      <td>{formatCurrency(operacion.monto_total_comprometido)}</td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => startEdit(operacion)}
                          >
                            Editar
                          </button>

                          {esCotizacion && !tienePagos && (
                            <button
                              type="button"
                              className="btn-primary btn-small"
                              onClick={() => startActivate(operacion)}
                            >
                              Aprobar cotización
                            </button>
                          )}

                          {tienePagos && (
                            <Link
                              href={`/pagos?operacion_id=${encodeURIComponent(operacion.operacion_id)}`}
                              className="btn-secondary btn-small"
                            >
                              Ver pagos
                            </Link>
                          )}

                          {!tienePagos && !esCotizacion && <span>Sin plan de pagos</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
