export type MarkKind = 'plain' | 'attention' | 'underline' | 'strike';

export type MarkTypeId = 'pegadinha' | 'chave' | 'cuidado' | 'sacada' | 'revisar';

/** Ferramentas da marcação v2 (barra/popover): pegadinha, grifar, sublinhar, tachar. */
export type ToolId = 'peg' | 'comum' | 'sub' | 'tax';

export const TOOL_TO_KIND: Record<ToolId, MarkKind> = {
  peg: 'attention',
  comum: 'plain',
  sub: 'underline',
  tax: 'strike',
};

/** Âncora persistente (W3C TextQuote Selector). */
export interface Anchor {
  quote: string;
  prefix: string;
  suffix: string;
}

/** Uma marca, como vem do banco e como o front usa. */
export interface Highlight {
  id: string;
  questionId: number;
  target: string;        // 'enunciado' | 'alt:A' | 'alt:B'...
  kind: MarkKind;
  color: string;         // hex #RRGGBB
  type: MarkTypeId | null;
  quote: string;
  prefix: string;
  suffix: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
