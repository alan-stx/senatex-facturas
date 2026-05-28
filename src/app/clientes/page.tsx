'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import type { Cliente, ClienteCreatePayload } from '@/types';

const initialForm: ClienteCreatePayload = {
  razon_social: '',
  nombre_contacto: '',
  nit: '',
  tipo_cliente: 'Institucional',
  telefono: '',
  correo: '',
  direccion: '',
  estado_cliente: 'Activo',
  observaciones: '',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClienteCreatePayload>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);

  function handleEditCliente(cliente: Cliente) {
    setEditingClienteId(cliente.cliente_id);

    setForm({
      razon_social: cliente.razon_social || '',
      nombre_contacto: cliente.nombre_contacto || '',
      nit: cliente.nit || '',
      tipo_cliente: cliente.tipo_cliente || 'Institucional',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      direccion: cliente.direccion || '',
      estado_cliente: cliente.estado_cliente || 'Activo',
      observaciones: cliente.observaciones || '',
    });

    setShowForm(true);
    setMessage('');
  }

  async function loadClientes() {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/clientes');
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudieron cargar los clientes.');
      }

      setClientes(data.clientes || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al cargar clientes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClientes();
  }, []);

  const filteredClientes = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return clientes;

    return clientes.filter((cliente) => {
      return [
        cliente.razon_social,
        cliente.nombre_contacto,
        cliente.nit,
        cliente.tipo_cliente,
        cliente.telefono,
        cliente.correo,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(value));
    });
  }, [clientes, search]);

  function updateField(field: keyof ClienteCreatePayload, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.razon_social.trim()) {
      setMessage('La razón social es obligatoria.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/clientes', {
        method: editingClienteId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cliente_id: editingClienteId,
          ...form,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo registrar el cliente.');
      }

      if (data.cliente) {
        setClientes((current) => {
          if (editingClienteId) {
            return current.map((cliente) =>
              cliente.cliente_id === editingClienteId ? data.cliente : cliente
            );
          }

          return [data.cliente, ...current];
        });
      }

      setForm(initialForm);
      setEditingClienteId(null);
      setShowForm(false);
      setMessage(data.message || 'Cliente registrado correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al registrar cliente.');
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
            <h1>Clientes</h1>
            <p>Registro, edición y consulta de clientes institucionales.</p>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? 'Cerrar formulario' : '+ Nuevo cliente'}
          </button>
        </div>

        {message && <div className="notice">{message}</div>}

        <div className="client-summary-grid">
          <div className="client-summary-card">
            <span>Total clientes</span>
            <strong>{clientes.length}</strong>
          </div>

          <div className="client-summary-card">
            <span>Activos</span>
            <strong>{clientes.filter((cliente) => cliente.estado_cliente === 'Activo').length}</strong>
          </div>

          <div className="client-summary-card">
            <span>Institucionales</span>
            <strong>
              {clientes.filter((cliente) => cliente.tipo_cliente === 'Institucional').length}
            </strong>
          </div>
        </div>

        {showForm && (
          <form className="client-form" onSubmit={handleSubmit}>
            <h2>{editingClienteId ? 'Editar cliente' : 'Nuevo cliente'}</h2>

            <div className="client-form-grid">
              <label>
                Razón social *
                <input
                  value={form.razon_social}
                  onChange={(event) => updateField('razon_social', event.target.value)}
                  placeholder="Ej. Gobierno Autónomo Municipal..."
                />
              </label>

              <label>
                NIT
                <input
                  value={form.nit}
                  onChange={(event) => updateField('nit', event.target.value)}
                  placeholder="Ej. 123456789"
                />
              </label>

              <label>
                Nombre contacto
                <input
                  value={form.nombre_contacto}
                  onChange={(event) => updateField('nombre_contacto', event.target.value)}
                  placeholder="Ej. Juan Pérez"
                />
              </label>

              <label>
                Tipo cliente
                <select
                  value={form.tipo_cliente}
                  onChange={(event) => updateField('tipo_cliente', event.target.value)}
                >
                  <option value="Institucional">Institucional</option>
                  <option value="Público">Público</option>
                  <option value="Privado">Privado</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>

              <label>
                Teléfono
                <input
                  value={form.telefono}
                  onChange={(event) => updateField('telefono', event.target.value)}
                  placeholder="Ej. 70000000"
                />
              </label>

              <label>
                Correo
                <input
                  type="email"
                  value={form.correo}
                  onChange={(event) => updateField('correo', event.target.value)}
                  placeholder="correo@institucion.gob.bo"
                />
              </label>

              <label>
                Dirección
                <input
                  value={form.direccion}
                  onChange={(event) => updateField('direccion', event.target.value)}
                  placeholder="Ciudad / dirección referencial"
                />
              </label>

              <label>
                Estado
                <select
                  value={form.estado_cliente}
                  onChange={(event) => updateField('estado_cliente', event.target.value)}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Observado">Observado</option>
                </select>
              </label>

              <label className="client-form-full">
                Observaciones
                <textarea
                  value={form.observaciones}
                  onChange={(event) => updateField('observaciones', event.target.value)}
                  placeholder="Notas comerciales, referencias o datos pendientes."
                />
              </label>
            </div>

            <div className="client-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setForm(initialForm);
                  setEditingClienteId(null);
                  setShowForm(false);
                }}
              >
                Cancelar
              </button>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editingClienteId ? 'Actualizar cliente' : 'Guardar cliente'}
              </button>
            </div>
          </form>
        )}

        <div className="client-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por razón social, NIT, contacto, teléfono o correo..."
          />
        </div>

        <div className="client-table-card">
          {loading ? (
            <p>Cargando clientes...</p>
          ) : filteredClientes.length === 0 ? (
            <p>No se encontraron clientes.</p>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Razón social</th>
                  <th>NIT</th>
                  <th>Contacto</th>
                  <th>Tipo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.cliente_id}>
                    <td>{cliente.cliente_id}</td>
                    <td>
                      <strong>{cliente.razon_social}</strong>
                      {cliente.correo && <span>{cliente.correo}</span>}
                    </td>
                    <td>{cliente.nit || '-'}</td>
                    <td>{cliente.nombre_contacto || '-'}</td>
                    <td>{cliente.tipo_cliente || '-'}</td>
                    <td>{cliente.telefono || '-'}</td>
                    <td>
                      <span className="status-pill">{cliente.estado_cliente || 'Activo'}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => handleEditCliente(cliente)}
                      >
                        Editar
                      </button>
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