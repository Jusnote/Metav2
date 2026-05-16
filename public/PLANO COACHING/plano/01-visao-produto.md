# 01 — Visão de Produto

## O problema que resolvemos

Concurseiro brasileiro enfrenta um problema estrutural ao começar a estudar:

1. **Edital é documento jurídico-administrativo**, não plano de estudo. Vem flat, sem peso, sem ordem pedagógica, sem distinção entre "cai sempre" e "raramente cai".
2. **Tempo é escassíssimo** — maioria trabalha e estuda. Não pode desperdiçar 1h estudando o que não cai.
3. **Esquecimento é inimigo invisível** — sem repetição espaçada, 70% do conteúdo é esquecido em 30 dias.
4. **Mentoria 1:1 é cara e não escala** — bons mentores cobram R$500-2000/mês.

## Nossa proposta de valor

**"Sua estratégia de aprovação, em forma de software."**

Um sistema que entrega ao aluno três coisas:

1. **Tradução do edital em plano de estudo** com peso, ordem pedagógica e tempo estimado
2. **Cronograma semanal flexível** (modo livre — aluno escolhe a ordem dentro da semana)
3. **Motor de repetição espaçada (FSRS)** que decide automaticamente o que revisar e quando

## Filosofia de produto — princípios não-negociáveis

### 1. Modo livre, não guiado

O sistema **não impõe** "segunda = Penal, terça = Português". O aluno organiza seu próprio ritmo dentro da semana. Sistema **sugere**, não obriga.

**Implicação técnica:** atividades NÃO têm `dia_da_semana` como campo. Têm apenas `semana_id`. A ordenação visual é por bloco temático e prioridade, não cronológica.

### 2. Qualidade > Quantidade

A métrica primária é "% do peso 5 coberto", não "% das atividades concluídas". Aluno que faz 50% das atividades mas todas as importantes está melhor que aluno que faz 100% de tópicos peso 2.

**Implicação técnica:** dashboard tem destaque visual para `qualidade_pct`, não `progresso_pct`.

### 3. Repetição espaçada é lei

Teoria e questões do mesmo tópico **nunca** acontecem na mesma semana. Espaçamento mínimo de 7 dias entre fases do ciclo. FSRS dita o ritmo das revisões.

**Implicação técnica:** algoritmo de composição de semana valida espaçamento antes de criar atividades. Se aluno pedir "fazer questões de X agora" mas teoria foi há 2 dias, sistema avisa pedagogicamente.

### 4. Bússola, não algema

Sistema oferece muita **informação** (peso, tempo desde última vez, próxima revisão, dificuldade) mas pouca **imposição**. Aluno adulto decide.

**Implicação técnica:** cada atividade na UI mostra metadados ricos. Botões de ação são "Sugerir" / "Filtrar" / "Ver", não "Fazer agora obrigatoriamente".

### 5. Admin tem expertise — IA tem velocidade

A IA processa edital em segundos, mas pode errar 20%. O admin/mentor revisa e ajusta esses 20% antes de publicar. Nunca publicar árvore sem revisão humana.

**Implicação técnica:** status `rascunho` → `revisao` → `publicado` no concurso. Aluno só vê concursos com status `publicado`.

### 6. Estado visível, sempre

Estado do aluno (FSRS de cada tópico, atrasos, ritmo) deve ser visível a qualquer momento. Sem "caixa preta" — aluno entende por que aquela revisão apareceu hoje.

**Implicação técnica:** tela "Mapa da Memória" expõe `difficulty`, `stability`, `retrievability` por tópico. Cada atividade sugerida tem tooltip com "Por que essa?".

## Personas

### Admin/Mentor (você, Aldemir)
- Cadastra concursos e edita árvores de conteúdo
- Cria material (Tiptap) e cadastra questões
- Acompanha desempenho dos alunos
- Precisa de velocidade: processar edital de 200 tópicos em < 5min

### Aluno trabalhador (perfil dominante)
- 25-40 anos, trabalha 8h/dia
- Estuda 2-4h/dia em horários fragmentados
- Mobile-first (estuda no transporte público, intervalos)
- Ansioso, busca certeza ("o que estudar hoje?")

### Aluno tempo integral
- Dedicação 6-10h/dia
- Desktop + mobile
- Maturidade pra autogerenciar — exige menos sugestão, mais ferramenta
- Quer dados profundos (estatísticas, projeções)

## Decisões de produto fundamentais

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Cronograma | Modo livre por padrão | Maturidade do público + flexibilidade de rotina |
| FSRS granularidade | Card = subtópico (agregado) | Equilibra precisão e simplicidade |
| Início da memória FSRS | Primeira sessão de questões do tópico | Antes disso não há sinal de aprendizagem real |
| Ciclo pedagógico | Teoria → (7+ dias) → Questões → FSRS | Cientificamente respaldado |
| Bloqueio de semana futura | Sim | Foco no presente, evita procrastinação |
| Modo guiado opcional | Versão futura | MVP só com modo livre |
| Múltiplos concursos por aluno | Versão futura | MVP: 1 concurso ativo por aluno |

## Métricas de sucesso do produto

**Para o aluno (engagement saudável):**
- Atividades/semana entre 15 e 40 (não 95 como vimos no sistema antigo)
- Taxa de conclusão semanal > 60%
- Taxa de acerto média subindo ao longo das semanas
- Aderência à repetição espaçada > 80% (não pula revisões FSRS due)

**Para o negócio:**
- Tempo de onboarding < 5min
- Tempo de processamento de edital pelo admin < 10min
- Retenção mensal > 70%
- NPS > 40

## Anti-features (o que NÃO fazemos)

- **Gamificação infantil:** sem pontos, badges aleatórios, "level up" sem propósito. Modo livre adulto.
- **Notificações invasivas:** sem push pressionando estudo. Só lembrete diário opcional.
- **Comparação social:** sem ranking de alunos visível. Concurseiro já é ansioso.
- **Recomendação opaca:** todo "sugerimos isso" tem botão "por quê?" que explica.
- **Bloqueio de conteúdo pago dentro de pago:** se aluno pagou, vê tudo do concurso dele.

## Decisões em aberto

Estas decisões precisam ser tomadas antes ou durante a implementação:

1. **Multi-tenancy:** o sistema serve só você (Aldemir) como admin ou outros mentores também terão acesso? **Default assumido: single-tenant inicialmente.**
2. **Pricing:** assinatura mensal? Acesso ao concurso vitalício? **Não afeta arquitetura inicial.**
3. **Comunidade:** terá fórum/comunidade de alunos? **Default: não no MVP.**
4. **Mobile app nativo:** ou só PWA? **Default: PWA bem feita, app nativo é V2.**
