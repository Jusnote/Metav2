import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GerarCronogramaResult } from '@/types/cronograma';

export interface UseGerarCronogramaState {
  isGenerating: boolean;
  result: GerarCronogramaResult | null;
  error: string | null;
}

/**
 * Wrapper para a função Postgres `gerar_cronograma(plano_uuid)`.
 * Chama via supabase.rpc — atômico e server-side.
 */
export function useGerarCronograma() {
  const [state, setState] = useState<UseGerarCronogramaState>({
    isGenerating: false,
    result: null,
    error: null,
  });

  const gerar = useCallback(async (planoId: string): Promise<GerarCronogramaResult> => {
    setState({ isGenerating: true, result: null, error: null });
    const { data, error } = await supabase.rpc('gerar_cronograma', {
      plano_uuid: planoId,
    });
    if (error) {
      setState({ isGenerating: false, result: null, error: error.message });
      throw new Error(error.message);
    }
    const result = data as unknown as GerarCronogramaResult;
    setState({ isGenerating: false, result, error: null });
    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ isGenerating: false, result: null, error: null });
  }, []);

  return { ...state, gerar, reset };
}
