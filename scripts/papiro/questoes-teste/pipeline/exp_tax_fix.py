"""FIX: colocacao por-questao (semi-supervisionada).
IA (Sonnet) rotula ~1500 anchors + 400 held-out nos 9 temas; embedding propaga
pras 31K via k-NN; mede pureza nova no held-out (k-NN vs rotulo IA direto).
Compara com baseline 68% (cluster->tema). Escreve _tax_fix_result.json."""
from __future__ import annotations
import json, sys, re, shutil, subprocess, random
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

C = Path(r"D:\inventario-v2\_scale_probe")
dat = json.loads((C / "dconst.dat.json").read_text(encoding="utf-8"))
ids, txt = dat["ids"], dat["txt"]
E = np.load(C / "dconst.emb.npy")
temas = [t["tema"] for t in json.loads((C / "_tax_final.json").read_text(encoding="utf-8"))["taxonomia"]]
descs = {t["tema"]: t["descricao"] for t in json.loads((C / "_tax_final.json").read_text(encoding="utf-8"))["taxonomia"]}
EXE = shutil.which("claude.cmd") or shutil.which("claude")
N = len(E)

rng = random.Random(7)
pool = rng.sample(range(N), 1900)
anchors, heldout = pool[:1500], pool[1500:]

tema_list = "\n".join(f"{i+1}. {t} — {descs[t][:85]}" for i, t in enumerate(temas))
SYS = ("Examinador de Direito Constitucional. Classifique CADA questão em UM dos 9 temas "
       "(o que MELHOR a representa). SOMENTE JSON puro.\n\nTEMAS:\n" + tema_list +
       '\n\nFormato: {"results":[{"i":<i>,"t":<1-9>}]}')


def parse(t):
    t = re.sub(r"```(json)?", "", t); i, j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j+1])


def classify(batch):
    body = "\n\n".join(f"[i={i}] {txt[i][:650]}" for i in batch)
    pr = SYS + f"\n\n=== {len(batch)} QUESTOES ===\n" + body
    for at in range(3):
        try:
            r = subprocess.run(f'"{EXE}" -p --model sonnet --output-format text',
                               input=pr, capture_output=True, text=True, shell=True,
                               timeout=300, encoding="utf-8", errors="replace")
            d = parse(r.stdout)
            return {int(x["i"]): int(x["t"]) for x in d.get("results", [])}
        except Exception:
            if at == 2:
                return {}


allidx = anchors + heldout
batches = [allidx[i:i+60] for i in range(0, len(allidx), 60)]
lab = {}
with ThreadPoolExecutor(max_workers=6) as ex:
    for r in ex.map(classify, batches):
        lab.update(r)

# k-NN: anchors rotulados -> propaga
A_idx = [i for i in anchors if i in lab]
A_emb = E[A_idx]
A_lab = np.array([lab[i] for i in A_idx])


def knn_place(query_idx, k=15):
    sims = E[query_idx] @ A_emb.T  # (q, nA)
    out = []
    for row in sims:
        top = np.argpartition(-row, k)[:k]
        out.append(Counter(A_lab[top].tolist()).most_common(1)[0][0])
    return out


# pureza nova: held-out, k-NN vs rotulo IA direto
H = [i for i in heldout if i in lab]
place = knn_place(H)
ok = sum(1 for i, p in zip(H, place) if p == lab[i])
new_pur = round(100 * ok / max(1, len(H)), 1)

# propaga pras 31K -> nova distribuicao por tema
all_place = knn_place(list(range(N)))
dist = Counter(all_place)

res = {
    "baseline_cluster_to_tema_pct": 68.0,
    "fix_por_questao_knn_pct": new_pur,
    "heldout_avaliado": len(H),
    "anchors_rotulados": len(A_idx),
    "nova_distribuicao_temas": {temas[t-1]: f"{c:,} ({100*c//N}%)" for t, c in
                                sorted(dist.items(), key=lambda x: -x[1])},
}
(C / "_tax_fix_result.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(res, ensure_ascii=False, indent=1))
