# Árvore Iterative-Fit + Colocação — PAPIRO Taxonomia (lançamento)

**Data:** 2026-06-13 · Decisões consolidadas em `project_taxonomia_from_questoes` (memória).

## Objetivo
Taxonomia "melhor do Brasil" que **mata a reclamação "questão estranha ao nó"** dos cursinhos. Princípio: a árvore **se ajusta às questões num loop**, e "questão estranha" vira o **sinal que conserta a árvore**, não um defeito tolerado.

## Modelos (decididos + medidos)
- **Árvore (montar + nomear + refinar):** Opus 4.8 (Fable suspenso) — julgamento fino, poucas chamadas/matéria, custo trivial.
- **Colocação (classificar 1M+):** DeepSeek V4 Flash — barato/rápido (93% Direito, ~83-88% Português; ~$35-42/1,07M). Produção = API DeepSeek direto; piloto = OpenRouter.
- **Embedding (Voyage):** só p/ montar a árvore (clusters) e p/ a BUSCA SEMÂNTICA depois. NÃO entra na colocação.

## Duas famílias de matéria
- **Conteúdo=tópico** (Direito, Medicina…): bottom-up puro (cluster define estrutura).
- **Habilidade** (Português, Matemática, RLM…): hybrid — backbone de competências guia o Opus; cluster = evidência/incidência.

## O loop iterative-fit (núcleo)
1. **Árvore-rascunho** (Opus dos clusters). Cada nó = **nome + definição crisp + exemplos canônicos + regra de desempate com o vizinho confuso**.
2. **Coloca amostra** (DeepSeek) **com válvula de escape**: pode marcar "0 = não encaixa em nenhum" e confiança (alta/baixa). Questão **não é forçada**.
3. **Diagnostica:**
   - Nó com muita questão estranha / baixa confiança → nó **mal definido** (largo, ou 2 temas) → **dividir/afinar**.
   - Monte de "não encaixa" parecidas → **falta nó** → **adicionar** (ex.: "Ordem Econômica" que faltava).
   - Confusão recorrente entre 2 nós → criar **regra de desempate**.
4. **Opus refina** a árvore com o diagnóstico. **Repete** até a colocação ficar limpa (poucas estranhas, poucos "não encaixa").
5. **Gate humano (alto impacto):** Aldemir revisa a **estrutura final** + as **regras de desempate** (não rotula no escuro — provou-se ruidoso).

## Pipeline por matéria
prep (pull all-years sample → embed → cluster, cache) → Opus árvore-rascunho → **loop iterative-fit** (passos 2-4) → árvore limpa → DeepSeek coloca TODAS as questões → persiste árvore + mapa questão→nó → app navega + incidência (`GROUP BY` grátis) → **lança**. Resumo depois, nó a nó.

## Camadas futuras (o WOW total, pós-lançamento, incidência-first)
A árvore iterative-fit é a **fundação** cujos nós viram âncoras p/ as camadas superiores:
1. **Facetada** (multi-eixo): tema · tipo de cobrança (lei/jurisprudência/doutrina) · banca · dificuldade · tipo de pegadinha → busca livre "do jeito do aluno".
2. **Ancorada** em norma + jurisprudência (artigo/súmula/tema repetitivo exato).
3. **Atômica** (o MAP já validado): questão linka ao **ponto cobrável + a pegadinha exata**, não ao nó largo. Camada cara (MAP/questão) → incidência-first nos campeões.

## Piloto
Ciclo 1 no **Português** (prepado): colocar amostra c/ válvula de escape → diagnóstico (nós bagunçados + "não encaixa") → Opus refina → mostrar a árvore se consertando. Scripts em `scripts/papiro/questoes-teste/pipeline/`.
