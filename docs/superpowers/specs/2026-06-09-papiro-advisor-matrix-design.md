# PAPIRO — Matriz Advisor no MAP (custo-ótimo)

**Data:** 2026-06-09 · **Folha de teste:** `direito-civil/da-responsabilidade-civil-arts-927-a-954`, `lote-001` (50 q) · **Rota:** Max (`claude -p`), R$0 marginal.

## Objetivo
Achar o custo-ótimo do MAP: **chegar na qualidade do Fable (37 pontos) gastando menos que o Fable** (que custa 2,1× o Opus). Baselines validados: **Opus 31 pontos / 103 pegadinhas / $2,18**; **Fable 37 / 121 / $4,61**.

## Descoberta que mudou o plano: a *advisor tool* oficial NÃO serve aqui
A ferramenta advisor oficial da API (`type: advisor_20260301`, beta `advisor-tool-2026-03-01`) tem 3 travas que inviabilizam a ideia original ("worker barato + Fable advisor"):
1. **Fable só aconselha Fable.** A tabela de compatibilidade exige *advisor ≥ executor* e cada família só pareia consigo (Fable↔Fable, Mythos↔Mythos). O par barato real seria **Sonnet/Haiku executor + Opus advisor** — mas isso **teto no Opus-31**, porque o Opus-advisor não injeta o que o próprio Opus esquece (art. 953, 187, 945…).
2. **É só API (beta header).** Não roda no `claude -p`/Max — voltaria a depender da chave de API (comprometida, a rotacionar).
3. **O advisor só planeja (400–700 tok), não gera.** O executor (Sonnet) ainda teria que cuspir o inventário inteiro → o timeout do Sonnet no MAP **não** é resolvido.

**Conclusão:** a ferramenta oficial entrega "Opus barato", não "Fable barato". Fica **pendurada** pra quando montarmos o Batch de produção (rota paga, onde o "Opus mais barato" faz diferença).

## Mecanismo testado: advisor-na-mão (DIY), 100% Max
Worker gera rascunho → **1 chamada Fable separada** critica e remenda → **código funde**. Sem trava de pareamento (2 chamadas independentes). É "advisor no Max".

- **B1 — Opus + Fable:** rascunho = **reaproveita o baseline Opus** (0 run de worker) + 1 chamada Fable. Mede: o Fable-revisor recupera **31 → ~37**?
- **B2 — Sonnet-leve + Fable:** rascunho = Sonnet com prompt **leve** (largura, 1 frase/conceito, sem esgotar — foge do timeout) + 1 chamada Fable. O rascunho leve também é pontuado sozinho (byproduct). Mede: o worker mais barato possível + Fable chega lá?

### O revisor Fable (`revisor_fable.md`)
Recebe **só** lote + rascunho (sem ver a régua nem o baseline Fable — teste honesto). Devolve o *delta*:
```
{ pontos_faltantes:[<schema analista>], pegadinhas_faltantes:[{ponto_existente,pegadinha}], correcoes:[{ponto,erro_no_rascunho,correcao,ids}] }
```
Guard: todo `id` citado tem que existir no lote.

### Merge (código)
Anexa `pontos_faltantes` (dedup por rótulo normalizado — se já há parecido, agrega só as pegadinhas), agrega `pegadinhas_faltantes` ao ponto existente, registra `correcoes` em `_revisor`. Re-audita cobertura.

## Régua (independe da rota)
Tirada do diff dos baselines — os itens que separam o Fable-37 do Opus-31:
- **Itens-ouro /8:** art. 953 (injúria/difamação), abuso de direito (187), culpa concorrente (945), art. 931, prescrição (200 + 198,I), Súmula 642, Súmula 387, nascituro/ricochete. *Checagem por conceito* (não número cru — "187" colide com a Súmula 187 do transportador).
- **Armadilhas (flags p/ humano):** condomínio ≠ "PJ/art.71"; estado de necessidade = 188 **II** (não I).
- Secundário: pontos, pegadinhas, cobertura (IDs), custo, tempo.
- **Métrica-chave (delta):** quantos itens-ouro o Fable **acrescentou** ao rascunho — isola a contribuição do revisor.

## Critério de decisão
Braço mais barato com **ouro ≥7/8 e zero armadilhas**. Aldemir lê o dump do vencedor (como leu o 31 vs 37) antes de virar padrão — código não pega erro de conteúdo.

## Arquivos
- `pipeline/revisor_fable.md` — prompt do revisor (fica).
- `pipeline/analista_map_light.md` — MAP leve pro Sonnet (fica).
- `pipeline/_advisor_matrix.py` — orquestrador throwaway: pontua baselines, roda B1, roda B2, funde, imprime tabela + delta. Saídas em `_ab/`.

## Sequência
Pontua baselines (0 call) → B1 (1 call Fable) → B2 (1 call Sonnet + 1 call Fable). **3 chamadas Max.**
