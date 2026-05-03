import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import type { QuestoesFilters } from '@/contexts/QuestoesContext';

/**
 * Adapta AppliedFilters (URL/3c-3) para QuestoesFilters (consumido pelo
 * useQuestoesV2). Mapeia visibility strings → boolean excludes.
 *
 * Campos não mapeados:
 * - excluirResolvidas: sem equivalente em AppliedFilters (toggle ainda
 *   desabilitado no card novo). Default false.
 * - areas_concurso, especialidades, tipos, formatos, org_cargo_pairs:
 *   extras de AppliedFilters não consumidos pela API de busca atual.
 */
export function appliedToQuestoesFilters(a: AppliedFilters): QuestoesFilters {
  return {
    materias: a.materias,
    assuntos: a.assuntos,
    bancas: a.bancas,
    anos: a.anos,
    orgaos: a.orgaos,
    cargos: a.cargos,
    nodeIds: a.nodeIds,
    excluirAnuladas: a.visibility_anuladas === 'esconder',
    excluirDesatualizadas: a.visibility_desatualizadas === 'esconder',
    excluirResolvidas: false,
  };
}
