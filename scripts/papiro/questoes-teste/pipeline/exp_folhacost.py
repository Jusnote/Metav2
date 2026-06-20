"""Custo real medido de UMA folha (tokens reais dos artefatos -> precos publicados)."""
from __future__ import annotations
import sys, json, glob
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

PIPE = Path(r"D:\meta novo\Metav2\scripts\papiro\questoes-teste\pipeline")
FOLHA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\inventario-v2\lingua-portuguesa-portugues\ortografia\acentuacao")
PILOT = FOLHA / "_pilot2"

try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    def tok(s): return len(enc.encode(s))
    M = "tiktoken"
except Exception:
    def tok(s): return int(len(s) / 3.7)
    M = "chars/3.7"

def T(p):
    p = Path(p)
    return tok(p.read_text(encoding="utf-8", errors="replace")) if p.exists() else 0

NQ = sum(len(json.loads(Path(f).read_text(encoding="utf-8"))) for f in glob.glob(str(FOLHA / "lote-*.json")))
analista = T(PIPE / "analista_map.md"); consol = T(PIPE / "consolidador_inventario.md"); rani = T(PIPE / "redator_rani.md")

map_in = map_out = 0
for f in sorted(glob.glob(str(FOLHA / "lote-*.json"))):
    map_in += analista + T(f)
    map_out += T(PILOT / f"{Path(f).stem}.inventory.json")
# gap (chamada extra de MAP)
if (PILOT / "gap.json").exists():
    map_in += analista + T(PILOT / "gap.json"); map_out += T(PILOT / "gap.inventory.json")

invs = glob.glob(str(PILOT / "lote-*.inventory.json")) + ([str(PILOT / "gap.inventory.json")] if (PILOT / "gap.inventory.json").exists() else [])
invmd = next(iter(glob.glob(str(PILOT / "INVENTARIO*.md"))), None)
cons_in = consol + sum(T(x) for x in invs) + T(PILOT / "id_meta.json")
cons_out = (T(invmd) if invmd else 0) + T(PILOT / "INVENTARIO-indice.json")

ranimd = next(iter(glob.glob(str(PILOT / "RESUMO*RANI*.md"))), None) or next(iter(glob.glob(str(PILOT / "RESUMO*.md"))), None)
rani_in = rani + (T(invmd) if invmd else 0); rani_out = T(ranimd) if ranimd else 0

tin = map_in + cons_in + rani_in; tout = map_out + cons_out + rani_out
print(f"=== {FOLHA.name} — {NQ} questoes (tokens: {M}) ===")
print(f"  MAP        in {map_in:>7,} out {map_out:>7,}")
print(f"  CONSOLIDATE in {cons_in:>7,} out {cons_out:>7,}")
print(f"  RANI       in {rani_in:>7,} out {rani_out:>7,}")
print(f"  TOTAL      in {tin:>7,} out {tout:>7,} = {tin+tout:,} tok | {(tin+tout)/NQ:.0f}/questao")
for m, pi, po in [("Opus 4.x", 15, 75), ("Sonnet 4.x", 3, 15)]:
    c = (tin*pi + tout*po)/1e6/NQ
    print(f"  {m}: ${c:.4f}/q  (Batch ${c/2:.4f}/q)  | extrapolando 79K: ${c*79000:,.0f} (Batch ${c*79000/2:,.0f})")
print(f"  arquivos: INVENTARIO={Path(invmd).name if invmd else '-'} | RESUMO={Path(ranimd).name if ranimd else '-'}")
