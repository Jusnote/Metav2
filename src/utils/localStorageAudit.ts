/**
 * Utilitário para auditar dados existentes no localStorage
 * Usado para identificar dados que precisam ser migrados
 */

export interface LocalStorageAuditResult {
  totalKeys: number;
  dataKeys: LocalStorageDataKey[];
  configKeys: string[];
  tempKeys: string[];
  totalSize: number;
  recommendations: string[];
}

export interface LocalStorageDataKey {
  key: string;
  type: 'flashcards' | 'notes' | 'documents' | 'progress' | 'other';
  size: number;
  itemCount: number;
  lastModified?: Date;
  needsMigration: boolean;
  description: string;
}

// Mapeamento de chaves conhecidas
const KNOWN_DATA_KEYS = {
  // Flashcards (MIGRAR)
  'flashcards_decks': {
    type: 'flashcards' as const,
    needsMigration: true,
    description: 'Decks de flashcards antigos'
  },
  'flashcards_cards': {
    type: 'flashcards' as const,
    needsMigration: true,
    description: 'Flashcards antigos'
  },
  
  // Notes (MIGRAR)
  'quick_notes_local': {
    type: 'notes' as const,
    needsMigration: true,
    description: 'Notas rápidas locais'
  },
  'quick_notes_queue': {
    type: 'notes' as const,
    needsMigration: false, // Queue será recriada
    description: 'Queue de sincronização de notas'
  },
  
  // Progress (AVALIAR)
  'user_progress': {
    type: 'progress' as const,
    needsMigration: false,
    description: 'Progresso do usuário'
  },
  'progress_markers': {
    type: 'progress' as const,
    needsMigration: false,
    description: 'Marcadores de progresso'
  },
  
  // Migration
  'migration_completed': {
    type: 'other' as const,
    needsMigration: false,
    description: 'Flag de migração concluída'
  }
};

// Padrões para chaves temporárias
const TEMP_KEY_PATTERNS = [
  /^flashcard-editor-blocks-/,
  /^temp_/,
  /^cache_/,
  /^draft_/
];

/**
 * Audita todos os dados no localStorage
 */
export function auditLocalStorage(): LocalStorageAuditResult {
  const result: LocalStorageAuditResult = {
    totalKeys: 0,
    dataKeys: [],
    configKeys: [],
    tempKeys: [],
    totalSize: 0,
    recommendations: []
  };

  // Iterar por todas as chaves
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    result.totalKeys++;
    const value = localStorage.getItem(key);
    const size = new Blob([value || '']).size;
    result.totalSize += size;

    // Classificar chave
    if (KNOWN_DATA_KEYS[key as keyof typeof KNOWN_DATA_KEYS]) {
      const config = KNOWN_DATA_KEYS[key as keyof typeof KNOWN_DATA_KEYS];
      const dataKey = analyzeDataKey(key, value, size, config);
      result.dataKeys.push(dataKey);
    } else if (TEMP_KEY_PATTERNS.some(pattern => pattern.test(key))) {
      result.tempKeys.push(key);
    } else {
      result.configKeys.push(key);
    }
  }

  // Gerar recomendações
  result.recommendations = generateRecommendations(result);

  return result;
}

/**
 * Analisa uma chave de dados específica
 */
function analyzeDataKey(
  key: string, 
  value: string | null, 
  size: number, 
  config: typeof KNOWN_DATA_KEYS[keyof typeof KNOWN_DATA_KEYS]
): LocalStorageDataKey {
  let itemCount = 0;
  let lastModified: Date | undefined;

  if (value) {
    try {
      const parsed = JSON.parse(value);
      
      if (Array.isArray(parsed)) {
        itemCount = parsed.length;
        
        // Tentar extrair data de modificação
        const withDates = parsed.filter(item => 
          item && (item.created_at || item.createdAt || item.updated_at || item.updatedAt)
        );
        
        if (withDates.length > 0) {
          const dates = withDates.map(item => 
            new Date(item.updated_at || item.updatedAt || item.created_at || item.createdAt)
          ).filter(date => !isNaN(date.getTime()));
          
          if (dates.length > 0) {
            lastModified = new Date(Math.max(...dates.map(d => d.getTime())));
          }
        }
      } else if (typeof parsed === 'object') {
        itemCount = 1;
      }
    } catch (error) {
      // Não é JSON válido
      itemCount = value.length > 0 ? 1 : 0;
    }
  }

  return {
    key,
    type: config.type,
    size,
    itemCount,
    lastModified,
    needsMigration: config.needsMigration,
    description: config.description
  };
}

/**
 * Gera recomendações baseadas na auditoria
 */
function generateRecommendations(audit: LocalStorageAuditResult): string[] {
  const recommendations: string[] = [];

  // Verificar dados que precisam de migração
  const migrationNeeded = audit.dataKeys.filter(key => key.needsMigration && key.itemCount > 0);
  if (migrationNeeded.length > 0) {
    recommendations.push(
      `🚨 MIGRAÇÃO NECESSÁRIA: ${migrationNeeded.length} tipos de dados precisam ser migrados para Supabase`
    );
    
    migrationNeeded.forEach(key => {
      recommendations.push(
        `  • ${key.key}: ${key.itemCount} itens (${formatBytes(key.size)})`
      );
    });
  }

  // Verificar chaves temporárias para limpeza
  if (audit.tempKeys.length > 0) {
    const tempSize = audit.tempKeys.reduce((total, key) => {
      const value = localStorage.getItem(key);
      return total + new Blob([value || '']).size;
    }, 0);
    
    recommendations.push(
      `🧹 LIMPEZA: ${audit.tempKeys.length} chaves temporárias podem ser removidas (${formatBytes(tempSize)})`
    );
  }

  // Verificar tamanho total
  if (audit.totalSize > 5 * 1024 * 1024) { // 5MB
    recommendations.push(
      `⚠️ TAMANHO: localStorage está usando ${formatBytes(audit.totalSize)} (considere limpeza)`
    );
  }

  // Verificar dados antigos
  const oldData = audit.dataKeys.filter(key => {
    if (!key.lastModified) return false;
    const daysSinceModified = (Date.now() - key.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceModified > 30; // Mais de 30 dias
  });

  if (oldData.length > 0) {
    recommendations.push(
      `📅 DADOS ANTIGOS: ${oldData.length} tipos de dados não são modificados há mais de 30 dias`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ localStorage está limpo e organizado');
  }

  return recommendations;
}

/**
 * Formata bytes em formato legível
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Exporta dados do localStorage para backup
 */
export function exportLocalStorageData(): { [key: string]: any } {
  const backup: { [key: string]: any } = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    const value = localStorage.getItem(key);
    try {
      backup[key] = JSON.parse(value || '');
    } catch {
      backup[key] = value;
    }
  }
  
  return backup;
}

/**
 * Limpa chaves temporárias do localStorage
 */
export function cleanupTempKeys(): number {
  let cleaned = 0;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    if (TEMP_KEY_PATTERNS.some(pattern => pattern.test(key))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    cleaned++;
  });
  
  return cleaned;
}

/**
 * Verifica se há dados que precisam de migração
 */
export function hasPendingMigration(): boolean {
  const audit = auditLocalStorage();
  return audit.dataKeys.some(key => key.needsMigration && key.itemCount > 0);
}
