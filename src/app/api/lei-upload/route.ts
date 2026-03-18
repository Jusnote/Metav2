// ============================================================
// API Route: /api/lei-upload
// Server-side proxy for lei upload using service_role_key.
// Validates JWT + admin role before executing.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Server-only Supabase client with service_role (bypasses RLS)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY server environment variable');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Extract and validate JWT from Authorization header
async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const db = getServiceClient();

  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// Check if user has admin role in profiles table
async function isAdmin(userId: string): Promise<boolean> {
  const db = getServiceClient();

  const { data, error } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) return false;
  return data.role === 'admin';
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado. Faça login novamente.' },
        { status: 401 }
      );
    }

    // 2. Authorize (admin only)
    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado. Apenas administradores podem importar leis.' },
        { status: 403 }
      );
    }

    // 3. Parse body
    const { lei, artigos } = await req.json();

    if (!lei?.id || !Array.isArray(artigos)) {
      return NextResponse.json(
        { success: false, error: 'Payload inválido: lei e artigos são obrigatórios.' },
        { status: 400 }
      );
    }

    // 4. Execute atomic RPC
    const db = getServiceClient();

    const { data, error } = await db.rpc('upsert_lei_com_artigos', {
      p_lei: lei,
      p_artigos: artigos,
    });

    if (error) {
      console.error('[lei-upload] RPC error:', error);
      return NextResponse.json(
        { success: false, error: `Erro no banco: ${error.message}` },
        { status: 500 }
      );
    }

    // RPC returns JSONB { success, lei_id, artigos_inseridos } or { success: false, error }
    if (data && !data.success) {
      return NextResponse.json(
        { success: false, error: data.error || 'Erro desconhecido na RPC' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lei_id: data?.lei_id,
      artigos_inseridos: data?.artigos_inseridos,
    });
  } catch (err) {
    console.error('[lei-upload] Unexpected error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Erro inesperado: ${message}` },
      { status: 500 }
    );
  }
}
