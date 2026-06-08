export type MarkKind = 'plain' | 'attention';

export type MarkTypeId = 'pegadinha' | 'chave' | 'cuidado' | 'sacada' | 'revisar';

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
