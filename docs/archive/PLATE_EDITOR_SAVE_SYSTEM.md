# Sistema de Salvamento do Plate Editor

## Visão Geral

Sistema completo de salvamento automático para o Plate Editor, implementado seguindo o padrão **Server-First** do projeto.

## Arquitetura

### 1. **Padrão Server-First**
- **Fonte única de verdade**: Supabase PostgreSQL
- **Cache em memória**: 5 minutos de timeout
- **Updates otimistas**: UI responsiva
- **Fila offline**: Operações sincronizadas quando voltar online
- **Real-time sync**: Via Supabase subscriptions

### 2. **Componentes Principais**

#### Hook `usePlateDocuments`
- Localização: `src/hooks/usePlateDocuments.ts`
- Gerencia operações CRUD de documentos
- Usa `useServerFirst` como base
- Funções principais:
  - `createDocument()` - Criar novo documento
  - `updateDocument()` - Atualizar documento existente
  - `deleteDocument()` - Deletar documento
  - `getDocument()` - Buscar por ID
  - `toggleFavorite()` - Marcar/desmarcar favorito
  - `extractPlainText()` - Extrair texto do JSON do Plate
  - `extractTitle()` - Extrair título do primeiro heading

#### Hook `useAutoSavePlateDocument`
- Localização: `src/hooks/usePlateDocuments.ts`
- Auto-save inteligente com debounce
- Gerencia estado de salvamento
- Funções principais:
  - `saveNow()` - Salvar imediatamente
  - `saveWithDebounce()` - Salvar com debounce (500ms padrão)
  - `createNew()` - Criar novo documento
  - Estado: `saveStatus` (idle/saving/saved/error)

#### Componente `SaveIndicator`
- Localização: `src/components/ui/save-indicator.tsx`
- Indicador visual do status de salvamento
- Variantes:
  - `SaveIndicator` - Versão completa (ícone + texto)
  - `SaveIndicatorCompact` - Apenas ícone
- Estados visuais:
  - **Idle**: Nuvem cinza - "Sincronizado"
  - **Saving**: Spinner azul animado - "Salvando..."
  - **Saved**: Check verde - "Salvo" (2 segundos)
  - **Error**: X vermelho - "Erro ao salvar"

## Fluxo de Funcionamento

### Criação de Novo Documento
1. Usuário começa a digitar no editor
2. Após 500ms de inatividade, sistema detecta falta de documentId
3. `createNew()` é chamado automaticamente
4. Documento criado no Supabase
5. ID retornado e URL atualizada (`?doc={id}`)
6. Indicador mostra "Salvo"

### Salvamento Automático
1. Usuário edita conteúdo existente
2. Hook detecta mudança via `editor.children`
3. Debounce de 500ms aguarda inatividade
4. `saveWithDebounce()` envia update para Supabase
5. Indicador mostra "Salvando..." → "Salvo"
6. Cache atualizado automaticamente

### Carregamento de Documento
1. URL contém `?doc={id}`
2. `documentId` passado para `PlateEditor`
3. `useAutoSavePlateDocument` carrega via `getDocument()`
4. Conteúdo JSON carregado no editor
5. Auto-save ativado para futuras mudanças

## Estrutura de Dados

### Tabela `documents` (Supabase)
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL DEFAULT 'Documento sem título',
  content JSONB DEFAULT '{}',
  content_text TEXT,  -- Para busca full-text
  is_favorite BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  subtopic_id UUID REFERENCES subtopics(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tipo `PlateDocument`
```typescript
interface PlateDocument {
  id: string;
  user_id: string;
  title: string;
  content: any[];  // JSON do Plate
  content_text?: string;
  is_favorite?: boolean;
  tags?: string[];
  subtopic_id?: string;
  created_at: string;
  updated_at: string;
}
```

## Uso nos Componentes

### PlateEditorPage
```tsx
import PlateEditorPage from '@/components/pages/PlateEditorPage';

// Novo documento
<PlateEditorPage />

// Documento específico via URL
// /plate-editor?doc={uuid}
```

### PlateEditor (Props)
```tsx
<PlateEditor
  documentId={currentDocId}
  onDocumentCreate={(newId) => {
    // Callback quando novo documento é criado
    console.log('Documento criado:', newId);
  }}
/>
```

### Hooks Personalizados
```tsx
// Em qualquer componente
import { usePlateDocuments } from '@/hooks/usePlateDocuments';

function MyComponent() {
  const {
    documents,           // Todos os documentos
    isLoading,           // Estado de carregamento
    createDocument,      // Criar
    updateDocument,      // Atualizar
    deleteDocument,      // Deletar
  } = usePlateDocuments();

  // Usar funções conforme necessário
}
```

## Features Implementadas

✅ **Auto-save com debounce** (500ms)
✅ **Indicador visual de status**
✅ **Criação automática de documento**
✅ **Extração automática de título**
✅ **Sincronização em tempo real**
✅ **Cache em memória**
✅ **Fila offline**
✅ **Updates otimistas**
✅ **Busca por texto plano**
✅ **Sistema de favoritos**
✅ **Tags**
✅ **Vinculação com subtópicos**

## Melhorias Futuras

- [ ] Histórico de versões (undo/redo persistido)
- [ ] Colaboração em tempo real (múltiplos usuários)
- [ ] Backup automático local (IndexedDB)
- [ ] Exportação para PDF/Markdown
- [ ] Templates de documentos
- [ ] Compartilhamento de documentos

## Configuração

### Variáveis de Ambiente
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Policies do Supabase (RLS)
As policies já estão configuradas na migration:
- Usuários podem ver apenas seus próprios documentos
- Usuários podem criar documentos
- Usuários podem atualizar seus documentos
- Usuários podem deletar seus documentos

## Troubleshooting

### Documento não salva
1. Verificar se usuário está autenticado
2. Verificar console do navegador para erros
3. Verificar conexão com Supabase
4. Verificar RLS policies

### Indicador fica em "Salvando..."
1. Verificar console para erros de rede
2. Verificar se Supabase está acessível
3. Verificar se documentId é válido

### Conteúdo não carrega
1. Verificar se `documentId` na URL é válido
2. Verificar se documento pertence ao usuário logado
3. Verificar estrutura do JSON no banco

## Referências

- [Plate Editor Docs](https://platejs.org)
- [Supabase Docs](https://supabase.com/docs)
- [useServerFirst Pattern](./CLAUDE.md)
