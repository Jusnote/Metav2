"""Economia do PORTEIRO (novelty-routing): de todas as questoes, em quantas o Opus
realmente roda (questao com >=1 armadilha INEDITA) vs arquivadas de graca?
Usa os traps ja extraidos + embeddings cacheados. Escreve resultado em _router.txt."""
from __future__ import annotations
import json, glob, random
from pathlib import Path
from collections import defaultdict
import numpy as np

CACHE = Path(r"D:\inventario-v2\_scale_probe")
EMB = CACHE / "peg_confusao_cli.emb.npy"
OUTF = CACHE / "_router.txt"
lines = []
def P(s): lines.append(s); print(s)

# carregar traps -> por questao, indices na lista flat
q_idx = defaultdict(list); flat_qid = []
for f in sorted(glob.glob(str(CACHE / "peg_out_cli" / "traps-*.json"))):
    d = json.loads(Path(f).read_text(encoding="utf-8-sig"))
    for r in d.get("results", []):
        qid = r.get("id")
        for t in r.get("traps", []):
            c = (t.get("confusao") or "").strip()
            if not c: continue
            q_idx[qid].append(len(flat_qid)); flat_qid.append(qid)

E = np.load(EMB)
assert len(E) == len(flat_qid), f"emb {len(E)} != traps {len(flat_qid)}"
qids = list(q_idx.keys())
P(f"[dados] {len(qids)} questoes, {len(flat_qid)} traps")


def cluster(radius):
    n, dim = E.shape
    buf = np.empty((n, dim), np.float32); k = 0
    assign = np.full(n, -1, np.int32)
    for i in range(n):
        v = E[i]
        if k:
            s = buf[:k] @ v; j = int(np.argmax(s))
            if s[j] >= radius: assign[i] = j; continue
        assign[i] = k; buf[k] = v; k += 1
    return assign, k


def router_sim(qclusters, reps=5):
    """% de questoes que ESCALAM (tem >=1 cluster inedito) em ordem aleatoria."""
    rng = random.Random(0)
    esc_total = 0; esc_decile = np.zeros(10); cnt_decile = np.zeros(10)
    nq = len(qids)
    for _ in range(reps):
        seen = set(); order = qids[:]; rng.shuffle(order)
        for pos, q in enumerate(order):
            cs = qclusters[q]
            novel = any(c not in seen for c in cs)
            if novel:
                esc_total += 1
                seen |= cs
            dec = min(9, pos * 10 // nq)
            esc_decile[dec] += (1 if novel else 0)
            cnt_decile[dec] += 1
    return esc_total / (reps * nq), esc_decile / np.maximum(1, cnt_decile)


for radius in [0.88, 0.85, 0.80]:
    assign, k = cluster(radius)
    qcl = {q: set(assign[i] for i in idxs) for q, idxs in q_idx.items()}
    esc, dec = router_sim(qcl)
    P(f"\n=== raio {radius} | {k} armadilhas distintas ===")
    P(f"  ESCALAM p/ Opus: {100*esc:.0f}% das questoes  |  arquivadas gratis: {100*(1-esc):.0f}%")
    P(f"  speedup do Opus: {1/max(0.01,esc):.1f}x")
    P("  escalacao por decil (inicio->fim): " + " ".join(f"{100*d:.0f}" for d in dec))

# projecao simples
P("\n[leitura] o decil final mostra a taxa no 'fundo da cauda' de um topico grande.")
P("Quanto maior o topico, mais peso tem a cauda barata -> mais economia.")
OUTF.write_text("\n".join(lines), encoding="utf-8")
