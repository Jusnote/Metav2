'use client';

/**
 * Toggle "Incluir fora do foco" da aba Filtro semântico.
 *
 * Fase 1A: só a UI. `visible={false}` por default → não aparece até Fase 2
 * conectar a lógica real de contagem `fora_foco` via useQuestoesV2.
 */

interface SemanticScopeToggleProps {
  visible: boolean;
  incluirFora: boolean;
  onToggle: () => void;
  countFora?: number;
}

export function SemanticScopeToggle({
  visible,
  incluirFora,
  onToggle,
  countFora,
}: SemanticScopeToggleProps) {
  if (!visible) return null;

  return (
    <div className="mt-2 flex items-center gap-2 px-3">
      {incluirFora ? (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-medium text-[#1e40af] transition-colors hover:bg-[#dbeafe]"
        >
          <span>✓ incluindo fora do foco</span>
          <span className="text-[#64748b]">· remover</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#cbd5e1] px-3 py-1 text-[11px] font-medium text-[#64748b] transition-colors hover:border-[#64748b] hover:text-[#0f172a]"
        >
          <span>+</span>
          <span>
            Incluir{typeof countFora === 'number' ? ` ${countFora}` : ''} resultados fora do foco
          </span>
        </button>
      )}
    </div>
  );
}
