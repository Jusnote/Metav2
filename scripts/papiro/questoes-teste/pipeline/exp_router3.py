import json, glob, random
from pathlib import Path
from collections import defaultdict
import numpy as np
C = Path(r"D:\inventario-v2\_scale_probe")
E = np.load(C / "peg_confusao_cli.emb.npy")
qi = defaultdict(list); flat = []
for f in sorted(glob.glob(str(C / "peg_out_cli" / "traps-*.json"))):
    d = json.loads(Path(f).read_text(encoding="utf-8-sig"))
    for r in d.get("results", []):
        for t in r.get("traps", []):
            if (t.get("confusao") or "").strip():
                qi[r["id"]].append(len(flat)); flat.append(r["id"])
q = list(qi.keys()); n, dim = E.shape
buf = np.empty((n, dim), np.float32); k = 0; asg = np.full(n, -1, np.int32)
for i in range(n):
    v = E[i]
    if k:
        s = buf[:k] @ v; j = int(np.argmax(s))
        if s[j] >= 0.85:
            asg[i] = j; continue
    asg[i] = k; buf[k] = v; k += 1
qcl = {x: set(asg[i] for i in ix) for x, ix in qi.items()}
rng = random.Random(0); reps = 5; esc = 0; de = np.zeros(10); dc = np.zeros(10)
for _ in range(reps):
    seen = set(); o = q[:]; rng.shuffle(o)
    for pos, x in enumerate(o):
        nov = any(c not in seen for c in qcl[x])
        if nov:
            esc += 1; seen |= qcl[x]
        dd = min(9, pos * 10 // len(q)); de[dd] += nov; dc[dd] += 1
ep = 100 * esc / (reps * len(q))
out = "RESULT esc=%.0f free=%.0f K=%d decis=%s" % (
    ep, 100 - ep, k, ",".join("%.0f" % (100 * a / max(1, b)) for a, b in zip(de, dc)))
(C / "_r3.txt").write_text(out, encoding="utf-8")
print(out)
