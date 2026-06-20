"""Prep de taxonomia por matéria (genérico): all-years sample → embed → KMeans → digests.

A ÁRVORE se constrói da ESTRUTURA, e conceito SATURA (~11×), então uma amostra
representativa de TODOS os anos (cap) já contém todos os tópicos — inclusive os de prova
antiga. (A COLOCAÇÃO de cada questão, all-years, é fase separada.) Precisa do tunnel aberto.

Uso:  python _tax_prep.py "<materia exata do banco>" <slug>
"""
from __future__ import annotations
import io, json, sys, time
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse, unquote
import numpy as np
import psycopg2

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
MATERIA, SLUG = sys.argv[1], sys.argv[2]
CAP = 50000                       # amostra all-years p/ estrutura (satura)
MODEL = "voyage-3-lite"
CACHE = Path(r"D:\inventario-v2\_scale_probe\tax"); CACHE.mkdir(parents=True, exist_ok=True)
DAT, EMB, OUTJ = CACHE / f"{SLUG}.dat.json", CACHE / f"{SLUG}.emb.npy", CACHE / f"{SLUG}.clusters.json"


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")


def pull():
    if DAT.exists():
        d = json.loads(DAT.read_text(encoding="utf-8"))
        print(f"[pull] cache {len(d['ids'])}"); return d["ids"], d["txt"], d["ass"]
    p = urlparse(envval("DATABASE_URL"))
    conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                            password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                            sslmode="disable", connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("select setseed(0.42)")  # amostra determinística
    cur.execute("""
      select id, enunciado, alternativas, assunto from public.questoes
      where materia=%s and coalesce(anulada,false)=false
        and enunciado is not null and length(enunciado) > 20
      order by random() limit %s
    """, (MATERIA, CAP))
    ids, txt, ass = [], [], []
    for qid, enun, alts, a in cur.fetchall():
        al = " ".join(alts) if isinstance(alts, (list, tuple)) else ""
        ids.append(qid); txt.append((enun + " " + al)[:2000]); ass.append(a or "?")
    cur.close(); conn.close()
    DAT.write_text(json.dumps({"ids": ids, "txt": txt, "ass": ass}, ensure_ascii=False), encoding="utf-8")
    print(f"[pull] {len(ids)} questões de {MATERIA} (cap {CAP})"); return ids, txt, ass


def embed(txt):
    if EMB.exists():
        E = np.load(EMB)
        if len(E) == len(txt):
            print(f"[embed] cache {E.shape}"); return E
    import voyageai
    vo = voyageai.Client(api_key=envval("VOYAGE_API_KEY"))
    vecs, t0 = [], time.time()
    for i in range(0, len(txt), 128):
        for at in range(5):
            try:
                vecs.extend(vo.embed(txt[i:i + 128], model=MODEL, input_type="document").embeddings); break
            except Exception:
                if at == 4: raise
                time.sleep(2 * (at + 1))
        if (i // 128) % 25 == 0:
            print(f"   embed {i}/{len(txt)} ({time.time()-t0:.0f}s)")
    E = np.asarray(vecs, dtype=np.float32)
    E /= (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
    np.save(EMB, E); print(f"[embed] {E.shape}"); return E


ids, txt, ass = pull()
E = embed(txt)
from sklearn.cluster import KMeans
K = min(45, max(24, round(len(E) / 1500)))  # K escala com o tamanho
print(f"[cluster] KMeans k={K} em {len(E)} questões…")
km = KMeans(n_clusters=K, n_init=4, random_state=0)
lab = km.fit_predict(E)

clusters = []
for c in range(K):
    idx = np.where(lab == c)[0]
    if len(idx) == 0:
        continue
    cnt = Counter(ass[i] for i in idx).most_common(5)
    cen = km.cluster_centers_[c]; cen = cen / (np.linalg.norm(cen) + 1e-9)
    top = idx[np.argsort(-(E[idx] @ cen))[:4]]
    clusters.append({"id": int(c), "size": int(len(idx)),
                     "top_assuntos": [[a, int(n)] for a, n in cnt],
                     "samples": [txt[i][:180] for i in top]})
clusters.sort(key=lambda x: -x["size"])
OUTJ.write_text(json.dumps({"materia": MATERIA, "slug": SLUG, "total_amostra": len(ids),
                            "k": K, "clusters": clusters}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"[ok] {len(clusters)} clusters → {OUTJ}")
