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
  // Pipeline v2/GraphQL optional fields
  texto_limpo?: string;
  anotacoes_legislativas?: LegislativeAnnotation[];
  texto_original_fonte?: string;
  fonte?: string;
  fonte_url?: string;
  qualidade_score?: number;
  flags?: Array<{ slug: string; reason: string; severity: 'error' | 'warning'; details?: string }>;
  reference_links?: Array<{ text: string; href: string; type: 'topico' | 'legislacao' }>;
  source_id?: number;
  source_type?: string;
  source_index?: number;
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

// --- GraphQL Pipeline Types ---

export type GraphQLItemType =
  | 'ARTIGO' | 'PARAGRAFO' | 'INCISO' | 'ALINEA'
  | 'PARTE' | 'LIVRO' | 'TITULO' | 'CAPITULO' | 'SECAO' | 'SUBSECAO'
  | 'EMENTA' | 'PROTOCOLO' | 'DOU_PUBLICACAO' | 'TABELA'
  | 'NAO_IDENTIFICADO';

export interface GraphQLItem {
  codeInt64: number;
  type: GraphQLItemType;
  description: string;
  revoked: boolean;
  index: number;
}

export interface StructuralItem extends GraphQLItem {
  subtitle: string | null;
}

export interface LawDocumentMeta {
  title: string;          // "LEI Nº 10.406, DE 10 DE JANEIRO DE 2002"
  description: string;    // "Institui o Código Civil."
  url: string;            // URL canônica no JusBrasil
  type: string;           // "LEI", "DECRETO", "DECRETO-LEI", etc.
  date: number;           // Timestamp em ms (data de publicação)
  docId: number;          // ID numérico do documento
  status: string;         // "ATIVO"
  keywords: string | null;
}

export interface LawDataExport {
  document?: LawDocumentMeta;
  docId?: number;
  extractedAt?: string;
  allItems: GraphQLItem[];
  structural: StructuralItem[];
  stats: {
    totalItems: number;
    totalStructural: number;
    totalArticles: number;
    totalRevoked?: number;
  };
}

export type NaoIdentificadoSubType =
  | 'subtitulo' | 'pena' | 'epigrafe' | 'anotacao_standalone'
  | 'vide' | 'vigencia' | 'preambulo' | 'html_content'
  | 'paragrafo_quebrado' | 'nao_classificado';

// --- Annotation Types ---

export type AnnotationType =
  | 'redacao' | 'inclusao' | 'revogacao' | 'vide' | 'vigencia'
  | 'regulamento' | 'producao_efeito' | 'veto' | 'outro';

export interface LegislativeAnnotation {
  texto: string;
  tipo: AnnotationType;
  lei_referenciada: string | null;
  dispositivo_slug: string;
}
