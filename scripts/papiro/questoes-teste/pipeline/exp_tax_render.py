"""Renderiza a taxonomia final (arvore tema->subtema) com a CONTAGEM REAL de questoes
por no, juntando _tax_final.json (estrutura da IA) + _tax_clusters.json (tamanhos)."""
from __future__ import annotations
import json, sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CACHE = Path(r"D:\inventario-v2\_scale_probe")
clusters = json.loads((CACHE / "_tax_clusters.json").read_text(encoding="utf-8"))
size = {c["id"]: c["size"] for c in clusters["clusters"]}
total = clusters["total"]
tax = json.loads((CACHE / "_tax_final.json").read_text(encoding="utf-8")).get("taxonomia", [])

print(f"\n📕 {clusters['materia'].upper()}  —  {total:,} questões (2020-2025)")
print(f"   taxonomia emergente: {len(tax)} temas, {sum(len(t['subtemas']) for t in tax)} subtemas\n")

seen = set(); dup = []
# ordena temas por volume
def tema_size(t):
    return sum(size.get(c, 0) for s in t["subtemas"] for c in s["clusters"])

for t in sorted(tax, key=tema_size, reverse=True):
    ts = tema_size(t)
    print(f"┏━ {t['tema']}  ·  {ts:,}q ({100*ts/total:.0f}%)")
    if t.get("descricao"):
        print(f"┃   {t['descricao'][:90]}")
    subs = sorted(t["subtemas"], key=lambda s: sum(size.get(c, 0) for c in s["clusters"]), reverse=True)
    for s in subs:
        ss = sum(size.get(c, 0) for c in s["clusters"])
        for c in s["clusters"]:
            if c in seen: dup.append(c)
            seen.add(c)
        print(f"┃   ├─ {s['subtema']}  ·  {ss:,}q")
    print("┃")

faltando = sorted(set(size) - seen)
print("─" * 60)
print(f"[check] clusters cobertos: {len(seen)}/{len(size)} | "
      f"faltando: {faltando or 'nenhum'} | duplicados: {sorted(set(dup)) or 'nenhum'}")
print(f"[check] soma questoes na arvore: {sum(size[c] for c in seen):,} de {total:,}")
