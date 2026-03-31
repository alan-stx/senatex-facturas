/**
 * Configuración centralizada del servidor
 * Lee variables de entorno y provee valores por defecto
 */

import type { AppConfig } from '@/types';

/**
 * Obtiene la configuración de la aplicación desde variables de entorno
 * Solo debe usarse en el servidor (route handlers, server components)
 */
export function getServerConfig() {
  return {
    n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
    n8nApiKey: process.env.N8N_API_KEY || '',
    maxPdfMb: parseInt(process.env.MAX_PDF_MB || '20', 10),
    appName: process.env.APP_NAME || 'Facturas SENATEX',
    companyName: process.env.COMPANY_NAME || 'Servicio Nacional Textil',
    defaultBranch: process.env.DEFAULT_BRANCH || '',
    defaultPos: process.env.DEFAULT_POS || '',
  };
}

/**
 * Configuración segura para enviar al frontend (sin secretos)
 */
export function getPublicConfig(): AppConfig {
  const config = getServerConfig();
  return {
    appName: config.appName,
    companyName: config.companyName,
    maxPdfMb: config.maxPdfMb,
    defaultBranch: config.defaultBranch,
    defaultPos: config.defaultPos,
  };
}
