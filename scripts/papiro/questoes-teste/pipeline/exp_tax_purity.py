"""Mede a PUREZA da taxonomia emergente de DConst:
(1) intrinseco (silhueta, dist ao centroide, ambiguidade entre temas),
(2) concordancia com rotulos TEC existentes,
(3) prepara amostra de 300 questoes p/ auditoria LLM independente.
Usa cache (sem banco)."""
from __future__ import annotations
import json, sys, random
from pathlib import Path
from collections import Counter, defaultdict
import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

C = Path(r"D:\inventario-v2\_scale_probe")
dat = json.loads((C / "dconst.dat.json").read_text(encoding="utf-8"))
ids, txt, ass = dat["ids"], dat["txt"], dat["ass"]
E = np.load(C / "dconst.emb.npy")
tax = json.loads((C / "_tax_final.json").read_text(encoding="utf-8"))["taxonomia"]
K = 30

from sklearn.cluster import KMeans
km = KMeans(n_clusters=K, n_init=4, random_state=0).fit(E)
lab = km.labels_
cen = km.cluster_centers_
cen = cen / (np.linalg.norm(cen, axis=1, keepdims=True) + 1e-9)

# cluster -> tema/subtema
c2tema, c2sub = {}, {}
for t in tax:
    for s in t["subtemas"]:
        for c in s["clusters"]:
            c2tema[c] = t["tema"]; c2sub[c] = s["subtema"]
temas = [t["tema"] for t in tax]

rep = {}

# (1) intrinseco
sims_own = np.array([float(E[i] @ cen[lab[i]]) for i in range(len(E))])
rep["sim_centroide_media"] = round(float(sims_own.mean()), 3)
rep["pct_sim_baixa_(<0.5)"] = round(100 * float((sims_own < 0.5).mean()), 1)

# 2o centroide mais proximo + se eh de OUTRO tema com margem pequena
allsim = E @ cen.T  # (n,K)
amb_outro_tema = 0
for i in range(len(E)):
    order = np.argsort(-allsim[i])
    c1, c2 = order[0], order[1]
    margin = allsim[i, c1] - allsim[i, c2]
    if c2tema.get(int(c2)) != c2tema.get(int(c1)) and margin < 0.05:
        amb_outro_tema += 1
rep["pct_borderline_entre_temas_(margem<0.05)"] = round(100 * amb_outro_tema / len(E), 1)

from sklearn.metrics import silhouette_score
rng = random.Random(0)
samp = rng.sample(range(len(E)), min(4000, len(E)))
rep["silhueta_(amostra4k)"] = round(float(silhouette_score(E[samp], lab[samp], metric="cosine")), 3)

# (2) concordancia TEC (so questoes rotuladas)
# pureza do cluster = fracao da maioria TEC dentro do cluster (entre rotuladas)
pur, wsum = 0.0, 0
for c in range(K):
    idx = [i for i in range(len(E)) if lab[i] == c and ass[i] != "?"]
    if not idx:
        continue
    cnt = Counter(ass[i] for i in idx)
    maj = cnt.most_common(1)[0][1]
    pur += maj; wsum += len(idx)
rep["pureza_TEC_clusters_(maioria/rotuladas)"] = round(100 * pur / max(1, wsum), 1)
rep["pct_questoes_sem_rotulo_TEC"] = round(100 * sum(1 for a in ass if a == "?") / len(ass), 1)

# (3) amostra p/ auditoria LLM
audit_ids = rng.sample(range(len(E)), 300)
audit = {
    "temas": [{"nome": t["tema"], "desc": t["descricao"]} for t in tax],
    "questoes": [{"i": i, "id": ids[i], "tema_atribuido": c2tema[int(lab[i])],
                  "text": txt[i][:700]} for i in audit_ids],
}
(C / "_tax_audit_input.json").write_text(json.dumps(audit, ensure_ascii=False), encoding="utf-8")
(C / "_tax_purity_intrinsic.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(rep, ensure_ascii=False, indent=1))
print(f"\namostra de auditoria: {len(audit['questoes'])} questoes -> _tax_audit_input.json")
