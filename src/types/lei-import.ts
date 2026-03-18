// ============================================================
// Types for the Lei Import Pipeline
// Plain text → Parsed structure → Plate.js JSON → Supabase
// ============================================================

// --- Hierarchy ---

export type HierarchyLevel =
  | 'parte'
  | 'livro'
  | 'titulo'
  | 'subtitulo'
  | 'capitulo'
  | 'secao'
  | 'subsecao';

export interface HierarchyNode {
  tipo: HierarchyLevel | 'documento';
  titulo: string;
  partes: HierarchyNode[];
  livros: HierarchyNode[];
  titulos: HierarchyNode[];
  subtitulos: HierarchyNode[];
  capitulos: HierarchyNode[];
  secoes: HierarchyNode[];
  subsecoes: HierarchyNode[];
}

export interface HierarchyPath {
  parte?: string;
  livro?: string;
  titulo?: string;
  subtitulo?: string;
  capitulo?: string;
  secao?: string;
  subsecao?: string;
}

// --- Parser output ---

export type ParsedElementType =
  | 'artigo'
  | 'paragrafo'
  | 'paragrafo_unico'
  | 'inciso'
  | 'alinea'
  | 'item'
  | 'pena'
  | 'hierarchy'
  | 'epigrafe'
  | 'preambulo'
  | 'continuacao';

export interface ParsedElement {
  tipo: ParsedElementType;
  /** For hierarchy: the level (parte, titulo, etc.) */
  nivel?: HierarchyLevel;
  /** Number/label: "1º", "121-A", "I", "a", etc. */
  numero: string;
  /** Clean text (without annotations) */
  texto: string;
  /** Full original text (with annotations) */
  textoOriginal: string;
  /** Extracted annotations like "(Redação dada pela Lei nº ...)" */
  anotacoes: string[];
  /** Line number in source text */
  linha: number;
  /** Indent level for sub-elements */
  indent: number;
  /** For hierarchy: whether the description was inline with the header */
  _hasInlineDesc?: boolean;
}

export interface ParsedArticle {
  id: string;
  numero: string;
  slug: string;
  epigrafe: string;
  elementos: ParsedElement[];
  vigente: boolean;
  contexto: string;
  path: HierarchyPath;
}

export interface ParseResult {
  hierarquia: HierarchyNode;
  artigos: ParsedArticle[];
  resumo: {
    totalArtigos: number;
    totalHierarquia: Record<HierarchyLevel, number>;
    artigosRevogados: number;
    warnings: string[];
  };
}

// --- Plate.js output (matches bururu.json format) ---

export interface PlateChild {
  text: string;
  bold?: boolean;
}

export interface PlateElement {
  type: 'p';
  children: PlateChild[];
  id: string;
  slug: string;
  urn: string;
  search_text: string;
  texto_original: string | null;
  anotacoes: string[] | null;
  indent?: number;
}

export interface ExportedArticle {
  id: string;
  numero: string;
  slug: string;
  epigrafe: string;
  plate_content: PlateElement[];
  texto_plano: string;
  search_text: string;
  vigente: boolean;
  contexto: string;
  path: HierarchyPath;
  content_hash: string;
  revoked_versions: Array<string | { plate_content: PlateElement[]; texto_plano: string }>;
}

export interface ExportedLei {
  lei: {
    hierarquia: HierarchyNode;
  };
  artigos: ExportedArticle[];
}

// --- Supabase upload ---

export interface LeiMetadata {
  id: string;
  numero: string;
  nome: string;
  sigla: string;
  ementa: string;
  data_publicacao: string;
}

// --- Wizard state ---

export type ImportStep = 'paste' | 'hierarchy' | 'review' | 'export';

export interface ImportState {
  step: ImportStep;
  rawText: string;
  metadata: LeiMetadata;
  parseResult: ParseResult | null;
  exportData: ExportedLei | null;
}
