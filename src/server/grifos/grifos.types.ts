// Tipos do extrator de grifo ("comentários do professor").
// GrifoRaw: o que o Opus devolve. Grifo: o que persiste no cache e vai pro front
// (target + trecho + prefix/suffix p/ o resolveAnchor da lib de highlights achar).

/** Item bruto retornado pelo modelo (antes de validar/resolver). */
export interface GrifoRaw {
  local: string;
  trecho: string;
  tipo_armadilha: string;
  tooltip: string;
}

/**
 * Grifo já validado e resolvido para o front.
 * `trecho` é GARANTIDO de existir literalmente no texto do `target`
 * (snap para a substring exata da fonte quando o modelo varia espaços),
 * para o `resolveAnchor` (indexOf estrito) achar sempre.
 */
export interface Grifo {
  /** 'enunciado' ou 'alt:A'..'alt:E' — qual bloco markable recebe o grifo. */
  target: string;
  /** Citação literal — substring exata do texto do target. */
  trecho: string;
  /** Até 32 chars antes da 1ª ocorrência (desambigua trechos repetidos). */
  prefix: string;
  /** Até 32 chars depois da 1ª ocorrência. */
  suffix: string;
  tipoArmadilha: string;
  tooltip: string;
}

/** Uma alternativa da questão. */
export interface GrifoAlternativa {
  letter: string;
  text: string;
}

/** Entrada do extrator: a questão + gabarito + metadados. */
export interface GrifoQuestion {
  enunciado: string;
  alternativas: GrifoAlternativa[];
  correta: string;
  banca?: string;
  ano?: string | number;
  tipoQuestao?: string;
}

/** Saída do extrator. */
export interface ExtractResult {
  tipoEstrutura: string | null;
  grifos: Grifo[];
}

/** Modelo Opus (inegociável — Qwen errou doutrina). */
export const GRIFO_MODEL = 'claude-opus-4-8';

/** Versão do prompt — recomputar ao evoluir sem perder cache antigo. */
export const PROMPT_VERSION = 1;
