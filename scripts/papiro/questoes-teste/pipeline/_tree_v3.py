"""Refino de GRANULARIDADE por incidência absoluta — REGRA UNIVERSAL (toda matéria):
nó com volume alto + subtópicos distinguíveis → DIVIDE; nó pequeno → mantém.
Opus aplica à tree_v2 usando a incidência real do acervo. Demonstra que escala. THROWAWAY."""
import asyncio, json
from pathlib import Path
from pipeline import ClaudeCliDispatcher

TAX = Path(r"D:\inventario-v2\_scale_probe\tax")
SLUG = "portugues"
TREE_V2 = TAX / f"{SLUG}.tree_v2.json"
OUT = TAX / f"{SLUG}.tree_v3.json"
RAT = TAX / f"{SLUG}.v3_racional.md"

# incidência absoluta REAL do acervo (~288K) — em produção vem da nossa colocação escalada;
# aqui uso as contagens reais do banco como sinal de volume.
VOL = TAX / f"{SLUG}.volumes.txt"
VOL.write_text(
    "INCIDÊNCIA ABSOLUTA por tópico no acervo de Português (~288.000 questões):\n"
    "  Interpretação de Textos: ~65.000 (já dividida por gênero na v2 — manter)\n"
    "  Pontuação: ~12.400\n  Coesão/referenciação: ~10.600\n  Concordância (verbal+nominal): ~10.200\n"
    "  Conjugação/tempos e modos verbais: ~8.100\n  Crase: ~7.000\n  Conjunção: ~6.900\n"
    "  Acentuação: ~6.300\n  Sinônimos/Antônimos: ~6.000\n  Significação de vocábulo: ~5.500\n"
    "  Fonética/Fonologia/Separação silábica: ~4.900\n  Ortografia (grafia/letras): ~4.700\n"
    "  Regência (verbal+nominal): ~4.650\n  Figuras de linguagem: ~3.700\n"
    "  Substantivo: ~3.500\n  Formação/estrutura de palavras: ~3.400\n  Colocação pronominal: ~2.900\n"
    "  Denotação/Conotação: ~2.400\n  Adjetivo: ~2.350\n  Advérbio: ~2.270\n  Vozes verbais: ~2.000\n"
    "  Termos integrantes (objeto/complemento): ~1.900\n  Termos acessórios (adjuntos/aposto): ~1.670\n"
    "  Preposição: ~1.570\n  Orações subordinadas adverbiais: ~1.370\n  Funções da linguagem: ~1.190\n"
    "  Variação linguística: ~1.180\n  Homônimos/Parônimos: ~900\n  Uso do hífen: ~875\n",
    encoding="utf-8")


def prompt():
    return (
        "Você é o Editor-Chefe de Taxonomia do PAPIRO, ajustando a GRANULARIDADE da árvore de "
        "Língua Portuguesa por uma REGRA UNIVERSAL (vale p/ qualquer matéria), baseada na incidência real.\n\n"
        f"PASSO 1 — Read a árvore atual (v2): {TREE_V2}\n"
        f"PASSO 2 — Read a incidência absoluta por tópico: {VOL}\n"
        "PASSO 3 — Aplique a REGRA DE GRANULARIDADE a TODOS os nós:\n"
        "   • Nó que hoje agrupa subtópicos DISTINGUÍVEIS cujo volume individual é ALTO (≳2.500 questões) "
        "→ DIVIDIR nos subtópicos naturais. Ex.: 'Ortografia, Acentuação e Fonologia' junta 3 tópicos de "
        "~5-6K cada → separar em Ortografia | Acentuação | Fonética-Fonologia/Sílaba.\n"
        "   • Subtópico pequeno (≲1.000) → NÃO fragmentar; manter agrupado.\n"
        "   • Não invente volume; use o arquivo. Mantenha definicao+exemplos+desempate em cada nó (a v2 já tem).\n"
        "PASSO 4 — Avalie também: Morfologia (classes têm volume p/ separar verbo/substantivo/etc.?), "
        "Sintaxe (termos vs período vs vozes), Semântica (sinonímia/significação vs figuras). Divida só onde o volume manda.\n"
        f"PASSO 5 — Write a árvore v3 (mesmo schema, com definicao/exemplos/desempate) em: {OUT}\n"
        f"PASSO 6 — Write o racional das divisões (cada split + o volume que o justificou) em: {RAT}\n\n"
        "Retorne resumo: nº de nós v2→v3 e as divisões feitas (com o volume de cada)."
    )


async def main():
    disp = ClaudeCliDispatcher(model="claude-opus-4-8", max_concurrent=1, timeout=1800)
    print("Opus ajustando granularidade por incidência (regra universal)…")
    out = await disp.run(prompt(), stage="v3")
    print(out[:1600])
    print(f"\n✓ ${sum(s['cost'] for s in disp.stats):.2f} | v3→ {OUT.name} | racional→ {RAT.name}")


if __name__ == "__main__":
    asyncio.run(main())
