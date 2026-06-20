"""Prototipo de taxonomia PROPRIA (de baixo pra cima) p/ Direito Constitucional.
Puxa questoes 2020-2025, embeda, clusteriza em K micro-grupos, e resume cada cluster
(tamanho, assuntos TEC predominantes, exemplos representativos) -> _tax_clusters.json.
A IA depois organiza esses clusters numa arvore tema->subtema."""
from __future__ import annotations
import json, sys, time
from pathlib import Path
from urllib.parse import urlparse, unquote
from collections import Counter
import numpy as np
import psycopg2

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

MATERIA = "Direito Constitucional"
K = 30
CACHE = Path(r"D:\inventario-v2\_scale_probe")
EMB = CACHE / "dconst.emb.npy"
DAT = CACHE / "dconst.dat.json"
OUTJ = CACHE / "_tax_clusters.json"
MODEL = "voyage-3-lite"


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")
    return None


def pull():
    if DAT.exists():
        d = json.loads(DAT.read_text(encoding="utf-8"))
        print(f"[pull] cache {len(d['ids'])}")
        return d["ids"], d["txt"], d["ass"]
    p = urlparse(envval("DATABASE_URL"))
    conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                            password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                            sslmode="disable", connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""
      select id, enunciado, alternativas, assunto from public.questoes
      where materia=%s and ano between 2020 and 2025 and coalesce(anulada,false)=false
        and enunciado is not null and length(enunciado)>20
    """, (MATERIA,))
    ids, txt, ass = [], [], []
    for qid, enun, alts, a in cur.fetchall():
        al = " ".join(alts) if isinstance(alts, (list, tuple)) else ""
        ids.append(qid); txt.append((enun + " " + al)[:2000]); ass.append(a or "?")
    cur.close(); conn.close()
    DAT.write_text(json.dumps({"ids": ids, "txt": txt, "ass": ass}, ensure_ascii=False), encoding="utf-8")
    print(f"[pull] {len(ids)} questoes de {MATERIA}")
    return ids, txt, ass


def embed(txt):
    if EMB.exists():
        E = np.load(EMB)
        if len(E) == len(txt):
            print(f"[embed] cache {E.shape}")
            return E
    import voyageai
    vo = voyageai.Client(api_key=envval("VOYAGE_API_KEY"))
    vecs = []; t0 = time.time()
    for i in range(0, len(txt), 128):
        for at in range(4):
            try:
                vecs.extend(vo.embed(txt[i:i+128], model=MODEL, input_type="document").embeddings); break
            except Exception as e:
                if at == 3: raise
                time.sleep(2*(at+1))
        if (i//128) % 20 == 0:
            print(f"   {i}/{len(txt)} ({time.time()-t0:.0f}s)")
    E = np.asarray(vecs, dtype=np.float32)
    E /= (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
    np.save(EMB, E)
    print(f"[embed] {E.shape}")
    return E


ids, txt, ass = pull()
E = embed(txt)
from sklearn.cluster import KMeans
print(f"[cluster] KMeans k={K} em {len(E)} questoes...")
km = KMeans(n_clusters=K, n_init=4, random_state=0)
lab = km.fit_predict(E)

clusters = []
for c in range(K):
    idx = np.where(lab == c)[0]
    if len(idx) == 0:
        continue
    # assuntos TEC predominantes
    cnt = Counter(ass[i] for i in idx).most_common(5)
    # 4 exemplos mais proximos do centroide
    cen = km.cluster_centers_[c]
    cen = cen / (np.linalg.norm(cen) + 1e-9)
    sims = E[idx] @ cen
    top = idx[np.argsort(-sims)[:4]]
    samples = [txt[i][:180] for i in top]
    clusters.append({
        "id": int(c), "size": int(len(idx)),
        "top_assuntos": [[a, int(n)] for a, n in cnt],
        "samples": samples,
    })

clusters.sort(key=lambda x: -x["size"])
OUTJ.write_text(json.dumps({"materia": MATERIA, "total": len(ids), "k": K, "clusters": clusters},
                           ensure_ascii=False, indent=1), encoding="utf-8")
print(f"[ok] {len(clusters)} clusters -> {OUTJ}")
for cl in clusters[:8]:
    print(f"   c{cl['id']:>2} ({cl['size']:>4}q): {cl['top_assuntos'][0][0][:50]}")
