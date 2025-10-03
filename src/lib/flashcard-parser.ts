/**
 * 🎯 FLASHCARD PARSER - QUOTE BLOCK BASED
 * 
 * Analisa o conteúdo do BlockNote e separa automaticamente
 * em frente e verso baseado em quote blocks.
 * 
 * Estratégia:
 * - Tudo ANTES do primeiro quote = FRENTE
 * - Quote e tudo DEPOIS = VERSO
 */

export interface ParsedFlashcard {
  front: any[];
  back: any[];
  hasQuote: boolean;
  strategy: 'quote-based' | 'single-side';
}

/**
 * Extrai texto de um bloco BlockNote
 */
export function extractTextFromBlock(block: any): string {
  if (!block?.content) return '';
  
  if (Array.isArray(block.content)) {
    return block.content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('');
  }
  
  return '';
}

/**
 * Extrai título do primeiro bloco (se for heading)
 */
export function extractTitle(content: any[]): string {
  if (!content || content.length === 0) return 'Untitled';
  
  const firstBlock = content[0];
  if (firstBlock?.type === 'heading') {
    const title = extractTextFromBlock(firstBlock);
    return title || 'Untitled';
  }
  
  // Se não tem heading, usar o primeiro parágrafo
  const firstParagraph = content.find(block => 
    block.type === 'paragraph' && extractTextFromBlock(block).trim()
  );
  
  if (firstParagraph) {
    const text = extractTextFromBlock(firstParagraph);
    // Limitar a 50 caracteres para o título
    return text.length > 50 ? text.substring(0, 47) + '...' : text;
  }
  
  return 'Untitled';
}

/**
 * 🎯 FUNÇÃO PRINCIPAL DE PARSING
 * 
 * Separa o conteúdo do BlockNote em frente e verso
 * baseado na presença de quote blocks.
 */
export function parseFlashcardContent(content: any[]): ParsedFlashcard {
  if (!content || content.length === 0) {
    return {
      front: [],
      back: [],
      hasQuote: false,
      strategy: 'single-side'
    };
  }
  
  const front: any[] = [];
  const back: any[] = [];
  let foundQuote = false;
  
  // Processar cada bloco
  content.forEach((block, index) => {
    // Pular blocos vazios no final
    if (index === content.length - 1 && 
        block.type === 'paragraph' && 
        (!block.content || block.content.length === 0)) {
      return;
    }
    
    if (block.type === 'quote') {
      // Quote block = APENAS verso (não incluir na frente)
      back.push(block);
      foundQuote = true;
    } else if (!foundQuote) {
      // Antes do primeiro quote = frente
      front.push(block);
    } else {
      // Após quote = também verso
      back.push(block);
    }
  });
  
  return {
    front,
    back,
    hasQuote: foundQuote,
    strategy: foundQuote ? 'quote-based' : 'single-side'
  };
}

/**
 * Converte blocos parsed de volta para formato de salvamento
 */
export function formatForSave(parsed: ParsedFlashcard) {
  return {
    front: parsed.front,
    back: parsed.back,
    // Para compatibilidade, salvar tudo junto também
    content: [...parsed.front, ...parsed.back]
  };
}

/**
 * 🎨 PREVIEW DE TEXTO PARA DEBUG
 */
export function getPreviewText(blocks: any[]): string {
  return blocks
    .map(block => extractTextFromBlock(block))
    .filter(text => text.trim())
    .join(' ')
    .substring(0, 100);
}

/**
 * Valida se o conteúdo tem dados suficientes para ser um flashcard
 */
export function isValidFlashcard(parsed: ParsedFlashcard): boolean {
  const frontText = getPreviewText(parsed.front);
  const backText = getPreviewText(parsed.back);
  
  // Deve ter pelo menos algum conteúdo na frente
  if (!frontText.trim()) return false;
  
  // Se tem quote, deve ter conteúdo no verso também
  if (parsed.hasQuote && !backText.trim()) return false;
  
  return true;
}