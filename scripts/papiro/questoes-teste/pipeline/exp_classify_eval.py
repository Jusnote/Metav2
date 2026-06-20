"""Avalia a classificacao: o que e regra=0 (correta vs sem-match?), funde counts
no ranking economico -> incidencia cheia -> compara com o full."""
from __future__ import annotations
import json, glob
from pathlib import Path
from collections import Counter, defaultdict

FOLHA = Path(r"D:\inventario-v2\lingua-portuguesa-portugues\colocacao-pronominal")
ECON = FOLHA / "_pilot2_econ"

import sys as _sys
CLSFILE = _sys.argv[1] if len(_sys.argv) > 1 else "classificacao_haiku.json"
cls = json.loads((ECON / CLSFILE).read_text(encoding="utf-8"))
# mapa id -> questao (gabarito)
qmap = {}
for f in glob.glob(str(FOLHA / "lote-*.json")):
    for q in json.loads(Path(f).read_text(encoding="utf-8")):
        qmap[q["id"]] = q

# regra=0: e a alternativa CORRETA (gabarito) ou sem-match real?
zero_corretas = zero_errada = 0
exemplos0 = []
for r in cls:
    q = qmap.get(r.get("id"))
    gab = q.get("numeroAlternativaCorreta") if q else None
    for a in r.get("alts", []):
        if a.get("regra") == 0:
            if gab is not None and a.get("alt") == gab:
                zero_corretas += 1
            else:
                zero_errada += 1
                if len(exemplos0) < 5:
                    alts = q.get("alternativas", []) if q else []
                    txt = alts[a["alt"]][:90] if 0 <= a.get("alt", -1) < len(alts) else "?"
                    exemplos0.append(f"id={r['id']} alt[{a['alt']}] '{txt}' -> {a.get('instancia','')[:70]}")

print(f"regra=0 em alternativas CORRETAS (gabarito, ok): {zero_corretas}")
print(f"regra=0 em alternativas ERRADAS (sem-match real = escalar): {zero_errada}")
print("\nexemplos de regra=0 'erradas' (sem-match real):")
for e in exemplos0:
    print("  ", e)

# funde counts no ranking economico
econ = json.loads((ECON / "INVENTARIO-indice.json").read_text(encoding="utf-8")).get("ranking", [])
full = json.loads((FOLHA / "_pilot2" / "INVENTARIO-indice.json").read_text(encoding="utf-8")).get("ranking", [])
# questoes que TESTAM cada regra (conta questoes distintas com >=1 alt naquela regra)
regra_qs = defaultdict(set)
for r in cls:
    for a in r.get("alts", []):
        if a.get("regra", 0) > 0:
            regra_qs[a["regra"]].add(r["id"])

print("\n=== INCIDENCIA: econ-deep(150) + classificadas(392) por regra (top 9) ===")
print(f"{'regra (catalogo econ)':<52} deep  +class  =total | full")
for i, p in enumerate(econ[:9], 1):
    deep_f = p.get("frequencia", 0)
    add = len(regra_qs.get(i, set()))
    full_f = full[i-1].get("frequencia", "?") if i-1 < len(full) else "?"
    print(f"  {i}. {p.get('ponto','?')[:46]:<46} {deep_f:>4}  +{add:<4} ={deep_f+add:<4} | full~{full_f}")
