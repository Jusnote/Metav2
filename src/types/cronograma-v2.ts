/**
 * Tipos derivados do Cronograma V2 — não saem do gen types.
 * Espelha enums e payloads do plan_events.
 */
import type { Database } from './database';

// =============================================================================
// Enums (re-exports do database.ts pra ergonomia)
// =============================================================================

export type NivelConhecimento = Database['public']['Enums']['nivel_conhecimento_enum'];
export type SimuladosFreq = Database['public']['Enums']['simulados_freq_enum'];
export type TipoMaterial = Database['public']['Enums']['tipo_material_enum'];
export type HorarioPreferido = Database['public']['Enums']['horario_preferido_enum'];
export type PlanTemplateVisibility = Database['public']['Enums']['plan_template_visibility'];

// =============================================================================
// Event payloads (plan_events.payload tipados)
// =============================================================================

export type PlanEventType =
  | 'item.completed'
  | 'item.skipped'
  | 'week.completed'
  | 'week.behind'
  | 'pendencia.created'
  | 'level_drift.detected'
  | 'template.copied';

export interface PlanEventPayloads {
  'item.completed': {
    item_id: string;
    week_number: number;
    type: string;
    completed_at: string | null;
    subtopico_id: string | null;
  };
  'item.skipped': {
    item_id: string;
    week_number: number;
    reason?: string;
  };
  'week.completed': {
    week_number: number;
  };
  'week.behind': {
    week_number: number;
    current_pct: number;
  };
  'pendencia.created': {
    from_week: number;
    items: string[];
    total_minutes: number;
  };
  'level_drift.detected': {
    disciplina_id: string;
    declared_level: NivelConhecimento;
    observed_level: NivelConhecimento;
    confidence: number;
  };
  'template.copied': {
    template_id: string;
    plano_id: string;
  };
}

// =============================================================================
// Decomposição IA (cache estruturado)
// =============================================================================

export interface EditalDecomposicao {
  version: string;
  generated_by: string;
  disciplinas: Array<{
    external_id: number;
    nome: string;
    topicos: Array<{
      external_id: number;
      nome_original: string;
      nome_curto: string;
      conceitos_pai: string[];
      referencias_legais: string[];
      subtopicos: Array<{
        nome: string;
        duracao_min: number;
        conceito_pai?: string;
      }>;
    }>;
  }>;
}

// =============================================================================
// Cargo snapshot (planos_estudo.cargo_snapshot)
// =============================================================================

export interface CargoSnapshot {
  cargo_id: number;
  nome: string;
  edital_id: number;
  qtd_disciplinas: number;
  captured_at: string;  // ISO timestamp
}

// =============================================================================
// Reason codes (plan_decisions.reason)
// =============================================================================

export type ReasonCode =
  | 'absorption_phase'
  | 'consolidation_phase'
  | 'fsrs_optimal'
  | 'round_robin_disciplina'
  | 'ponto_fraco_boost'
  | 'nivel_iniciante_multiplier'
  | 'nivel_avancado_multiplier'
  | 'pendencia_carryover'
  | 'simulado_periodic'
  | 'redacao_weekly'
  | 'feriado_skip'
  | 'week_completed_early'
  | 'week_behind';

export const REASON_LABELS: Record<ReasonCode, string> = {
  absorption_phase: 'Fase de absorção de conteúdo novo',
  consolidation_phase: 'Fase de consolidação + revisões',
  fsrs_optimal: 'Timing FSRS calculado pelo desempenho',
  round_robin_disciplina: 'Round-robin entre disciplinas',
  ponto_fraco_boost: 'Mais peso por ponto fraco declarado',
  nivel_iniciante_multiplier: 'Tempo ampliado por nível iniciante',
  nivel_avancado_multiplier: 'Tempo reduzido por nível avançado',
  pendencia_carryover: 'Reagendado de semana anterior',
  simulado_periodic: 'Simulado periódico configurado',
  redacao_weekly: 'Bloco de redação semanal',
  feriado_skip: 'Pulado por feriado nacional',
  week_completed_early: 'Recalibrado por término antecipado',
  week_behind: 'Detectado atraso na semana',
};
