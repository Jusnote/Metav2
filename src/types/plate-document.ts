import { BaseEntity } from '../hooks/useServerFirst';

/**
 * Tipos para documentos do Plate Editor
 */

// Tipo para o conteúdo JSON do Plate (array de nós)
export type PlateContent = any[];

// Interface para documento Plate no banco de dados
export interface PlateDocument extends BaseEntity {
  title: string;
  content: PlateContent; // JSON do editor Plate
  content_text?: string; // Versão texto para busca
  is_favorite?: boolean;
  tags?: string[];
  subtopic_id?: string;
}

// Dados para criar novo documento
export interface PlateDocumentInsert {
  title?: string;
  content: PlateContent;
  content_text?: string;
  is_favorite?: boolean;
  tags?: string[];
  subtopic_id?: string;
}

// Dados para atualizar documento existente
export interface PlateDocumentUpdate {
  title?: string;
  content?: PlateContent;
  content_text?: string;
  is_favorite?: boolean;
  tags?: string[];
  subtopic_id?: string;
}

// Status de salvamento para UI
export type SaveStatus =
  | { type: 'idle' }
  | { type: 'saving' }
  | { type: 'saved'; at: Date }
  | { type: 'error'; message: string };
