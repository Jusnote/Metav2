# 🎯 Guia: Como Personalizar Divisores de Flashcards

## 📋 Visão Geral

Este documento explica como alterar o sistema atual de divisores (que usa `quote`) para outros tipos de blocos ou implementar múltiplos divisores personalizáveis.

---

## 🔧 Estrutura Atual

### **Arquivo Principal: `src/lib/flashcard-parser.ts`**

```typescript
// LÓGICA ATUAL - Procura por 'quote'
content.forEach((block, index) => {
  if (block.type === 'quote') {
    back.push(block);
    foundQuote = true;
  } else if (!foundQuote) {
    front.push(block);
  } else {
    back.push(block);
  }
});
```

---

## 🎨 Cenários de Personalização

### **1. Trocar Quote por Outro Bloco Único**

#### **Exemplo: Usar Linha Horizontal**
```typescript
// Alterar em parseFlashcardContent()
if (block.type === 'horizontalRule') {
  back.push(block);
  foundDivider = true;
}
```

#### **Exemplo: Usar Heading Nível 3**
```typescript
if (block.type === 'heading' && block.props.level === 3) {
  // H3 como divisor
  foundDivider = true;
  // Opcional: incluir o H3 no verso ou não
}
```

#### **Exemplo: Usar Bloco de Código**
```typescript
if (block.type === 'codeBlock') {
  back.push(block);
  foundDivider = true;
}
```

---

### **2. Múltiplos Tipos de Divisores**

#### **Implementação Flexível:**
```typescript
// Definir tipos aceitos como divisores
const DIVISOR_TYPES = ['quote', 'horizontalRule', 'codeBlock'];

// Função auxiliar
function isDivider(block) {
  return DIVISOR_TYPES.includes(block.type);
}

// Usar na lógica principal
content.forEach((block, index) => {
  if (isDivider(block)) {
    back.push(block);
    foundDivider = true;
  } else if (!foundDivider) {
    front.push(block);
  } else {
    back.push(block);
  }
});
```

---

### **3. Divisor por Conteúdo/Texto**

#### **Exemplo: Texto Específico**
```typescript
function isTextDivider(block) {
  if (block.type !== 'paragraph') return false;
  
  const text = extractTextFromBlock(block);
  const DIVISOR_TEXTS = ['---RESPOSTA---', '===VERSO===', '***'];
  
  return DIVISOR_TEXTS.some(divider => 
    text.trim().toUpperCase().includes(divider)
  );
}

// Usar na lógica
if (isTextDivider(block)) {
  // Não incluir o divisor de texto no verso
  foundDivider = true;
}
```

---

### **4. Sistema Configurável por Usuário**

#### **A. Criar Configuração**

**Arquivo: `src/types/flashcard-config.ts`**
```typescript
export interface FlashcardConfig {
  dividerType: 'quote' | 'horizontalRule' | 'heading' | 'text' | 'multiple';
  customText?: string;
  headingLevel?: number;
  multipleDividers?: string[];
}

export const DEFAULT_CONFIG: FlashcardConfig = {
  dividerType: 'quote'
};
```

#### **B. Modificar Parser**

```typescript
import { FlashcardConfig, DEFAULT_CONFIG } from '@/types/flashcard-config';

export function parseFlashcardContent(
  content: Block[], 
  config: FlashcardConfig = DEFAULT_CONFIG
): ParsedFlashcardContent {
  
  function isDivider(block: Block): boolean {
    switch (config.dividerType) {
      case 'quote':
        return block.type === 'quote';
        
      case 'horizontalRule':
        return block.type === 'horizontalRule';
        
      case 'heading':
        return block.type === 'heading' && 
               block.props.level === (config.headingLevel || 3);
               
      case 'text':
        return block.type === 'paragraph' && 
               extractTextFromBlock(block).includes(config.customText || '---');
               
      case 'multiple':
        return config.multipleDividers?.includes(block.type) || false;
        
      default:
        return block.type === 'quote';
    }
  }
  
  // Resto da lógica permanece igual...
}
```

#### **C. Interface de Configuração**

**Arquivo: `src/components/FlashcardSettings.tsx`**
```typescript
export default function FlashcardSettings() {
  const [config, setConfig] = useState<FlashcardConfig>(DEFAULT_CONFIG);
  
  return (
    <div className="space-y-4">
      <div>
        <label>Tipo de Divisor:</label>
        <select 
          value={config.dividerType}
          onChange={(e) => setConfig({...config, dividerType: e.target.value})}
        >
          <option value="quote">Quote Block</option>
          <option value="horizontalRule">Linha Horizontal</option>
          <option value="heading">Heading (H1-H6)</option>
          <option value="text">Texto Personalizado</option>
        </select>
      </div>
      
      {config.dividerType === 'heading' && (
        <input 
          type="number" 
          min="1" max="6"
          value={config.headingLevel}
          onChange={(e) => setConfig({...config, headingLevel: +e.target.value})}
        />
      )}
      
      {config.dividerType === 'text' && (
        <input 
          placeholder="Ex: ---RESPOSTA---"
          value={config.customText}
          onChange={(e) => setConfig({...config, customText: e.target.value})}
        />
      )}
    </div>
  );
}
```

---

### **5. Configuração por Deck**

#### **Expandir Modelo de Deck:**
```typescript
// src/types/deck.ts
export interface Deck {
  id: string;
  name: string;
  flashcardConfig?: FlashcardConfig; // Nova propriedade
}
```

#### **Usar Configuração Específica:**
```typescript
// No StudyCardBlockNote.tsx
const parsedContent = React.useMemo(() => {
  const deckConfig = currentDeck?.flashcardConfig || DEFAULT_CONFIG;
  return parseFlashcardContent(content, deckConfig);
}, [content, currentDeck]);
```

---

### **6. Auto-Detecção Inteligente**

```typescript
function autoDetectDivider(content: Block[]): string | null {
  const dividerCounts = {
    quote: 0,
    horizontalRule: 0,
    heading3: 0,
    textDivider: 0
  };
  
  content.forEach(block => {
    if (block.type === 'quote') dividerCounts.quote++;
    if (block.type === 'horizontalRule') dividerCounts.horizontalRule++;
    if (block.type === 'heading' && block.props.level === 3) dividerCounts.heading3++;
    if (isTextDivider(block)) dividerCounts.textDivider++;
  });
  
  // Retornar o tipo mais comum
  const max = Math.max(...Object.values(dividerCounts));
  return Object.keys(dividerCounts).find(key => dividerCounts[key] === max);
}
```

---

## 🔄 Passos para Implementar uma Mudança

### **Mudança Simples (Quote → Outro Bloco):**

1. **Editar `flashcard-parser.ts`:**
   ```typescript
   // Linha ~45 - Trocar condição
   if (block.type === 'NOVO_TIPO') {
   ```

2. **Testar:**
   - Criar flashcard com novo divisor
   - Verificar renderização no estudo

### **Mudança Complexa (Sistema Configurável):**

1. **Criar tipos:** `flashcard-config.ts`
2. **Expandir parser:** Adicionar parâmetro `config`
3. **Atualizar componentes:** Passar configuração
4. **Interface:** Componente de settings
5. **Persistência:** Salvar config no localStorage/banco

---

## 🧪 Testes Recomendados

### **Para Qualquer Mudança:**

```typescript
// test-new-divider.ts
describe('New Divider System', () => {
  test('should parse with horizontalRule', () => {
    const content = [
      { type: 'paragraph', content: [{ text: 'Front' }] },
      { type: 'horizontalRule' },
      { type: 'paragraph', content: [{ text: 'Back' }] }
    ];
    
    const result = parseFlashcardContent(content, { dividerType: 'horizontalRule' });
    
    expect(result.front).toHaveLength(1);
    expect(result.back).toHaveLength(2);
    expect(result.strategy).toBe('horizontal-rule-based');
  });
});
```

---

## 🎯 Conclusão

O sistema atual é **totalmente flexível** e pode ser facilmente adaptado para:

- ✅ **Qualquer tipo de bloco** como divisor
- ✅ **Múltiplos divisores simultâneos**
- ✅ **Configuração por usuário/deck**
- ✅ **Auto-detecção inteligente**
- ✅ **Divisores baseados em texto**

A mudança principal acontece sempre no arquivo `flashcard-parser.ts`, e o resto do sistema (componentes, renderização) **funciona automaticamente** com qualquer divisor escolhido.
