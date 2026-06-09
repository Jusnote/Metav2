# Grifo WOW — Visão de Produto (re-análise 2026-06-09)

> Origem: workflow multi-lente (ciência do aprendizado, mercado BR, produto/UX, inovação) sobre o código real + advogado do diabo (32 ideias → 23 sobreviventes) + síntese.

## Visão

O Metav2 deixa de ser um banco de 3,2M de questões e vira o app onde ERRAR ensina: a IA acende, no trecho exato do enunciado, a armadilha que derrubou o aluno (ninguém no Brasil ancora a explicação no texto), cada grifo vira memória agendada por FSRS sem digitar nada, e o histórico de erros vira autoconhecimento (calibração de confiança, reincidência por tipo de armadilha, radar da banca). Frase de venda pro concurseiro: "A banca tem um padrão pra te derrubar — aqui você vê esse padrão aceso no texto da questão, e nunca cai duas vezes na mesma pegadinha."

## Killer Moves

### Raio-X da Pegadinha (produto-herói): errou → a armadilha acende no texto, na hora — [M]

**Pitch:** Você responde, erra, e a questão acende em vermelho o trecho exato que te enganou — com 'o erro → a verdade → o artigo' ancorado ali, como um professor particular riscando a sua prova ao vivo. Gran e TEC jogam um texto genérico embaixo da questão; aqui a explicação mora no trecho que te derrubou. E com um toque você guarda a pegadinha pra nunca mais cair nela.

**Como:** Funde 3 ideias aprovadas (Raio-X #killer + Pós-erro inteligente + prefetch/gate encenado, que o advogado do diabo mandou unificar). Backend pronto em D:\meta novo\Metav2\src\server\grifos\extract-grifos.ts + rota src/app/api/ai/extract-grifos/route.ts + cache question_grifos_cache com guard anti-alucinação. Front reusa quase 100% a engine de overlay/ancoragem TextQuote de src\components\questoes\highlights\ (HighlightLayer, resolveAnchor). Regras do veredito: botão 'Professor' só aparece PÓS-resposta (gate anti-spoiler); prefetch disparado no handleResponder (QuestionCard.tsx ~linha 726) apenas quando errou ou em cache-hit — nunca em toda resposta (bomba de custo Opus); revelação encenada com stagger ~200ms reusando o padrão qc-reveal-* já existente no card; se errou, CTA 'Ver onde a banca te pegou →' + botão de 1 toque 'Guardar essa pegadinha' que cria question_highlight tipo pegadinha com o tooltip do professor como nota.

### Caderno de Erros que se escreve sozinho (grifo → flashcard FSRS em 1 clique + Caderno inteligente) — [M]

**Pitch:** O caderno de erros é a técnica mais viral do TikTok concurseiro — e o aluno passa horas copiando à mão. Aqui ele se auto-escreve: qualquer grifo (seu ou do professor) vira flashcard com 1 clique, já etiquetado por matéria e agendado por repetição espaçada. E o Caderno não é uma lista burra: ele te diz quais marcas revisar HOJE, priorizadas pelo que vence no FSRS e pelo que mais cai no seu concurso.

**Como:** Funde o killer 'Pegadinha vira Flashcard' (maior ratio impacto/esforço: flashcards+FSRS já existem em src/lib/fsrs.ts e ts-fsrs) com o Caderno inteligente (solid) e absorve os weak como modos OPT-IN: botão 'Virar flashcard' no HighlightBalloon.tsx (frente = enunciado com trecho em lacuna; verso = tooltip do Opus ou nota do aluno; tag via taxonomia própria); Caderno = o drawer já pendente, agrupado por matéria (taxonomia), ordenado por due FSRS + incidência + histórico de erro, com deep-link pra questão com o grifo aceso; modo 'Teste-me' (nota oculta, Lembrei/Não lembrei alimenta o FSRS) como toggle, NUNCA default (veredito: default pune a consulta rápida); matrícula FSRS sempre opt-in, nunca automática (veredito: avalanche de revisões = trauma-Anki). Cortar export PDF do v1.

### Metacognição que ninguém mede: calibração de confiança + 'Caiu de novo?' + Simulado dos Pontos Fracos — [S → L (incremental)]

**Pitch:** Nenhum app do mercado te diz QUANDO confiar em você mesmo — e em prova CESPE certo/errado isso vale pontos diretos. 'Confiante: 85% de acerto. Na dúvida: 42%.' Depois, o app te mostra o padrão do seu erro ('3ª vez que você cai em troca de conceito em Dir. Administrativo') e monta o simulado feito sob medida pra atacar exatamente isso.

**Como:** Três camadas em sequência de custo. (1) Calibração [veredito: killer, effort S]: naDuvida e acertou já computados no QuestionCard.tsx (~linha 1191) — acerto-na-dúvida em questão marcada vira rating Hard no FSRS da marca; painel 'Confiante vs Na dúvida' por tema via taxonomia. (2) 'Caiu de novo?' [solid]: cruza tipo_armadilha do question_grifos_cache com histórico de respostas + ramo da taxonomia → toast-insight de reincidência + painel 'Minhas Armadilhas' com curva de evolução; pré-requisitos do veredito: normalizar tipo_armadilha em enum (texto livre do Opus deriva) e cache denso (depende do pré-aquecimento batch). (3) Núcleo da Nêmesis [extraído do veredito weak]: 'Simulado dos Seus Pontos Fracos' = preset de filtro S (tópicos de alta incidência no cargo × baixo % de acerto seu × tipos de armadilha onde você reincide) — sem avatar, sem teatro XL.

### Caça-Pegadinha + Radar da Banca: o fosso de dados que vira máquina de PR — [L]

**Pitch:** Modo Caça: ANTES de responder, o desafio é grifar onde você acha que está a armadilha — ao responder, o grifo da IA vira o gabarito e te diz se você tem 'olho de prova'. E o Radar da Banca entrega o que nenhum cursinho tem: 'A FGV em Dir. Administrativo usa 41% troca-de-prazo, 23% inversão regra/exceção' — com 3 questões reais de exemplo, armadilha acesa. É o print que viraliza em grupo de Telegram.

**Como:** Fase final, destravada pelo pré-aquecimento batch (grifos pré-gerados por incidência, com teto de custo explícito — veredito). Caça-Pegadinha [solid]: MarkableBlock/SelectionToolbar + âncoras TextQuote já prontos; comparação aluno×Opus por overlap de quote (indexOf nos dois lados); inclui o confronto passivo 'Você marcou 2 das 3 pegadinhas' e a métrica '% de pegadinhas que você enxerga'; cortar ranking/duelo social (enfeite, per veredito). Radar [solid, sequenciar tarde]: agregação question_grifos_cache.tipo_armadilha (já em enum, da aposta 3) por banca × ramo da taxonomia; só publicar percentuais com cache denso — sem isso é pseudo-precisão. Pré-requisito comercial: Raio-X provado primeiro (qualidade do gabarito Opus em escala).

## Quick Wins

- **Cores com significado: 1 clique = marca pronta** [S] — SelectionToolbar vira 6 chips semânticos (Pegadinha vermelho, Palavra-chave amarelo, Cuidado laranja, Sacada verde, Revisar azul, Comum neutro) — tipo+cor canônicos num clique, balão abre direto na nota. MARK_TYPES e COLORS já existem em src\components\questoes\highlights\highlights.config.ts; vira um mapa type→color, zero mudança de schema. Cria o código visual que Caderno, Radar e Caça precisam pra serem legíveis.
- **Undo de remoção + atalhos de marcação** [S] — Prioridade no undo (buraco real: remover marca é destrutivo instantâneo) — toast 'Marca removida · Desfazer' reinserindo o Highlight completo que já está em memória. Bônus: teclas 1-5 criam marca do chip correspondente com a toolbar aberta, G = grifo comum, Esc cancela, Ctrl+Enter salva no balão. Infra de atalhos já existe no handleGlobalKey do QuestionCard.tsx (linhas ~753-783).
- **Descoberta e onboarding do grifo** [S] — A feature mais forte do card é invisível: (1) item 'selecione o texto pra grifar' na fileira de dicas (QuestionCard.tsx ~981-1004, 1 linha de JSX); (2) coach mark de primeira vez com animação de grifo + flag em localStorage; (3) gatilho após 3 erros seguidos sem marca. Veto do veredito: NÃO publicar o claim 'quem grifa erra menos' sem dado próprio.
- **'Na dúvida' vira rating Hard (camada 1 da calibração)** [S] — naDuvida já é computado no QuestionCard — acerto incerto em questão com marca rebaixa o rating FSRS da marca de Good pra Hard (conhecimento frágil volta antes). É a entrada barata da aposta de metacognição, sem nenhum UI novo.

## Consertar/terminar primeiro

- Chave Anthropic com saldo — sem ela o extrator de grifos (produto-herói) não roda nem em dev; resolver antes de qualquer front
- Front do grifo do professor (GrifoLayer) — backend pronto em src\server\grifos\, falta o render; remover o mock de cor atual e reusar a engine de overlay de src\components\questoes\highlights\ (HighlightLayer/resolveAnchor)
- Caderno (drawer de todas as marcas) — pendência da lista atual; implementar já na versão inteligente (agrupado por taxonomia, ordenado por due FSRS + incidência), não como lista burra
- Mobile (bottom sheet) — paridade obrigatória, não WOW: hoje a marcação simplesmente não existe no celular (tudo é hover/mousemove); seleção nativa + botão 'Marcar' flutuante + bottom sheet reusando a lógica do HighlightBalloon, hitTest trocando mousemove por click

## Roadmap

### Agora

- Chave Anthropic com saldo (desbloqueia tudo)
- Front do Raio-X v1: GrifoLayer reusando overlay existente + gate pós-resposta (botão só aparece depois de responder) + remoção do mock de cor
- Quick win: chips semânticos type→color na SelectionToolbar (highlights.config.ts)
- Quick win: undo de remoção + atalhos 1-5/G/Esc
- Quick win: onboarding do grifo (dica na fileira + coach mark + gatilho de 3 erros)
- Quick win: naDuvida → rating Hard no FSRS das marcas

### Em seguida

- Killer move 1 completo (Raio-X da Pegadinha): prefetch no handleResponder só quando errou/cache-hit, revelação encenada com stagger, CTA 'Ver onde a banca te pegou →', botão 1-toque 'Guardar essa pegadinha' (cria highlight pré-preenchido)
- Killer move 2 (Caderno de Erros automático): botão 'Virar flashcard' no HighlightBalloon (FSRS já existe em src/lib/fsrs.ts) + Caderno drawer inteligente (taxonomia + due FSRS + incidência) com modo 'Teste-me' opcional
- Mobile bottom sheet (paridade) — assim que o desktop provar adoção da marcação
- Normalizar tipo_armadilha em enum no extract-grifos.ts (pré-requisito barato de tudo que agrega)

### Depois

- Pré-aquecimento batch dos grifos por incidência com teto de custo explícito + badge 'Pegadinhas mapeadas' na lista (mata latência e destrava agregações)
- Painel de calibração completo ('Confiante 85% vs Na dúvida 42%' por tema) + detector 'Caiu de novo?' com painel Minhas Armadilhas
- Simulado dos Seus Pontos Fracos (núcleo da Nêmesis como preset de filtro, sem teatro)
- Caça-Pegadinha (modo treino cego com grifo do Opus como gabarito, sem ranking social) + confronto passivo 'você marcou 2 das 3'
- Treino Anti-Pegadinha com interleaving por tipo de armadilha (depende de reincidência + cache denso)
- Radar de Pegadinhas da Banca (agregação banca×ramo, só com cache denso e enum normalizado)
- Engavetados até prova de adoção: Mapa de Calor da Comunidade (rede inexistente = deserto), Card compartilhável (esperar o Raio-X gerar momentos clipáveis), export PDF do Caderno

## Vereditos do advogado do diabo (resumo)

- **WEAK** · Marca viva: todo grifo 'Atenção' vira um item FSRS automaticamente — Matrícula AUTOMÁTICA de toda marca gera avalanche de revisões (o trauma-Anki que faz aluno abandonar); o valor real está na versão opt-in (#Pegadinha vira Flashcard), e a mecânica 'onde estava a armadilha?' vale como modo de revisão do Caderno, não como default forçado.
- **SOLID** · Pós-erro inteligente: errou → o grifo do professor mostra POR QUÊ, na hora — Feedback corretivo no segundo do erro é o uso cientificamente certo do grifo do professor e o CTA de 1 toque fecha o ciclo — mas é metade da mesma feature que o 'prefetch+gate' (#22): implementar juntas, cache-first obrigatório pra não virar bomba de custo Opus.
- **SOLID** · 'Caiu de novo?' — detector de reincidência por tipo de armadilha — Metacognição real com dado que só este app tem, mas exige normalizar tipo_armadilha em enum (texto livre do Opus deriva) e só funciona com cache denso — sequenciar depois do pré-aquecimento (#16).
- **SOLID** · Treino Anti-Pegadinha: sessão com interleaving por tipo de armadilha — Interleaving por armadilha é ciência legítima e sessão que o grinder de 50q/dia usaria de verdade, mas é v2: depende do detector de reincidência e de estoque de questões com grifo cacheado — sem isso não há o que intercalar.
- **WEAK** · Caderno de Marcas em modo 'Teste-me' (não releia — recupere) — Retrieval > releitura é correto, mas teste como DEFAULT pune o caso de uso mais comum (consultar rapidamente uma marca); vale como modo opcional dentro do Caderno turbinado, não como identidade do drawer.
- **KILLER** · Calibração de confiança: 'na dúvida' como rating FSRS e painel metacognitivo — Esforço S sobre sinal que já existe no código (naDuvida confirmado), ninguém no mercado mede calibração, e em CESPE certo/errado saber quando confiar vale pontos diretos — barato, único, invisível, não polui o card.
- **KILL** · Duelo aluno × professor: 'Ache a pegadinha antes de responder' — Duplicata da Caça-Pegadinha (#27) — mesma mecânica, mesma infra, outro nome; julgue uma vez só.
- **KILL** · Dossiê de armadilhas da banca: briefing pré-prova agregando os grifos — Duplicata XL do Radar de Pegadinhas da Banca (#25) — a versão mais cara da mesma agregação.
- **KILLER** · Raio-X da Pegadinha: lançar o grifo do professor como produto-herói — Backend+guard+cache prontos, reuso quase total da engine de overlay, e é O diferencial visível vs Gran/TEC/QC (explicação ancorada no trecho exato) — ship first; todo o resto da lista depende de provar esse momento.
- **WEAK** · Mapa de Calor da Comunidade: onde 3 milhões de concurseiros caíram — Efeito de rede sem rede: marcação é comportamento de power-user e a densidade por questão sobre 3,2M será ~zero por muito tempo — engavetar até a adoção de marcação estar provada, senão o toggle mostra um deserto.
- **KILL** · Caderno de Erros Automático: grifo vira flashcard FSRS em 1 clique — Duplicata exata de 'Pegadinha vira Flashcard' (#29) — mesmo botão, mesmo word-hiding, mesmo FSRS, com effort maior.
- **KILL** · Modo Caça-Pegadinha: ache a armadilha antes de responder — Duplicata da Caça-Pegadinha (#27) com streak e emoji por cima — nada novo além da embalagem.
- **WEAK** · Card de Pegadinha Compartilhável (Instagram/TikTok) — Botão de share é a feature mais superestimada que existe — quem posta print já posta sem botão; só considerar depois que o Raio-X provar que gera momentos clipáveis organicamente.
- **KILL** · Radar de Pegadinhas por Banca: a inteligência que nenhum cursinho tem — Duplicata do Radar de Pegadinhas da Banca (#25), articulação inferior da mesma ideia.
- **SOLID** · Caderno de Marcas com Revisão Inteligente (o drawer pendente, turbinado) — É a feature pendente feita certo — pura composição de ativos existentes (taxonomia+incidência+FSRS+histórico) e a priorização é o que separa caderno de lista burra; o export PDF é perfumaria, cortar do v1.
- **SOLID** · Grifos pré-gerados nos tópicos quentes + selo na lista de questões — Pré-aquecer por incidência mata a latência do produto-herói e é pré-requisito do Radar e da Caça — o jeito certo de gastar Opus, desde que com teto de custo explícito no batch.
- **SOLID** · Cores com significado: o tipo escolhe a cor (1 clique = marca pronta) — Reduz a decisão de marcar de 3 pra 1 clique no gesto repetido 50x/dia e cria o código visual que Caderno, radar e confronto precisam pra serem legíveis — zero mudança de schema, confirmado no highlights.config.ts.
- **SOLID** · Marcação sem tirar a mão do teclado + undo de remoção — O undo corrige um buraco real de destruição instantânea sem rede de segurança; os atalhos são bônus barato — embora a seleção continue no mouse, então o pitch 'sem tirar a mão do teclado' é meio falso.
- **SOLID** · "Você viu a pegadinha?" — confronto grifo do aluno × grifo do professor — Confronto passivo por interseção de âncoras é fricção zero e gera a métrica única '% de pegadinhas que você enxerga' — mas só dispara na interseção rara (aluno que grifa ANTES de responder + questão cacheada), então o valor cresce com adoção, não no day one.
- **KILL** · Caderno de Pegadinhas: marcas que viram flashcards FSRS, não uma lista — É a #15 (Caderno inteligente) + #29 (virar flashcard) embrulhadas de novo em effort L — nada próprio além da junção.
- **SOLID** · Descoberta e onboarding: a feature mais forte do card é invisível hoje — Feature invisível = feature inexistente, e custa S; única ressalva: 'quem grifa erra menos' é estatística inventada — não publicar claim sem dado próprio.
- **SOLID** · Grifo do professor: prefetch pós-resposta + revelação encenada (corrige o plano atual) — O gate pós-resposta e a revelação encenada corrigem furos reais do plano atual, mas prefetch em TODA resposta é bomba de custo — disparar só em cache-hit ou só quando errou, e fundir com a ideia de pós-erro (#2): são a mesma feature.
- **SOLID** · Mobile: marcação por bottom sheet (hoje a feature simplesmente não existe no celular) — Não é WOW, é paridade obrigatória: o concurseiro resolve questão no celular e hoje o sistema inteiro de marcação não existe lá — é dívida de produto, priorizar assim que o desktop provar adoção.
- **KILL** · Raio-X da comunidade: o que 50 mil alunos grifam nesta questão — Duplicata do Mapa de Calor da Comunidade (#10), com o mesmo cold-start fatal de rede inexistente.
- **SOLID** · Radar de Pegadinhas da Banca — Fosso de dados real e máquina de PR que concorrente não copia, MAS os percentuais vêm de classificação do próprio Opus sobre amostra enviesada — sem cache denso (#16) e vocabulário normalizado, '41% troca-de-prazo' é pseudo-precisão bonita; sequenciar tarde.
- **WEAK** · DNA do Seu Erro — Duplicata do 'Caiu de novo?' (#3) com verniz de identidade — e o chip pré-resposta 'seu ponto fraco ronda esta questão' vaza spoiler (avisa que há pegadinha), contaminando o treino e a própria estatística.
- **SOLID** · Caça-Pegadinha (treino cego de grifo) — Melhor articulação do cluster (grifo do professor como gabarito resolve o dilema pré/pós-resposta) e é treino deliberado da habilidade nº1 de prova — mas vive ou morre pela qualidade do gabarito do Opus em escala: provar o Raio-X antes, e cortar ranking/duelo social, que é enfeite.
- **WEAK** · Modo Raio-X (pós-resposta) — Quatro camadas animadas no pós-resposta é poluição do card; o valor real (grifos acesos + estatística viva) já está coberto por #9+#22 — 'autópsia da questão' é direção de marca, não feature.
- **KILLER** · Pegadinha vira Flashcard (1 clique, direto no FSRS) — Maior ratio impacto/esforço da lista: S, opt-in, fecha o ciclo errou→grifou→revisa-espaçado com flashcards+FSRS que JÁ existem no app, e automatiza a técnica viral do caderno de erros que hoje é manual — nenhum concorrente fecha esse loop.
- **KILL** · Heatmap Social — 'o trecho que 78% marcou' — Terceira duplicata do heatmap comunitário, agora com medalhas 'Olho Raro' e 'manada errada' — gamificação rasa sobre uma rede que ainda não existe.
- **KILL** · Caderno de Marcas com revisão FSRS embutida — Duplicata da #15 (Caderno inteligente) + #29 (FSRS opt-in) — quarta versão do mesmo drawer.
- **WEAK** · Prova Nêmesis — o simulado anti-você — O núcleo (simulado dos seus pontos fracos por incidência+histórico) é um preset de filtro que se faz em S e vale ouro; o avatar, a narrativa e o rito de passagem são teatro XL com cadeia de dependências não construídas — extrair o núcleo, matar a embalagem.
