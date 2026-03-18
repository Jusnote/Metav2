// ============================================================
// Lei Exporter — Upload parsed data via API Route (server-side)
// Handles both JSON download and secure Supabase upload.
// ============================================================

import type { ExportedLei, LeiMetadata } from '@/types/lei-import';
import { supabase } from '@/integrations/supabase/client';

// --- JSON file download ---

export function downloadAsJson(data: ExportedLei, metadata: LeiMetadata): void {
  const fullExport = {
    ...data,
    lei: {
      ...data.lei,
      id: metadata.id,
      numero: metadata.numero,
      nome: metadata.nome,
      sigla: metadata.sigla,
      ementa: metadata.ementa,
      data_publicacao: metadata.data_publicacao,
      total_artigos: data.artigos.length,
    },
  };

  const json = JSON.stringify(fullExport, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${metadata.sigla || metadata.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Supabase upload via API Route ---

export interface UploadProgress {
  phase: 'lei' | 'artigos' | 'done';
  current: number;
  total: number;
  message: string;
}

export async function uploadToSupabase(
  data: ExportedLei,
  metadata: LeiMetadata,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current session JWT
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    const token = sessionData.session.access_token;

    // Phase 1: Prepare lei payload
    onProgress?.({
      phase: 'lei',
      current: 0,
      total: 1,
      message: `Preparando lei "${metadata.nome}"...`,
    });

    const leiPayload = {
      id: metadata.id,
      numero: metadata.numero,
      nome: metadata.nome,
      sigla: metadata.sigla,
      ementa: metadata.ementa,
      data_publicacao: metadata.data_publicacao || null,
      hierarquia: data.lei.hierarquia,
      total_artigos: data.artigos.length,
    };

    // Phase 2: Prepare artigos payload
    onProgress?.({
      phase: 'artigos',
      current: 0,
      total: data.artigos.length,
      message: `Preparando ${data.artigos.length} artigos...`,
    });

    const artigosPayload = data.artigos.map((art) => ({
      id: `${metadata.id}-${art.id}`,
      numero: art.numero,
      slug: `${metadata.id}-${art.slug}`,
      epigrafe: art.epigrafe || '',
      plate_content: art.plate_content,
      texto_plano: art.texto_plano,
      search_text: art.search_text,
      vigente: art.vigente,
      contexto: art.contexto,
      path: art.path,
      content_hash: art.content_hash,
      revoked_versions: art.revoked_versions || [],
    }));

    // Phase 3: Send to API Route (atomic operation)
    onProgress?.({
      phase: 'artigos',
      current: Math.floor(data.artigos.length / 2),
      total: data.artigos.length,
      message: 'Enviando para o servidor...',
    });

    const response = await fetch('/api/lei-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        lei: leiPayload,
        artigos: artigosPayload,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || `Erro HTTP ${response.status}`,
      };
    }

    onProgress?.({
      phase: 'done',
      current: data.artigos.length,
      total: data.artigos.length,
      message: `${result.artigos_inseridos} artigos importados com sucesso!`,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Erro inesperado: ${message}` };
  }
}
