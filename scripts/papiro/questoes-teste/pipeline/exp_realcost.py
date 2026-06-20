"""Custo REAL medido: conta tokens dos artefatos REAIS do piloto de prescricao
(entradas + saidas de uma cascata Opus que de fato rodou) e aplica precos publicados.
Sem chute de telemetria."""
from __future__ import annotations
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

PIPE = Path(r"D:\meta novo\Metav2\scripts\papiro\questoes-teste\pipeline")
FOLHA = Path(r"D:\inventario-v2\direito-penal\da-extincao-da-punibilidade-arts-107-a-120-do-cp\da-prescricao-arts-108-a-119-do-cp")
PILOT = FOLHA / "_pilot2"

# tokenizer: tiktoken se houver, senao chars/3.7 (PT juridico ~ denso)
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    def tok(s): return len(enc.encode(s))
    METHOD = "tiktoken cl100k"
except Exception:
    def tok(s): return int(len(s) / 3.7)
    METHOD = "chars/3.7 (aprox)"


def T(p: Path):
    if not p.exists():
        return 0
    return tok(p.read_text(encoding="utf-8", errors="replace"))


NQ = sum(len(__import__("json").loads(f.read_text(encoding="utf-8"))) for f in FOLHA.glob("lote-*.json"))

analista = T(PIPE / "analista_map.md")
consol = T(PIPE / "consolidador_inventario.md")
rani = T(PIPE / "redator_rani.md")

# ---- MAP: 3 lotes. input = prompt analista + lote; output = inventory ----
map_in = map_out = 0
for f in sorted(FOLHA.glob("lote-*.json")):
    map_in += analista + T(f)
    inv = PILOT / f"{f.stem}.inventory.json"
    map_out += T(inv)

# ---- CONSOLIDATE: input = prompt + 3 inventories + id_meta; output = INVENTARIO.md + indice ----
inv_files = list(PILOT.glob("lote-*.inventory.json"))
cons_in = consol + sum(T(x) for x in inv_files) + T(PILOT / "id_meta.json")
invmd = next(iter(PILOT.glob("INVENTARIO*.md")), None)
cons_out = (T(invmd) if invmd else 0) + T(PILOT / "INVENTARIO-indice.json")

# ---- RANI: input = prompt + INVENTARIO.md; output = RESUMO ----
ranimd = next(iter(PILOT.glob("RESUMO*RANI*.md")), None) or next(iter(PILOT.glob("RESUMO*.md")), None)
rani_in = rani + (T(invmd) if invmd else 0)
rani_out = T(ranimd) if ranimd else 0

tin = map_in + cons_in + rani_in
tout = map_out + cons_out + rani_out
ttot = tin + tout

print(f"=== TOKENS REAIS (metodo: {METHOD}) — prescricao, {NQ} questoes ===")
print(f"  MAP        : in {map_in:>7,}  out {map_out:>7,}")
print(f"  CONSOLIDATE: in {cons_in:>7,}  out {cons_out:>7,}")
print(f"  RANI       : in {rani_in:>7,}  out {rani_out:>7,}")
print(f"  TOTAL      : in {tin:>7,}  out {tout:>7,}  = {ttot:,} tokens")
print(f"  tokens/questao: {ttot/NQ:,.0f}")

# precos publicados (por 1M tokens)
PRICE = {
    "Opus 4.x":   (15.0, 75.0),
    "Sonnet 4.x": (3.0, 15.0),
    "Haiku 4.5":  (1.0, 5.0),
}
print(f"\n=== CUSTO POR QUESTAO (precos publicados, padrao) ===")
for m, (pi, po) in PRICE.items():
    c = (tin * pi + tout * po) / 1e6 / NQ
    print(f"  {m:<11}: ${c:.4f}/q   (Batch -50%: ${c/2:.4f}/q)")

print(f"\n=== EXTRAPOLACAO ===")
for label, n in [("Direito+Contab+Info (~79K)", 79000), ("escopo todo (~155K)", 155000)]:
    print(f"\n  {label}:")
    for m, (pi, po) in PRICE.items():
        c_std = (tin * pi + tout * po) / 1e6 / NQ * n
        # com porteiro ~0.6 no MAP (so o MAP escala; reduce e por folha, ja barato)
        map_frac = (map_in * pi + map_out * po) / (tin * pi + tout * po)
        c_port = c_std * (0.6 * map_frac + (1 - map_frac))  # porteiro corta 40% do MAP
        print(f"    {m:<11}: padrao ${c_std:>8,.0f} | +porteiro ${c_port:>8,.0f} | +porteiro+Batch ${c_port/2:>8,.0f}")
print("\n  (Max = R$0 em dinheiro, so tempo. Caching do prompt analista cortaria input do MAP ainda mais.)")
