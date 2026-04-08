import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlanoEstudo {
  id: string;
  user_id: string;
  nome: string;
  data_prova: string | null;
  source_type: 'edital' | 'manual' | 'combined';
  study_mode: 'continuo' | 'edital';
  target_score: number | null;
  current_cycle: number;
  triage_enabled: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  editais: PlanoEdital[];
}

export interface PlanoEdital {
  id: string;
  plano_id: string;
  edital_id: number;
  cargo_id: number;
  created_at: string;
}

export function usePlanosEstudo() {
  const [planos, setPlanos] = useState<PlanoEstudo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlanos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    const { data, error } = await supabase
      .from('planos_estudo')
      .select('*, planos_editais(*)')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPlanos(data.map((p: any) => ({
        ...p,
        editais: p.planos_editais || [],
      })));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadPlanos(); }, [loadPlanos]);

  const createPlano = useCallback(async (params: {
    nome: string;
    data_prova?: string | null;
    source_type?: 'edital' | 'manual' | 'combined';
    study_mode?: 'continuo' | 'edital';
    target_score?: number | null;
    edital_id?: number;
    cargo_id?: number;
  }): Promise<PlanoEstudo | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: plano, error } = await supabase
      .from('planos_estudo')
      .insert({
        user_id: user.id,
        nome: params.nome,
        data_prova: params.data_prova || null,
        source_type: params.source_type || 'edital',
        study_mode: params.study_mode || (params.data_prova ? 'edital' : 'continuo'),
        target_score: params.target_score || null,
      })
      .select()
      .single();

    if (error || !plano) return null;

    if (params.edital_id && params.cargo_id) {
      await supabase.from('planos_editais').insert({
        plano_id: plano.id,
        edital_id: params.edital_id,
        cargo_id: params.cargo_id,
      });
    }

    await loadPlanos();
    return { ...plano, editais: [] } as PlanoEstudo;
  }, [loadPlanos]);

  const findPlanoByEdital = useCallback((editalId: number, cargoId: number): PlanoEstudo | null => {
    return planos.find(p =>
      p.editais.some(e => e.edital_id === editalId && e.cargo_id === cargoId)
    ) || null;
  }, [planos]);

  const updatePlano = useCallback(async (planoId: string, updates: Partial<Pick<PlanoEstudo, 'nome' | 'data_prova' | 'target_score' | 'current_cycle' | 'triage_enabled' | 'study_mode' | 'ativo'>>) => {
    const { error } = await supabase
      .from('planos_estudo')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', planoId);

    if (!error) await loadPlanos();
    return !error;
  }, [loadPlanos]);

  const deletePlano = useCallback(async (planoId: string) => {
    const { error } = await supabase
      .from('planos_estudo')
      .delete()
      .eq('id', planoId);

    if (!error) await loadPlanos();
    return !error;
  }, [loadPlanos]);

  return { planos, isLoading, createPlano, findPlanoByEdital, updatePlano, deletePlano, loadPlanos };
}
