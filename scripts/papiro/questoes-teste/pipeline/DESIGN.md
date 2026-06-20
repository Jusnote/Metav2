# PAPIRO — Pipeline de Inventário+Resumo "melhor do Brasil" (design)

> Data: 2026-05-27. Status: aprovado. Substitui o piloto v1 (analista_map + redator_reduce).

## Objetivo

A partir dos `lote-*.json` extraídos por `extract_v2.py`, produzir, por folha da
taxonomia, DOIS artefatos em cascata, ambos no nível "melhor do Brasil":
1. **INVENTÁRIO cirúrgico** (técnico) — insumo, auditável.
2. **RESUMO Rani** (voz de mentor) — material final do aluno.

Tudo no **Opus** (decisão do Aldemir: Sonnet tem risco de erro). Custo reportado
pelos tokens isolados dos subagentes (independe do contexto da conversa).

## Princípio que governa o desenho

Separar três naturezas de "riqueza", cada uma onde ela é confiável:

| Natureza | Quem faz | Por quê |
|---|---|---|
| **Profundidade analítica** (dissecar questão/alternativa, erro cirúrgico, verdade, distinção, classificar armadilha) | **Analista (MAP)** | É julgamento — LLM é ótimo; e exige ver a questão inteira |
| **Agregação** (frequência, tendência temporal, ordem do ranking, "saltou de classe") | **Código** | Um lote de 50 não enxerga o total; LLM erra aritmética sobre listas |
| **Apresentação** (prosa, ranking narrado, flags, voz) | **Consolidador + Redator-Rani (REDUCE)** | Síntese sobre substrato + números já fechados |

Regra de ouro: o LLM nunca afirma um número; frequência = contagem de IDs únicos;
tendência = IDs agrupados por ano. Cobertura é auditada por código (todo ID da
fonte tem que aparecer no substrato e no índice final).

## Fluxo

```
Analista (MAP, Opus, 1/lote)  → inventário estruturado (JSON), dissecação máxima
Código (consolida)            → funde + conta freq + deriva trend + ordena + AUDITA 110/110
Consolidador (REDUCE, Opus)   → INVENTÁRIO cirúrgico (markdown nível web)
Redator-Rani (REDUCE, Opus)   → RESUMO do aluno (voz mentor), consome o inventário
```

## Decisões de conteúdo

- **Régua do Analista:** dissecar cada enunciado E cada alternativa; **cada distrator
  vira ponto/pegadinha próprio rastreado por ID** (nada folded); classificar tipo de
  armadilha; marcar raro/tangente/"a conferir" com honestidade. Saída estruturada.
- **Granularidade do inventário:** lista plana e minuciosa estilo web (cada distrator
  é uma linha rastreável), com ranking 🔥/⭐/▫️/·, frequência e tendência por ponto,
  mapa de pegadinhas consolidado, índice questão→ponto, seção "a conferir".
- **Voz do resumo Rani:** replicar o tom do exemplo "Concurso de crimes" (mentor,
  "meu gato e minha gata", diálogos, bizus, mapa mental de 60s).

## Auditoria (inviolável)

- Pós-MAP: todo ID da fonte ∈ ids_analisados E ∈ ≥1 ponto. Gap-fill cirúrgico se faltar.
- Pós-REDUCE: todo ID ∈ índice_questao_ponto; frequência de cada ponto = nº de IDs únicos.

## Escala / custo

- Opus em tudo. Custo-piloto (prescrição 110q, v1): ~352K tokens.
- O custo da nossa SESSÃO (~$13.48) é dominado por contexto longo de conversa, não
  pela folha — run headless/limpo é bem mais barato. Ver `/usage`: 59% >150k contexto.
- Escala de taxonomia (milhares de folhas): Max throttla; caminho é Batch API.
```
