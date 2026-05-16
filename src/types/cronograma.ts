/**
 * Tipos do Cronograma V2 — schema clean-slate.
 * Espelha as tabelas criadas em 20260512000000_cronograma_v2_clean_slate.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =============================================================================
// Enums
// =============================================================================
export type PlanoMode = 'edital' | 'continuo' | 'misto';
export type PlanoStatus = 'rascunho' | 'ativo' | 'pausado' | 'concluido' | 'arquivado';

export type ScheduleItemType =
  | 'estudo_inicial_p1'
  | 'estudo_inicial_p2'
  | 'revisao'
  | 'questoes'
  | 'flashcards'
  | 'simulado'
  | 'lei_seca';

export type ScheduleItemStatus =
  | 'pendente'
  | 'em_andamento'
  | 'concluido'
  | 'pulado'
  | 'cancelado'
  | 'reagendado';

export type PrioridadeDisciplina = 'alta' | 'media' | 'baixa';

export type AchievementCategory =
  | 'cronograma'
  | 'questoes'
  | 'revisoes'
  | 'flashcards'
  | 'misc';

export type ScheduleLogAction =
  | 'created'
  | 'completed'
  | 'rescheduled'
  | 'skipped'
  | 'reset'
  | 'cancelled'
  | 'started';

// =============================================================================
// Tabelas
// =============================================================================

export interface PlanoEstudo {
  id: string;
  user_id: string;
  nome: string;
  cargo_id: number | null;
  edital_id: number | null;
  data_inicio: string;       // DATE (ISO yyyy-mm-dd)
  data_prova: string;        // DATE
  target_score: number | null;
  mode: PlanoMode;
  status: PlanoStatus;
  paused_at: string | null;  // TIMESTAMPTZ
  created_at: string;
  updated_at: string;
}

export interface PlanoEstudoInsert {
  nome: string;
  cargo_id?: number | null;
  edital_id?: number | null;
  data_inicio: string;
  data_prova: string;
  target_score?: number | null;
  mode?: PlanoMode;
  status?: PlanoStatus;
}

export interface PlanoConfig {
  plano_id: string;
  weekday_minutes: number;
  weekend_minutes: number;
  daily_exceptions: Record<string, number>;
  fsrs_enabled: boolean;
  mix_ratio: {
    teoria: number;
    questoes: number;
    revisao: number;
    flashcards: number;
  };
  difficulty_weighting: boolean;
  block_duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface PlanoConfigInsert {
  plano_id: string;
  weekday_minutes?: number;
  weekend_minutes?: number;
  daily_exceptions?: Record<string, number>;
  fsrs_enabled?: boolean;
  mix_ratio?: PlanoConfig['mix_ratio'];
  difficulty_weighting?: boolean;
  block_duration_minutes?: number;
}

export interface PlanoDisciplina {
  id: string;
  plano_id: string;
  disciplina_id: string;
  peso: number;
  prioridade: PrioridadeDisciplina;
  enabled: boolean;
  ordem: number;
  created_at: string;
}

export interface PlanoDisciplinaInsert {
  plano_id: string;
  disciplina_id: string;
  peso?: number;
  prioridade?: PrioridadeDisciplina;
  enabled?: boolean;
  ordem?: number;
}

export interface ScheduleItem {
  id: string;
  user_id: string;
  plano_id: string;
  scheduled_date: string;          // DATE
  scheduled_time: string | null;   // TIME
  week_number: number;
  type: ScheduleItemType;
  status: ScheduleItemStatus;
  disciplina_id: string | null;
  topico_id: string | null;
  subtopico_id: string | null;
  title: string;
  estimated_duration_minutes: number;
  actual_duration_minutes: number | null;
  priority: number;
  parent_item_id: string | null;
  fsrs_state: Json | null;
  revision_number: number;
  performance: Json | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from subtopicos table when using select('*, subtopicos:subtopico_id(conceito_pai)') */
  subtopicos?: { conceito_pai: string | null } | null;
}

export interface ScheduleItemInsert {
  user_id: string;
  plano_id: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  type: ScheduleItemType;
  status?: ScheduleItemStatus;
  disciplina_id?: string | null;
  topico_id?: string | null;
  subtopico_id?: string | null;
  title: string;
  estimated_duration_minutes?: number;
  priority?: number;
  parent_item_id?: string | null;
  fsrs_state?: Json | null;
  revision_number?: number;
}

export interface ScheduleItemUpdate {
  status?: ScheduleItemStatus;
  completed_at?: string | null;
  actual_duration_minutes?: number | null;
  performance?: Json | null;
  scheduled_date?: string;
  notes?: string | null;
  priority?: number;
}

export interface WeeklyStats {
  plano_id: string;
  week_number: number;
  items_total: number;
  items_completed: number;
  items_overdue: number;
  items_skipped: number;
  minutes_estimated: number;
  minutes_actual: number;
  questoes_total: number;
  questoes_correct: number;
  desempenho_pct: number;        // GENERATED
  completion_pct: number;        // GENERATED
  updated_at: string;
}

export interface ScheduleLog {
  id: string;
  user_id: string;
  item_id: string | null;
  action: ScheduleLogAction;
  metadata: Json;
  created_at: string;
}

export interface AchievementCatalog {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: AchievementCategory;
  trigger_type: string;
  trigger_threshold: number;
  icon_name: string;
  ordem: number;
  active: boolean;
  created_at: string;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  progress: number;       // 0-1
  current_value: number;
  unlocked_at: string | null;
  updated_at: string;
}

// =============================================================================
// RPC return types
// =============================================================================

export interface GerarCronogramaResult {
  items_created: number;
  blocks_total: number;
  overflow_minutes: number;
  warnings: Array<string | { type: string; [k: string]: unknown }>;
}
