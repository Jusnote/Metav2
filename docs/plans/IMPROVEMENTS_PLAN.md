# Plano de Melhorias - DocumentsOrganizationPage

## 🎯 Objetivos
Transformar a página em uma ferramenta altamente funcional, eficiente e elegante para gerenciar a hierarquia de estudos (Unidades → Tópicos → Subtópicos).

---

## 📋 Melhorias Planejadas

### **1. UX/UI - Fluidez e Criação Rápida** ⚡

#### 1.1 Substituir `prompt()` por Modais Inline Elegantes
- **Problema**: Uso de `prompt()` nativo quebra fluidez (linhas 442, 463, 485)
- **Solução**:
  - Criar componente `QuickCreateModal` reutilizável
  - Input inline com autofocus + validação visual
  - Suporte a atalhos: `Enter` (salvar), `Esc` (cancelar)
  - Animação suave de entrada/saída

#### 1.2 Melhorar Edição Inline
- **Problema**: InlineEditor funciona mas falta feedback visual claro
- **Solução**:
  - Adicionar placeholder com dicas ("Digite o nome...")
  - Highlight no hover para indicar editabilidade
  - Contador de caracteres visível durante edição

#### 1.3 Drag & Drop para Reorganização
- Adicionar `@dnd-kit/core` para reordenar:
  - Unidades
  - Tópicos dentro de unidades
  - Subtópicos dentro de tópicos
- Persiste ordem no Supabase (`order` column)

---

### **2. Funcionalidades - Produtividade** 🚀

#### 2.1 Ações em Lote (Bulk Actions)
- Checkbox para seleção múltipla
- Barra flutuante com ações:
  - Deletar selecionados
  - Mover para outra unidade/tópico
  - Arquivar (soft delete)

#### 2.2 Busca Global e Filtros
- Input de busca no header da sidebar
- Busca incremental por título (unidade/tópico/subtópico)
- Filtros:
  - Por status (not-started, in-progress, completed)
  - Por data de criação
  - Por último acesso

#### 2.3 Templates Rápidos
- Botão "Criar de Template"
- Templates pré-definidos:
  - "Edital de Concurso" → estrutura típica
  - "Curso Universitário" → semestres/disciplinas
  - "Projeto de Pesquisa" → metodologia padrão
- Permite criar templates customizados

#### 2.4 Atalhos de Teclado
- `Ctrl+N` → Nova unidade
- `Ctrl+T` → Novo tópico (se unidade selecionada)
- `Ctrl+S` → Novo subtópico (se tópico selecionado)
- `Ctrl+E` → Editar item selecionado
- `Del` → Deletar com confirmação
- `/` → Focar busca

---

### **3. Organização e Navegação** 🗂️

#### 3.1 Breadcrumbs no Header do Painel
- Mostrar caminho completo: `Unidade > Tópico > Subtópico`
- Clicável para navegar para níveis superiores
- Botão "Voltar" rápido

#### 3.2 Indicadores Visuais Inteligentes
- **Badges de contagem**:
  - Documentos vinculados (verde)
  - Flashcards vinculados (roxo)
  - Questões vinculadas (laranja)
- **Ícones de progresso**:
  - Barra de progresso micro no subtópico
  - % de completude calculado por materiais

#### 3.3 Favoritos/Pinning
- Estrela para marcar unidades/tópicos favoritos
- Seção "Favoritos" no topo da sidebar
- Persiste no Supabase (`is_favorite` boolean)

#### 3.4 Histórico de Navegação
- "Recentemente acessados" (últimos 5)
- Link rápido para voltar ao último item

---

### **4. Performance e Celeridade** ⚡

#### 4.1 Lazy Loading da Hierarquia
- Carregar subtópicos sob demanda (ao expandir tópico)
- Virtualização da lista com `react-window` para hierarquias grandes (>100 itens)

#### 4.2 Debounce em Operações
- Edição inline com debounce de 500ms antes de salvar
- Reduz chamadas ao Supabase

#### 4.3 Optimistic Updates
- Update local imediato + sync com DB em background
- Rollback visual se falha

#### 4.4 Cache Inteligente
- Cache de contagens (documentos/flashcards/questões) com invalidação
- Refetch apenas quando necessário

---

### **5. Design Elegante** 🎨

#### 5.1 Animações Micro
- Transição suave ao expandir/colapsar (já existe, melhorar)
- Fade in/out nos modais
- Skeleton loading durante fetch

#### 5.2 Estados Vazios com Ilustrações
- Substituir texto simples por ilustrações SVG:
  - "Nenhuma unidade criada" → ilustração + CTA
  - "Subtópico sem materiais" → sugestão visual

#### 5.3 Dark Mode Ready
- Preparar variáveis CSS para tema escuro
- Toggle no header (futuro)

#### 5.4 Densidade Visual Ajustável
- Botão para alternar entre:
  - **Compacto** (atual)
  - **Confortável** (mais espaçamento)
  - **Espaçoso** (para apresentação)

---

### **6. Integração com Materiais** 📚

#### 6.1 Preview Rápido
- Hover card ao passar sobre "Documento/Flashcard/Questões"
- Mostra preview dos últimos 3 itens criados
- Link direto para criar novo

#### 6.2 Contador Dinâmico
- **Problema**: Contadores hardcoded (linhas 747, 761, 775)
- **Solução**:
  - Query real ao Supabase para contar documentos/flashcards/questões
  - Update em tempo real via subscriptions

#### 6.3 Quick Actions no Hover
- Ao passar mouse sobre subtópico:
  - Botão rápido "Criar Documento"
  - Botão rápido "Criar Flashcard"
  - Botão rápido "Criar Questão"

---

### **7. Dados e Análises** 📊

#### 7.1 Dashboard de Progresso
- **Substituir seção "Revisões Práticas"** por:
  - Gráfico de atividade (calendário de calor)
  - Tempo investido (gráfico de barras)
  - Taxa de completude (gauge)

#### 7.2 Estatísticas Consolidadas
- No header do painel ao selecionar unidade:
  - Total de tópicos
  - Total de subtópicos
  - % de subtópicos completos
  - Tempo total investido

#### 7.3 Export/Import
- Exportar hierarquia para JSON/CSV
- Importar estrutura de edital (PDF → parser → hierarquia)

---

## 🔧 Refatorações Técnicas

### 8.1 Componentização
- Extrair componentes:
  - `UnitItem.tsx`
  - `TopicItem.tsx`
  - `SubtopicItem.tsx`
  - `MaterialCard.tsx` (substituir botões de Documento/Flashcard/Questões)

### 8.2 Custom Hooks
- `useHierarchyNavigation()` - gerencia seleção e expansão
- `useKeyboardShortcuts()` - centraliza atalhos
- `useMaterialCounts()` - fetch de contadores

### 8.3 Validações
- Adicionar Zod para validação de títulos
- Limite de caracteres claro
- Prevenir duplicatas de nomes

---

## 📦 Priorização (3 Fases)

### **Fase 1 - Quick Wins** (Impacto alto, esforço baixo)
1. Substituir `prompt()` por modal inline ✅
2. Adicionar busca global ✅
3. Contadores dinâmicos reais ✅
4. Atalhos de teclado ✅
5. Breadcrumbs ✅

### **Fase 2 - Produtividade** (Impacto médio-alto, esforço médio)
1. Drag & Drop ✅
2. Bulk actions ✅
3. Templates rápidos ✅
4. Favoritos/pinning ✅
5. Quick actions no hover ✅

### **Fase 3 - Polimento** (Impacto médio, esforço variável)
1. Dashboard de progresso ✅
2. Export/import ✅
3. Dark mode ✅
4. Densidade ajustável ✅
5. Preview rápido ✅

---

## 💡 Implementação - Começando pela Fase 1

### Item 1: Substituir `prompt()` por Modal Inline

**Arquivos a criar:**
- `src/components/QuickCreateModal.tsx` - Modal reutilizável

**Arquivos a modificar:**
- `src/pages/DocumentsOrganizationPage.tsx` - Substituir chamadas de prompt()

**Comportamento:**
- Modal aparece com fade in suave
- Input com autofocus
- Enter → salva
- Esc → cancela
- Clique fora → cancela
- Validação visual de campo vazio

---

### Item 2: Adicionar Busca Global

**Arquivos a criar:**
- `src/components/HierarchySearch.tsx` - Componente de busca

**Arquivos a modificar:**
- `src/pages/DocumentsOrganizationPage.tsx` - Adicionar input no header da sidebar

**Comportamento:**
- Busca incremental (debounce 300ms)
- Highlight de resultados
- Navegação por setas (↑↓)
- Enter → seleciona resultado
- Mostra caminho completo (Unit > Topic > Subtopic)

---

### Item 3: Contadores Dinâmicos Reais

**Arquivos a criar:**
- `src/hooks/useMaterialCounts.ts` - Hook para contar materiais

**Arquivos a modificar:**
- `src/pages/DocumentsOrganizationPage.tsx` - Usar contadores reais

**Comportamento:**
- Query ao Supabase para contar:
  - Documentos por subtopic_id
  - Flashcards por subtopic_id (quando existir)
  - Questões por subtopic_id (quando existir)
- Cache com React Query
- Update em tempo real via Supabase subscriptions

---

### Item 4: Atalhos de Teclado

**Arquivos a criar:**
- `src/hooks/useKeyboardShortcuts.ts` - Hook para gerenciar atalhos

**Arquivos a modificar:**
- `src/pages/DocumentsOrganizationPage.tsx` - Registrar atalhos

**Atalhos implementados:**
- `Ctrl+N` → Nova unidade
- `Ctrl+T` → Novo tópico (se unidade selecionada)
- `Ctrl+Shift+S` → Novo subtópico (se tópico selecionado)
- `Ctrl+E` → Editar item selecionado
- `Delete` → Deletar com confirmação
- `/` → Focar busca

---

### Item 5: Breadcrumbs

**Arquivos a criar:**
- `src/components/HierarchyBreadcrumbs.tsx` - Componente de breadcrumbs

**Arquivos a modificar:**
- `src/pages/DocumentsOrganizationPage.tsx` - Adicionar breadcrumbs no header do painel

**Comportamento:**
- Mostra caminho: `Unit > Topic > Subtopic`
- Cada item é clicável
- Navegação rápida para níveis superiores
- Ícone de "casa" para voltar à raiz

---

## 🚀 Próximos Passos

Após confirmar este plano, vou:
1. Criar o arquivo `IMPROVEMENTS_PLAN.md` (este documento)
2. Implementar **Fase 1** - item por item
3. Testar cada funcionalidade
4. Aguardar feedback antes de prosseguir para Fase 2
