# 🔍 AUDITORIA COMPLETA - HOOKS DE DADOS

## 📊 MAPEAMENTO DE HOOKS

### 🚨 HOOKS APENAS localStorage (PROBLEMÁTICOS)
| Hook | Arquivo | Chaves localStorage | Status |
|------|---------|-------------------|--------|
| `useFlashcards` | `src/hooks/useFlashcards.ts` | `flashcards_decks`, `flashcards_cards` | ❌ Obsoleto |
| `useLocalFlashcards` | `src/hooks/useLocalFlashcards.ts` | `flashcards_decks`, `flashcards_cards` | ❌ Obsoleto |

### ✅ HOOKS APENAS Supabase (CORRETOS)
| Hook | Arquivo | Tabela | Status |
|------|---------|--------|--------|
| `useSupabaseFlashcards` | `src/hooks/useSupabaseFlashcards.ts` | `flashcards` | ✅ Bom |
| `useBlockNoteFlashcards` | `src/hooks/useBlockNoteFlashcards.ts` | `flashcards` | ✅ Bom |
| `useDocuments` | `src/hooks/useDocuments.ts` | `documents` | ✅ Bom |
| `useQuestoes` | `src/hooks/useQuestoes.ts` | `questoes` | ✅ Bom |

### 🔄 HOOKS HÍBRIDOS (NECESSITAM REFATORAÇÃO)
| Hook | Arquivo | localStorage + Supabase | Status |
|------|---------|------------------------|--------|
| `useQuickNotes` | `src/hooks/useQuickNotes.ts` | `quick_notes_local` + `quick_notes` | 🔄 Refatorar |
| `useDataMigration` | `src/hooks/useDataMigration.ts` | Migração localStorage → Supabase | 🔄 Temporário |

### 📱 HOOKS UTILITÁRIOS
| Hook | Arquivo | Função | Status |
|------|---------|--------|--------|
| `useUserProgress` | `src/hooks/useUserProgress.ts` | localStorage para progresso | 🔄 Avaliar |
| `useProgressMarkers` | `src/hooks/useProgressMarkers.ts` | localStorage para marcadores | 🔄 Avaliar |

## 🎯 UTILIZAÇÃO NAS PÁGINAS

### Index (/) - Página Principal
- ✅ `useBlockNoteFlashcards` (Supabase)

### NotesPage (/notes) - Notas Rápidas  
- 🔄 `useQuickNotes` (Híbrido - REFATORAR)
- ✅ `useBlockNoteFlashcards` (Supabase)

### DocumentsOrganizationPage - Documentos
- ✅ `useDocuments` (Supabase)
- ✅ `useAutoSave` (Supabase)

### QuestoesPage - Questões
- ✅ `useQuestoes` (Supabase)

### CronogramaPage - Cronograma
- 🔄 `useTimer` (localStorage - AVALIAR)

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. CONFLITO DE FLASHCARDS
- **3 hooks diferentes** para flashcards
- **Dados fragmentados** entre localStorage e Supabase
- **Inconsistência** entre páginas

### 2. QUICK_NOTES COMPLEXO
- **Lógica híbrida** desnecessariamente complexa
- **Queue de sincronização** pode falhar
- **Cache local** usado como fonte de dados

### 3. HOOKS OBSOLETOS
- `useFlashcards` e `useLocalFlashcards` não são mais usados
- **Código morto** ocupando espaço
- **Confusão** para desenvolvedores

## 📋 CHAVES localStorage IDENTIFICADAS

### Dados Críticos (MIGRAR)
- `flashcards_decks` - Decks de flashcards antigos
- `flashcards_cards` - Flashcards antigos  
- `quick_notes_local` - Notas rápidas locais
- `quick_notes_queue` - Queue de sincronização

### Dados de Configuração (MANTER)
- `migration_completed` - Flag de migração
- Configurações de usuário
- Preferências de interface

### Dados Temporários (LIMPAR)
- `flashcard-editor-blocks-*` - Rascunhos de editor
- Cache de componentes
- Estados temporários

## 🎯 PRÓXIMOS PASSOS

1. **Criar hook base** `useServerFirst`
2. **Migrar flashcards** para padrão único
3. **Refatorar quick_notes** para server-first
4. **Limpar hooks obsoletos**
5. **Validar integridade** dos dados
