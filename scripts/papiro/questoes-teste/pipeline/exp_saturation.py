"""EXPERIMENTO (de-risk cluster-first) — Passo 1: saturação + set-cover.

Mede, SOMENTE com o ground-truth Opus já existente (zero API, zero Opus), quanto
da riqueza (pontos + pegadinhas) é redundante na folha de prescrição (110 questões).

Não modifica nada. Só lê _pilot2/ e os lotes-fonte e imprime números.
"""
from __future__ import annotations
import json, random, sys
from pathlib import Path
from collections import Counter, defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

FOLHA = Path(r"D:\inventario-v2\direito-penal\da-extincao-da-punibilidade-arts-107-a-120-do-cp\da-prescricao-arts-108-a-119-do-cp")
PILOT = FOLHA / "_pilot2"


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


# ---- 1) fonte ----
src = []
for f in sorted(FOLHA.glob("lote-*.json")):
    src += load_json(f)
qids = [q["id"] for q in src]
print(f"[fonte] {len(src)} questoes | chaves exemplo: {sorted(src[0].keys())[:12]}")
tipos_q = Counter(q.get("tipoQuestao") for q in src)
print(f"[fonte] tipoQuestao: {dict(tipos_q)}")

# ---- 2) inventarios por lote (raw analista) ----
inv_files = sorted(PILOT.glob("lote-*.inventory.json"))
gap = PILOT / "gap.inventory.json"
if gap.exists():
    inv_files.append(gap)
invs = [load_json(p) for p in inv_files]
print(f"[inv] {len(invs)} arquivos | chaves: {sorted(invs[0].keys())}")
print(f"[inv] exemplo ponto[0] chaves: {sorted(invs[0]['pontos'][0].keys())}")
if invs[0]['pontos'][0].get('pegadinhas'):
    print(f"[inv] exemplo pegadinha[0] chaves: {sorted(invs[0]['pontos'][0]['pegadinhas'][0].keys())}")

# ---- 3) indice consolidado (26 pontos) ----
idx = load_json(PILOT / "INVENTARIO-indice.json")
print(f"[idx] chaves: {sorted(idx.keys())}")
ranking = idx.get("ranking") or idx.get("pontos") or []
print(f"[idx] pontos consolidados (ranking): {len(ranking)}")
if ranking:
    print(f"[idx] exemplo ranking[0] chaves: {sorted(ranking[0].keys())}")

# ===== mapas =====
# Pontos: usar o consolidado (verdade dos 26). ponto -> set(ids)
pt_ids = {}
for e in ranking:
    ids = set(e.get("ids", []))
    if ids:
        pt_ids[e.get("ponto", e.get("rotulo", str(len(pt_ids))))] = ids

# Pegadinhas: granularidade fina vem dos inventarios por lote (raw).
# chave estavel = (ponto, tipo_armadilha, prefixo do erro)
peg_ids = defaultdict(set)
arma = Counter()
peg_raw = 0
for inv in invs:
    for p in inv.get("pontos", []):
        lab = p.get("ponto", "?")
        for pg in p.get("pegadinhas", []):
            peg_raw += 1
            t = pg.get("tipo_armadilha", "?")
            arma[t] += 1
            err = (pg.get("erro") or pg.get("banca_diz") or "")[:50]
            key = (lab, t, err)
            for i in pg.get("ids", []):
                peg_ids[key].add(i)
peg_ids = {k: v for k, v in peg_ids.items() if v}

print(f"\n[pontos] {len(pt_ids)} pontos consolidados com ids")
print(f"[pegadinhas] {peg_raw} brutas | {len(peg_ids)} distintas (por chave) | tipos: {dict(arma)}")

# cobertura: ids unicos que aparecem em algum ponto/pegadinha
ids_em_ponto = set().union(*pt_ids.values()) if pt_ids else set()
ids_em_peg = set().union(*peg_ids.values()) if peg_ids else set()
print(f"[cobertura] ids fonte={len(set(qids))} | em algum ponto={len(ids_em_ponto)} | em alguma pegadinha={len(ids_em_peg)}")


# ===== saturacao (ordem aleatoria, media) =====
def q_to_items(item_ids):
    m = defaultdict(set)
    for it, ids in item_ids.items():
        for i in ids:
            m[i].add(it)
    return m


def sat_curve(item_ids, order):
    qto = q_to_items(item_ids)
    seen, curve = set(), []
    for q in order:
        seen |= qto.get(q, set())
        curve.append(len(seen))
    return curve


R = 300
rng = random.Random(0)
n = len(qids)
accP = [0.0] * n
accG = [0.0] * n
for _ in range(R):
    order = qids[:]
    rng.shuffle(order)
    cP = sat_curve(pt_ids, order)
    cG = sat_curve(peg_ids, order)
    for k in range(n):
        accP[k] += cP[k]
        accG[k] += cG[k]
avgP = [a / R for a in accP]
avgG = [a / R for a in accG]
TP, TG = len(pt_ids), len(peg_ids)


def k_for(frac, avg, total):
    tgt = frac * total
    for k, v in enumerate(avg, 1):
        if v >= tgt:
            return k
    return len(avg)


# ===== set-cover guloso (oraculo: teto da economia) =====
def greedy_cover(item_ids):
    qto = q_to_items(item_ids)
    remaining = set(item_ids)
    chosen = []
    while remaining:
        best, gain = None, 0
        for q in qids:
            g = len(qto.get(q, set()) & remaining)
            if g > gain:
                gain, best = g, q
        if not best:
            break
        chosen.append(best)
        remaining -= qto[best]
    return chosen, remaining


gpP, restP = greedy_cover(pt_ids)
gpG, restG = greedy_cover(peg_ids)

print("\n================ SATURACAO (ordem aleatoria, media de 300) ================")
for k in [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, n]:
    if k <= n:
        print(f"  k={k:>3}: pontos {avgP[k-1]:5.1f}/{TP} ({100*avgP[k-1]/TP:3.0f}%) | "
              f"pegadinhas {avgG[k-1]:6.1f}/{TG} ({100*avgG[k-1]/TG:3.0f}%)")

print("\n  questoes p/ atingir (ordem aleatoria):")
print(f"    pontos:     90%={k_for(.9,avgP,TP)}  95%={k_for(.95,avgP,TP)}  100%={k_for(1.0,avgP,TP)}")
print(f"    pegadinhas: 90%={k_for(.9,avgG,TG)}  95%={k_for(.95,avgG,TG)}  100%={k_for(1.0,avgG,TG)}")

print("\n================ SET-COVER GULOSO (oraculo = teto da economia) ============")
print(f"  cobrir TODOS os {TP} pontos:      {len(gpP)} questoes  ({100*len(gpP)/n:.0f}% das 110)  | falta cobrir: {len(restP)}")
print(f"  cobrir TODAS as {TG} pegadinhas:  {len(gpG)} questoes  ({100*len(gpG)/n:.0f}% das 110)  | falta cobrir: {len(restG)}")
print(f"\n  => reducao teorica maxima (pegadinhas, o gargalo): {n}/{len(gpG)} = {n/max(1,len(gpG)):.1f}x")
print(f"  => questoes redundantes p/ cobertura total: {n - len(gpG)} de {n} ({100*(n-len(gpG))/n:.0f}%)")
