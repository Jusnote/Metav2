import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ApiDisciplina, ApiTopico } from '@/hooks/useEditaisData';

// ---------------------------------------------------------------------------
// useEditalSnapshot
// ---------------------------------------------------------------------------
// Creates / ensures local Supabase records (disciplinas, topicos) that mirror
// the external API edital data.  Two modes:
//   1. ensureTopicoLocal  – lazy, creates a single topic (+ its disciplina)
//   2. bulkCreateFromCargo – bulk, creates every topic for an entire cargo
// ---------------------------------------------------------------------------

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export function useEditalSnapshot() {
  // ------------------------------------------------------------------
  // getLocalTopicoId – look up existing local UUID by origin_topico_ref
  // ------------------------------------------------------------------
  const getLocalTopicoId = useCallback(
    async (originTopicoRef: number): Promise<string | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const { data } = await (supabase
        .from('topicos') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('origin_topico_ref', originTopicoRef)
        .maybeSingle();

      return data?.id ?? null;
    },
    [],
  );

  // ------------------------------------------------------------------
  // ensureDisciplinaLocal – internal helper
  // ------------------------------------------------------------------
  const ensureDisciplinaLocal = useCallback(
    async (opts: {
      userId: string;
      originDisciplinaRef: number;
      disciplinaNome: string;
      planoId?: string;
    }): Promise<string | null> => {
      const { userId, originDisciplinaRef, disciplinaNome, planoId } = opts;

      // Check if it already exists
      const { data: existing } = await (supabase
        .from('disciplinas') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('origin_disciplina_ref', originDisciplinaRef)
        .maybeSingle();

      if (existing?.id) return existing.id;

      // Create it
      const row: Record<string, unknown> = {
        user_id: userId,
        nome: disciplinaNome,
        origin_disciplina_ref: originDisciplinaRef,
        source_type: 'edital',
      };
      if (planoId) row.plano_id = planoId;

      const { data, error } = await (supabase
        .from('disciplinas') as any)
        .insert(row)
        .select('id')
        .single();

      if (error) {
        console.error('[useEditalSnapshot] ensureDisciplinaLocal error:', error);
        return null;
      }
      return data?.id ?? null;
    },
    [],
  );

  // ------------------------------------------------------------------
  // ensureTopicoLocal – lazy creation of a single topic
  // ------------------------------------------------------------------
  const ensureTopicoLocal = useCallback(
    async (opts: {
      originTopicoRef: number;
      originDisciplinaRef: number;
      topicoNome: string;
      disciplinaNome: string;
      planoId?: string;
    }): Promise<string | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const { originTopicoRef, originDisciplinaRef, topicoNome, disciplinaNome, planoId } = opts;

      // Already exists?
      const existingId = await getLocalTopicoId(originTopicoRef);
      if (existingId) return existingId;

      // Ensure parent disciplina
      const disciplinaId = await ensureDisciplinaLocal({
        userId,
        originDisciplinaRef,
        disciplinaNome,
        planoId,
      });
      if (!disciplinaId) return null;

      // Create topico
      const { data, error } = await (supabase
        .from('topicos') as any)
        .insert({
          user_id: userId,
          disciplina_id: disciplinaId,
          nome: topicoNome,
          origin_topico_ref: originTopicoRef,
          source_type: 'edital',
        })
        .select('id')
        .single();

      if (error) {
        console.error('[useEditalSnapshot] ensureTopicoLocal error:', error);
        return null;
      }
      return data?.id ?? null;
    },
    [getLocalTopicoId, ensureDisciplinaLocal],
  );

  // ------------------------------------------------------------------
  // bulkCreateFromCargo – upsert all disciplinas + topicos for a cargo
  // ------------------------------------------------------------------
  const bulkCreateFromCargo = useCallback(
    async (opts: {
      planoId: string;
      disciplinas: ApiDisciplina[];
      topicosPerDisciplina: Map<number, ApiTopico[]>;
    }): Promise<boolean> => {
      const userId = await getUserId();
      if (!userId) return false;

      const { planoId, disciplinas, topicosPerDisciplina } = opts;

      try {
        // 1. Upsert disciplinas
        const discRows = disciplinas.map((d) => ({
          user_id: userId,
          nome: d.nome,
          origin_disciplina_ref: d.fonteId || d.id,
          plano_id: planoId,
          source_type: 'edital' as const,
          peso_edital: d.totalTopicos,
        }));

        const { data: upsertedDiscs, error: discError } = await (supabase
          .from('disciplinas') as any)
          .upsert(discRows, { onConflict: 'user_id,origin_disciplina_ref' })
          .select('id, origin_disciplina_ref');

        if (discError) {
          console.error('[useEditalSnapshot] bulkCreateFromCargo disc error:', discError);
          return false;
        }

        // Build origin_disciplina_ref -> local uuid map
        const discMap = new Map<number, string>();
        for (const d of (upsertedDiscs ?? [])) {
          discMap.set(d.origin_disciplina_ref, d.id);
        }

        // 2. Upsert topicos
        const topicoRows: Record<string, unknown>[] = [];
        for (const [apiDiscId, topicos] of topicosPerDisciplina) {
          const localDiscId = discMap.get(apiDiscId);
          if (!localDiscId) continue;

          for (const t of topicos) {
            topicoRows.push({
              user_id: userId,
              disciplina_id: localDiscId,
              nome: t.nome,
              origin_topico_ref: t.fonteId || t.id,
              source_type: 'edital',
              estimated_duration_minutes: 120,
            });
          }
        }

        if (topicoRows.length > 0) {
          const { error: topicoError } = await (supabase
            .from('topicos') as any)
            .upsert(topicoRows, { onConflict: 'user_id,origin_topico_ref' });

          if (topicoError) {
            console.error('[useEditalSnapshot] bulkCreateFromCargo topico error:', topicoError);
            return false;
          }
        }

        return true;
      } catch (err) {
        console.error('[useEditalSnapshot] bulkCreateFromCargo unexpected error:', err);
        return false;
      }
    },
    [],
  );

  return { ensureTopicoLocal, bulkCreateFromCargo, getLocalTopicoId };
}
