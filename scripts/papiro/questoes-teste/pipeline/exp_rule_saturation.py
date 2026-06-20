"""Testa se as REGRAS (pontos consolidados) saturam cedo na colocacao pronominal.
Se os primeiros lotes ja contem ~todas as regras, o resto pode ser CLASSIFICADO barato
(nao re-analisado profundo) sem perder regra. Zero LLM — usa dados ja gerados."""
from __future__ import annotations
import json, sys, glob
from pathlib import Path
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

FOLHA = Path(r"D:\inventario-v2\lingua-portuguesa-portugues\colocacao-pronominal")
PILOT = FOLHA / "_pilot2"

# id -> lote
id2lote = {}
for f in sorted(glob.glob(str(FOLHA / "lote-*.json"))):
    ln = int(Path(f).stem.split("-")[1])
    for q in json.loads(Path(f).read_text(encoding="utf-8")):
        id2lote[q["id"]] = ln
NL = max(id2lote.values())
total_q = len(id2lote)

idx = json.loads((PILOT / "INVENTARIO-indice.json").read_text(encoding="utf-8"))
ranking = idx.get("ranking", [])

# para cada ponto: menor lote entre seus ids
pt_first = []
for p in ranking:
    ids = [i for i in p.get("ids", []) if i in id2lote]
    if not ids:
        continue
    first = min(id2lote[i] for i in ids)
    pt_first.append((first, p.get("frequencia", len(ids)), p.get("ponto", "?")[:60]))

NP = len(pt_first)
print(f"=== COLOCACAO PRONOMINAL: {total_q} questoes, {NL} lotes, {NP} regras (pontos) ===\n")
print("Regras descobertas acumuladas por lote (deep-analise so ate o lote X):")
cum = 0
freq_cum = 0
total_freq = sum(f for _, f, _ in pt_first)
for k in range(1, NL + 1):
    novas = [p for p in pt_first if p[0] == k]
    cum += len(novas)
    freq_cum += sum(p[1] for p in novas)
    qfeitas = sum(1 for i, l in id2lote.items() if l <= k)
    print(f"  ate lote {k:>2} ({qfeitas:>3}q): {cum:>2}/{NP} regras ({100*cum//NP:>3}%) | "
          f"cobre {100*freq_cum//total_freq:>3}% das questoes por incidencia | +{len(novas)} nova(s)")

print("\n[regras que aparecem TARDE — testam se ha cauda de regra nova]:")
for first, freq, nome in sorted(pt_first, reverse=True)[:6]:
    print(f"  lote {first:>2} (freq {freq:>3}): {nome}")

# economia: deep ate o lote onde satura ~95% das regras, classifica o resto
import math
for alvo in [0.9, 0.95, 1.0]:
    need = math.ceil(alvo * NP)
    lote_alvo = None
    cum = 0
    for k in range(1, NL + 1):
        cum += sum(1 for p in pt_first if p[0] == k)
        if cum >= need:
            lote_alvo = k; break
    qdeep = sum(1 for i, l in id2lote.items() if l <= (lote_alvo or NL))
    print(f"\n  p/ cobrir {int(alvo*100)}% das regras: deep ate lote {lote_alvo} = {qdeep} questoes "
          f"({100*qdeep//total_q}%); as outras {total_q-qdeep} ({100*(total_q-qdeep)//total_q}%) "
          f"poderiam ser CLASSIFICADAS barato => economia ~{total_q/max(1,qdeep):.1f}x no deep")
