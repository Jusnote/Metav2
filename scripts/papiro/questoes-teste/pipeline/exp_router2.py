import json, glob, random
from pathlib import Path
from collections import defaultdict
import numpy as np

CACHE = Path(r"D:\inventario-v2\_scale_probe")
E = np.load(CACHE / "peg_confusao_cli.emb.npy")

q_idx = defaultdict(list); flat = []
for f in sorted(glob.glob(str(CACHE / "peg_out_cli" / "traps-*.json"))):
    d = json.loads(Path(f).read_text(encoding="utf-8-sig"))
    for r in d.get("results", []):
        for t in r.get("traps", []):
            c = (t.get("confusao") or "").strip()
            if c:
                q_idx[r["id"]].append(len(flat)); flat.append(r["id"])
qids = list(q_idx.keys())

def cluster(radius):
    n, dim = E.shape; buf = np.empty((n, dim), np.float32); k = 0
    asg = np.full(n, -1, np.int32)
    for i in range(n):
        v = E[i]
        if k:
            s = buf[:k] @ v; j = int(np.argmax(s))
            if s[j] >= radius:
                asg[i] = j; continue
        asg[i] = k; buf[k] = v; k += 1
    return asg, k

res = {"questoes": len(qids), "traps": len(flat)}
for radius in [0.85, 0.80]:
    asg, k = cluster(radius)
    qcl = {q: set(asg[i] for i in ix) for q, ix in q_idx.items()}
    rng = random.Random(0); reps = 5; nq = len(qids)
    esc = 0; dec_e = np.zeros(10); dec_c = np.zeros(10)
    for _ in range(reps):
        seen = set(); order = qids[:]; rng.shuffle(order)
        for pos, q in enumerate(order):
            cs = qcl[q]; novel = any(c not in seen for c in cs)
            if novel:
                esc += 1; seen |= cs
            dd = min(9, pos * 10 // nq); dec_e[dd] += novel; dec_c[dd] += 1
    res[f"r{radius}"] = {
        "armadilhas_distintas": int(k),
        "escala_opus_pct": round(100 * esc / (reps * nq), 1),
        "arquiva_gratis_pct": round(100 * (1 - esc / (reps * nq)), 1),
        "speedup_opus": round((reps * nq) / max(1, esc), 2),
        "escalacao_por_decil_pct": [round(100 * a / max(1, b)) for a, b in zip(dec_e, dec_c)],
    }
(CACHE / "_router.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
