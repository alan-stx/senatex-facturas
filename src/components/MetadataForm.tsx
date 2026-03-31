'use client';

import type { UploadMetadata } from '@/types';

interface MetadataFormProps {
  /** Datos actuales del formulario */
  data: UploadMetadata;
  /** Callback para actualizar campos */
  onChange: (data: UploadMetadata) => void;
  /** Si el formulario está deshabilitado */
  disabled?: boolean;
}

/**
 * Formulario de metadatos para el envío de facturas
 * Campos: usuario, sucursal, punto de venta, observación
 */
export default function MetadataForm({
  data,
  onChange,
  disabled = false,
}: MetadataFormProps) {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  return (
    <div className="form-grid">
      {/* Usuario */}
      <div className="form-group">
        <label className="form-label" htmlFor="input-uploaded-by">
          Usuario <span>*</span>
        </label>
        <input
          id="input-uploaded-by"
          name="uploaded_by"
          type="text"
          className="form-input"
          placeholder="Nombre del vendedor"
          value={data.uploaded_by}
          onChange={handleChange}
          disabled={disabled}
          required
          autoComplete="name"
        />
      </div>

      {/* Sucursal */}
      <div className="form-group">
        <label className="form-label" htmlFor="input-sucursal-usuario">
          Sucursal <span>*</span>
        </label>
        <input
          id="input-sucursal-usuario"
          name="sucursal_usuario"
          type="text"
          className="form-input"
          placeholder="Ej: Central, Sucursal 1"
          value={data.sucursal_usuario}
          onChange={handleChange}
          disabled={disabled}
          required
        />
      </div>

      {/* Punto de venta */}
      <div className="form-group">
        <label className="form-label" htmlFor="input-punto-venta-usuario">
          Punto de Venta <span>*</span>
        </label>
        <input
          id="input-punto-venta-usuario"
          name="punto_venta_usuario"
          type="text"
          className="form-input"
          placeholder="Ej: POS-1, Caja 2"
          value={data.punto_venta_usuario}
          onChange={handleChange}
          disabled={disabled}
          required
        />
      </div>

      {/* Observación */}
      <div className="form-group">
        <label className="form-label" htmlFor="input-observacion">
          Observación
        </label>
        <textarea
          id="input-observacion"
          name="observacion"
          className="form-textarea"
          placeholder="Nota opcional sobre la factura..."
          value={data.observacion || ''}
          onChange={handleChange}
          disabled={disabled}
          rows={2}
        />
      </div>
    </div>
  );
}
