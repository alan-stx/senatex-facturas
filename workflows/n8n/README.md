# Workflows n8n - SENATEX

Esta carpeta contiene los workflows exportados desde n8n para control de versiones.

## Flujos principales

- SENATEX - Facturas PDF: carga, lectura y registro de facturas PDF.
- SENATEX - Facturas Ingresos: gestión de cuentas por cobrar.
- SENATEX - Clientes: gestión de clientes.
- SENATEX - Operaciones: gestión comercial/operaciones.
- SENATEX - Pagos: gestión de pagos.

## Regla de trabajo

Después de modificar un workflow en n8n:

1. Exportar el workflow como JSON.
2. Reemplazar el archivo correspondiente en esta carpeta.
3. Hacer commit en Git.
4. Subir a GitHub.

No guardar credenciales, tokens ni variables secretas en esta carpeta.