# PRD - Flashcard Scribe Flow

## 📋 Visão Geral do Produto

### Nome do Produto
**Flashcard Scribe Flow** - Sistema Inteligente de Flashcards com Repetição Espaçada

### Descrição
Uma aplicação web moderna para criação, gerenciamento e estudo de flashcards com sistema de repetição espaçada baseado no algoritmo FSRS (Free Spaced Repetition Scheduler). O sistema oferece múltiplos tipos de flashcards, editor de texto rico e análise de progresso de estudos.

### Público-Alvo
- Estudantes universitários e de cursos preparatórios
- Profissionais em processo de certificação
- Pessoas aprendendo novos idiomas
- Qualquer pessoa que deseje otimizar seu processo de memorização

---

## 🎯 Objetivos do Produto

### Objetivo Principal
Fornecer uma plataforma completa e intuitiva para criação e estudo de flashcards com algoritmo científico de repetição espaçada, maximizando a eficiência do aprendizado.

### Objetivos Secundários
- Simplificar o processo de criação de flashcards com editores ricos
- Oferecer múltiplos formatos de flashcards para diferentes tipos de conteúdo
- Fornecer análises detalhadas de progresso de estudos
- Permitir organização hierárquica de conteúdo
- Integrar sistema de notas com conversão automática para flashcards

---

## 🚀 Funcionalidades Principais

### 1. Sistema de Autenticação
- **Login/Registro** com Supabase Auth
- **Perfil de usuário** com avatar personalizado
- **Sessões persistentes** entre dispositivos

### 2. Criação de Flashcards

#### 2.1 Tipos de Flashcards
- **Tradicionais**: Frente e verso simples
- **Quote-Based**: Separação automática por blocos de citação
- **Word-Hiding**: Ocultação de palavras específicas com sintaxe `{{palavra}}`
- **Verdadeiro/Falso**: Com explicações opcionais

#### 2.2 Editores de Conteúdo
- **BlockNote Editor**: Editor rico com blocos (headings, parágrafos, listas, quotes)
- **Lexical Editor**: Editor avançado com formatação rica
- **Editor Inline**: Para edições rápidas
- **Suporte a imagens** e formatação avançada

### 3. Sistema de Estudo

#### 3.1 Algoritmo FSRS
- **Repetição espaçada científica** baseada no algoritmo FSRS
- **4 níveis de dificuldade**: Again, Hard, Medium, Easy
- **Cálculo automático** de próximas revisões
- **Estados de aprendizado**: New, Learning, Review, Relearning

#### 3.2 Interface de Estudo
- **Timer integrado** para controle de tempo
- **Estatísticas em tempo real** durante o estudo
- **Modo de estudo focado** sem distrações
- **Feedback visual** para respostas

### 4. Organização de Conteúdo

#### 4.1 Sistema de Decks
- **Criação de decks** temáticos
- **Cores personalizáveis** para organização visual
- **Estatísticas por deck** (total de cards, cards devidos)

#### 4.2 Hierarquia de Flashcards
- **Flashcards pai/filho** para conteúdo relacionado
- **Navegação hierárquica** durante o estudo
- **Organização por níveis** e ordem

### 5. Sistema de Notas
- **Editor de notas** integrado com BlockNote
- **Conversão automática** de notas para flashcards
- **Timeline de notas** com histórico
- **Vinculação** entre notas e flashcards

### 6. Análise e Estatísticas

#### 6.1 Métricas de Desempenho
- **Taxa de acerto** por período
- **Tempo médio** de resposta
- **Progresso de aprendizado** por deck
- **Calendário de estudos** com streak tracking

#### 6.2 Visualizações
- **Gráficos de progresso** temporal
- **Heatmap de atividade** de estudos
- **Distribuição de dificuldade** dos cards
- **Estatísticas FSRS** detalhadas

---

## 🛠 Especificações Técnicas

### Arquitetura
- **Frontend**: Next.js 14 com React 18 e TypeScript
- **Styling**: Tailwind CSS + Radix UI components
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Algoritmo**: ts-fsrs para repetição espaçada
- **Editores**: BlockNote + Lexical

### Estrutura de Dados

#### Flashcard
```typescript
interface Flashcard {
  id: string;
  front: string | any[]; // Suporte a conteúdo rico
  back: string | any[];
  deckId: string;
  type: 'traditional' | 'word-hiding' | 'true-false';
  
  // FSRS fields
  difficulty: number;
  stability: number;
  state: State;
  due: Date;
  review_count: number;
  
  // Hierarchy
  parentId?: string;
  childIds: string[];
  level: number;
  order: number;
}
```

#### Deck
```typescript
interface Deck {
  id: string;
  name: string;
  description?: string;
  color: string;
  cardCount: number;
}
```

---

## 🎨 Design e UX

### Princípios de Design
- **Minimalismo**: Interface limpa focada no conteúdo
- **Responsividade**: Funciona perfeitamente em mobile e desktop
- **Acessibilidade**: Suporte a leitores de tela e navegação por teclado
- **Consistência**: Design system baseado em Radix UI

### Fluxos Principais

#### Fluxo de Criação
1. Usuário acessa página de notas
2. Cria conteúdo usando editor rico
3. Converte nota para flashcard com um clique
4. Sistema automaticamente detecta tipo e estrutura

#### Fluxo de Estudo
1. Usuário inicia sessão de estudo
2. Sistema apresenta cards devidos baseado em FSRS
3. Usuário responde e avalia dificuldade
4. Sistema atualiza algoritmo e agenda próxima revisão

---

## 📊 Métricas de Sucesso

### KPIs Principais
- **Retenção de usuários**: % de usuários ativos após 30 dias
- **Engagement**: Sessões de estudo por usuário por semana
- **Eficácia**: Taxa de acerto em revisões
- **Crescimento**: Número de flashcards criados por usuário

### Métricas Secundárias
- **Tempo médio** de sessão de estudo
- **Frequência de uso** dos diferentes tipos de flashcard
- **Taxa de conversão** de notas para flashcards
- **Satisfação do usuário** (NPS)

---

## 🚦 Roadmap de Desenvolvimento

### Fase 1 - MVP ✅ (Concluída)
- [x] Sistema de autenticação
- [x] CRUD básico de flashcards
- [x] Algoritmo FSRS implementado
- [x] Interface de estudo básica

### Fase 2 - Editores Ricos ✅ (Concluída)
- [x] Integração BlockNote
- [x] Sistema de quote-based flashcards
- [x] Editor de word-hiding
- [x] Flashcards verdadeiro/falso

### Fase 3 - Organização e Análise ✅ (Concluída)
- [x] Sistema de decks
- [x] Hierarquia de flashcards
- [x] Estatísticas detalhadas
- [x] Sistema de notas integrado

### Fase 4 - Melhorias e Otimizações (Em Desenvolvimento)
- [ ] Modo offline
- [ ] Sincronização entre dispositivos
- [ ] Exportação/importação (Anki, CSV)
- [ ] Gamificação (streaks, achievements)

### Fase 5 - Recursos Avançados (Planejado)
- [ ] Colaboração em decks
- [ ] Marketplace de flashcards
- [ ] IA para sugestão de conteúdo
- [ ] Integração com calendários

---

## 🔒 Considerações de Segurança

### Autenticação e Autorização
- **JWT tokens** gerenciados pelo Supabase
- **Row Level Security (RLS)** no banco de dados
- **Validação de entrada** em todos os endpoints
- **Rate limiting** para prevenir abuso

### Privacidade de Dados
- **Dados pessoais** criptografados em trânsito e em repouso
- **LGPD compliance** com opções de exportação e exclusão
- **Logs de auditoria** para ações sensíveis

---

## 🌐 Considerações de Performance

### Otimizações Implementadas
- **Lazy loading** de componentes pesados
- **Memoização** de cálculos FSRS
- **Paginação** de listas grandes
- **Cache** de queries frequentes

### Monitoramento
- **Core Web Vitals** tracking
- **Error monitoring** com Sentry
- **Performance metrics** customizadas
- **Database query optimization**

---

## 📱 Compatibilidade

### Navegadores Suportados
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Dispositivos
- **Desktop**: Windows, macOS, Linux
- **Mobile**: iOS 14+, Android 8+
- **Tablet**: iPad, Android tablets

---

## 🎓 Casos de Uso

### Estudante de Medicina
- Cria flashcards de anatomia com imagens
- Usa word-hiding para termos técnicos
- Estuda diariamente seguindo algoritmo FSRS
- Acompanha progresso por matéria

### Aprendiz de Idiomas
- Flashcards tradicionais para vocabulário
- Quote-based para diálogos e contexto
- Hierarquia para temas relacionados
- Estatísticas de retenção por categoria

### Profissional em Certificação
- Converte notas de estudo em flashcards
- Usa verdadeiro/falso para conceitos
- Organiza por módulos do curso
- Foca revisão em áreas de dificuldade

---

## 📞 Suporte e Manutenção

### Documentação
- **Guia do usuário** completo
- **API documentation** para desenvolvedores
- **Troubleshooting** comum
- **Video tutorials** para recursos principais

### Canais de Suporte
- **Help center** integrado na aplicação
- **Email support** para questões técnicas
- **Community forum** para discussões
- **Bug reporting** system

---

## 📈 Análise Competitiva

### Principais Concorrentes
- **Anki**: Mais complexo, interface datada
- **Quizlet**: Foco em flashcards simples
- **RemNote**: Foco em notas, flashcards secundários

### Diferenciais Competitivos
- **Interface moderna** e intuitiva
- **Editores ricos** integrados
- **Algoritmo FSRS** mais eficiente que SM-2
- **Sistema de notas** integrado
- **Múltiplos tipos** de flashcard

---

## 💰 Modelo de Negócio

### Versão Atual (Gratuita)
- Todas as funcionalidades básicas
- Limite de flashcards por usuário
- Suporte comunitário

### Planos Futuros
- **Premium**: Flashcards ilimitados, estatísticas avançadas
- **Pro**: Colaboração, exportação, suporte prioritário
- **Enterprise**: White-label, SSO, analytics avançados

---

*Documento criado em: Janeiro 2025*  
*Versão: 1.0*  
*Status: Produto em Produção*