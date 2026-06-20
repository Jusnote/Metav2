"""A/B controlado de EMBEDDING p/ a taxonomia de DConst.
Mesmas labels da IA (Sonnet); troca SO o embedding (voyage-3-lite vs voyage-4-large).
Mede pureza de colocacao (k-NN vs rotulo IA) + silhueta. Escreve _tax_ab_result.json."""
from __future__ import annotations
import json, sys, re, shutil, subprocess, random, time
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
E_lite = np.load(C / "dconst.emb.npy")  # voyage-3-lite, 512
temas = [t["tema"] for t in json.loads((C / "_tax_final.json").read_text(encoding="utf-8"))["taxonomia"]]
descs = {t["tema"]: t["descricao"] for t in json.loads((C / "_tax_final.json").read_text(encoding="utf-8"))["taxonomia"]}
EXE = shutil.which("claude.cmd") or shutil.which("claude")
N = len(E_lite)


def env(k, p=r"D:/verus_api/.env"):
    for l in open(p, encoding="utf-8", errors="replace"):
        if l.strip().startswith(k + "="):
            return l.split("=", 1)[1].strip().strip('"').strip("'")


def norm(E):
    return E / (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)


# ---- embed voyage-4-large (cache) ----
def embed_large():
    f = C / "dconst.v4large.emb.npy"
    if f.exists():
        E = np.load(f)
        if len(E) == N:
            print(f"[v4large] cache {E.shape}"); return E
    import voyageai
    vo = voyageai.Client(api_key=env("VOYAGE_API_KEY"))
    vecs = []; t0 = time.time()
    for i in range(0, N, 128):
        for at in range(5):
            try:
                vecs.extend(vo.embed(txt[i:i+128], model="voyage-4-large", input_type="document").embeddings); break
            except Exception as e:
                if at == 4: raise
                time.sleep(2*(at+1))
        if (i//128) % 30 == 0:
            print(f"   v4large {i}/{N} ({time.time()-t0:.0f}s)")
    E = np.asarray(vecs, dtype=np.float32)
    np.save(f, E)
    print(f"[v4large] {E.shape}")
    return E


E_large = embed_large()

# ---- rotular amostra com Sonnet (uma vez, cache) ----
tema_list = "\n".join(f"{i+1}. {t} — {descs[t][:85]}" for i, t in enumerate(temas))
SYS = ("Examinador de Direito Constitucional. Classifique CADA questao em UM dos 9 temas. "
       "SOMENTE JSON puro.\n\nTEMAS:\n" + tema_list + '\n\nFormato: {"results":[{"i":<i>,"t":<1-9>}]}')


def parse(t):
    t = re.sub(r"```(json)?", "", t); i, j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j+1])


def classify(batch):
    body = "\n\n".join(f"[i={i}] {txt[i][:650]}" for i in batch)
    pr = SYS + f"\n\n=== {len(batch)} QUESTOES ===\n" + body
    for at in range(3):
        try:
            r = subprocess.run(f'"{EXE}" -p --model sonnet --output-format text', input=pr,
                               capture_output=True, text=True, shell=True, timeout=300,
                               encoding="utf-8", errors="replace")
            return {int(x["i"]): int(x["t"]) for x in parse(r.stdout).get("results", [])}
        except Exception:
            if at == 2: return {}


LABF = C / "_ab_labels.json"
rng = random.Random(7)
pool = rng.sample(range(N), 1700)
anchors, heldout = pool[:1300], pool[1300:]
if LABF.exists():
    lab = {int(k): v for k, v in json.loads(LABF.read_text(encoding="utf-8")).items()}
    print(f"[label] cache {len(lab)}")
else:
    batches = [pool[i:i+40] for i in range(0, len(pool), 40)]
    lab = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for r in ex.map(classify, batches):
            lab.update(r)
    LABF.write_text(json.dumps(lab), encoding="utf-8")
    print(f"[label] {len(lab)} rotuladas")


def knn_purity_and_dist(E):
    E = norm(E)
    A = [i for i in anchors if i in lab]
    Ae, Al = E[A], np.array([lab[i] for i in A])
    H = [i for i in heldout if i in lab]
    sims = E[H] @ Ae.T
    ok = 0
    for r, i in zip(sims, H):
        top = np.argpartition(-r, 15)[:15]
        if Counter(Al[top].tolist()).most_common(1)[0][0] == lab[i]:
            ok += 1
    pur = round(100 * ok / max(1, len(H)), 1)
    # distribuicao em todas
    sims_all = E @ Ae.T
    place = []
    for r in sims_all:
        top = np.argpartition(-r, 15)[:15]
        place.append(Counter(Al[top].tolist()).most_common(1)[0][0])
    dist = Counter(place)
    return pur, len(H), dist


from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
def silh(E):
    E = norm(E)
    km = KMeans(n_clusters=30, n_init=3, random_state=0).fit(E)
    s = rng.sample(range(N), 4000)
    return round(float(silhouette_score(E[s], km.labels_[s], metric="cosine")), 3)


res = {"baseline_cluster_to_tema": 68.0}
for nome, E in [("voyage-3-lite(512)", E_lite), ("voyage-4-large(1024)", E_large)]:
    pur, h, dist = knn_purity_and_dist(E)
    res[nome] = {"pureza_colocacao_pct": pur, "heldout": h, "silhueta": silh(E)}
print(json.dumps(res, ensure_ascii=False, indent=1))
(C / "_tax_ab_result.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
