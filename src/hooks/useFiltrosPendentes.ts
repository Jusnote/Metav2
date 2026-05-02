import { useQuestoesFilterDraft } from '@/contexts/QuestoesFilterDraftContext';

export function useFiltrosPendentes() {
  return useQuestoesFilterDraft();
}
