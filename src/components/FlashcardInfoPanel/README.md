# FlashcardInfoPanel - Estrutura Modular

Este diretório contém a implementação modular do componente `FlashcardInfoPanel`, que exibe informações visuais sobre flashcards com dados do algoritmo FSRS.

## Estrutura dos Arquivos

### `config.ts`
Centraliza todas as configurações das tags/ícones:
- **Cores dinâmicas**: Baseadas em valores FSRS (dificuldade, estabilidade, etc.)
- **Ícones**: Mapeamento de tipos e estados para ícones Lucide
- **Textos**: Traduções e descrições em português
- **Prioridades**: Ordem de exibição das tags
- **Condições de visibilidade**: Quando cada tag deve aparecer

### `Tag.tsx`
Componente reutilizável para renderizar cada tag:
- Aplica cores dinâmicas baseadas na configuração
- Gerencia tooltips informativos
- Controla visibilidade condicional
- Mantém consistência visual

### `FlashcardInfoPanel.tsx` (Principal)
Componente principal simplificado:
- Filtra tags visíveis baseado nas condições
- Ordena tags por prioridade
- Renderiza usando o componente `Tag`

## Tags Disponíveis

| Tag | Ícone | Descrição | Condição |
|-----|-------|-----------|----------|
| **Tipo** | Brain/EyeOff/CheckCircle | Tipo do flashcard | Sempre |
| **Estado** | Zap/Clock/Target/RotateCcw | Estado FSRS atual | Sempre |
| **Dificuldade** | AlertCircle | Dificuldade FSRS (0-10) | Sempre |
| **Estabilidade** | TrendingUp | Estabilidade FSRS (dias) | Sempre |
| **Próxima Revisão** | Calendar | Dias até próxima revisão | Sempre |
| **Nível Hierárquico** | Layers | Nível na hierarquia | Se tem pais/filhos |
| **Sub-flashcards** | GitBranch | Quantidade de filhos | Se tem filhos |
| **Contador de Revisões** | Hash | Total de revisões | Sempre |
| **Resposta Visível** | Eye | Indicador de resposta | Se showAnswer=true |

## Cores Dinâmicas

### Dificuldade FSRS
- 🟢 **Verde** (0-3): Fácil
- 🟡 **Amarelo** (3-6): Médio
- 🟠 **Laranja** (6-8): Difícil
- 🔴 **Vermelho** (8-10): Muito difícil

### Estabilidade FSRS
- 🔴 **Vermelho** (<1 dia): Muito instável
- 🟠 **Laranja** (1-7 dias): Instável
- 🟡 **Amarelo** (7-30 dias): Moderado
- 🟢 **Verde** (>30 dias): Estável

### Estados FSRS
- 🔵 **Azul**: Novo (State 0)
- 🟡 **Amarelo**: Aprendendo (State 1)
- 🟢 **Verde**: Revisão (State 2)
- 🟠 **Laranja**: Reaprendendo (State 3)

## Vantagens da Estrutura Modular

1. **Manutenibilidade**: Configurações centralizadas facilitam mudanças
2. **Reutilização**: Componente `Tag` pode ser usado em outros contextos
3. **Extensibilidade**: Fácil adicionar novas tags ou modificar existentes
4. **Testabilidade**: Componentes menores são mais fáceis de testar
5. **Performance**: Renderização otimizada com filtragem inteligente
6. **Legibilidade**: Código mais limpo e organizado

## Como Adicionar Nova Tag

1. **Adicione configuração em `config.ts`**:
```typescript
{
  id: 'nova-tag',
  priority: 100,
  icon: NovoIcone,
  getColor: (card) => 'text-blue-600 bg-blue-50',
  getTooltip: (card) => `Nova informação: ${card.novoValor}`,
  shouldShow: (card, props) => card.novoValor !== undefined
}
```

2. **A tag aparecerá automaticamente** no painel seguindo a prioridade definida.

## Personalização

- **Cores**: Modifique as funções `getColor` em `config.ts`
- **Ícones**: Troque os ícones importados do Lucide React
- **Tooltips**: Ajuste as funções `getTooltip` para diferentes textos
- **Visibilidade**: Modifique as condições `shouldShow`
- **Ordem**: Ajuste os valores de `priority`