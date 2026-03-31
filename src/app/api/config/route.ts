/**
 * API Route: GET /api/config
 * 
 * Devuelve la configuración pública de la aplicación al frontend.
 * NO expone secretos como la API key de n8n.
 */

import { NextResponse } from 'next/server';
import { getPublicConfig } from '@/lib/config';

export async function GET() {
  const config = getPublicConfig();
  return NextResponse.json(config);
}
