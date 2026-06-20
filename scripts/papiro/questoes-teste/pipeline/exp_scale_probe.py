"""EXPERIMENTO escala — a riqueza (pegadinha) ACHATA em volume?

Proxy barato via embeddings: pega um assunto juridico de alto volume, embeda,
e mede (1) reciclagem literal de questao, (2) contagem de 'conteudo distinto'
por raio de similaridade, (3) curva de saturacao (novos lideres vs nº de questoes).

Tudo cacheado em disco — re-rodar nao re-paga embeddings. Read-only no banco.
"""
from __future__ import annotations
import json, sys, time, random
from pathlib import Path
from urllib.parse import urlparse, unquote
import numpy as np
import psycopg2

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ASSUNTO_LIKE = "Dos Direitos e Deveres Individuais e Coletivos%"
MODEL = "voyage-3-lite"
CACHE = Path(r"D:\inventario-v2\_scale_probe")
CACHE.mkdir(parents=True, exist_ok=True)
SLUG = "art5-cf"
EMB_NPY = CACHE / f"{SLUG}.emb.npy"
IDS_JSON = CACHE / f"{SLUG}.ids.json"
TXT_JSON = CACHE / f"{SLUG}.txt.json"


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")
    return None


# ---------- 1) pull (cacheado) ----------
def pull():
    if TXT_JSON.exists() and IDS_JSON.exists():
        ids = json.loads(IDS_JSON.read_text(encoding="utf-8"))
        txt = json.loads(TXT_JSON.read_text(encoding="utf-8"))
        print(f"[pull] cache: {len(ids)} questoes")
        return ids, txt
    p = urlparse(envval("DATABASE_URL"))
    conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                            password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                            sslmode="disable", connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""
      select id, enunciado, alternativas
      from public.questoes
      where assunto ilike %s and coalesce(anulada,false)=false
        and enunciado is not null and length(enunciado) > 20
      order by id
    """, (ASSUNTO_LIKE,))
    ids, txt = [], []
    for qid, enun, alts in cur.fetchall():
        a = " || ".join(alts) if isinstance(alts, (list, tuple)) else (alts or "")
        s = (enun + " ALT: " + a)[:3000]
        ids.append(qid)
        txt.append(s)
    cur.close(); conn.close()
    IDS_JSON.write_text(json.dumps(ids), encoding="utf-8")
    TXT_JSON.write_text(json.dumps(txt, ensure_ascii=False), encoding="utf-8")
    print(f"[pull] {len(ids)} questoes do banco")
    return ids, txt


# ---------- 2) embed (cacheado) ----------
def embed(txt):
    if EMB_NPY.exists():
        E = np.load(EMB_NPY)
        if len(E) == len(txt):
            print(f"[embed] cache: {E.shape}")
            return E
    import voyageai
    vo = voyageai.Client(api_key=envval("VOYAGE_API_KEY"))
    vecs = []
    B = 128
    t0 = time.time()
    for i in range(0, len(txt), B):
        batch = txt[i:i + B]
        for attempt in range(4):
            try:
                r = vo.embed(batch, model=MODEL, input_type="document")
                vecs.extend(r.embeddings)
                break
            except Exception as e:
                if attempt == 3:
                    raise
                print(f"   retry {i} ({e.__class__.__name__})")
                time.sleep(2 * (attempt + 1))
        if (i // B) % 10 == 0:
            print(f"   embed {i+len(batch)}/{len(txt)}  ({time.time()-t0:.0f}s)")
    E = np.asarray(vecs, dtype=np.float32)
    E /= (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
    np.save(EMB_NPY, E)
    print(f"[embed] {E.shape} salvo")
    return E


# ---------- 3) medidas ----------
def leader_clusters(E, radius_cos, order):
    """Greedy leader clustering: novo lider se nao houver lider dentro do raio.
    radius_cos = limiar de similaridade (>= => mesmo cluster). Retorna lista de
    indices-lider e o vetor de atribuicao."""
    leaders = []  # indices
    Lmat = np.empty((0, E.shape[1]), dtype=np.float32)
    assign = np.full(len(E), -1, dtype=np.int32)
    growth = []  # nº de lideres apos cada questao (na ordem dada)
    for step, idx in enumerate(order, 1):
        v = E[idx]
        if Lmat.shape[0]:
            sims = Lmat @ v
            j = int(np.argmax(sims))
            if sims[j] >= radius_cos:
                assign[idx] = j
                growth.append(len(leaders))
                continue
        leaders.append(idx)
        Lmat = np.vstack([Lmat, v[None, :]])
        assign[idx] = len(leaders) - 1
        growth.append(len(leaders))
    return leaders, assign, growth


def main():
    ids, txt = pull()
    E = embed(txt)
    n = len(E)
    print(f"\n=== ASSUNTO: art.5º CF | {n} questoes | modelo {MODEL} ===")

    # (a) reciclagem literal: para cada questao, maior similaridade com QUALQUER outra
    # (vizinho mais proximo). Faz em blocos pra nao estourar memoria.
    print("\n[vizinho mais proximo] calculando...")
    maxsim = np.zeros(n, dtype=np.float32)
    Bk = 1024
    for i in range(0, n, Bk):
        block = E[i:i+Bk]
        S = block @ E.T            # (b, n)
        for r in range(block.shape[0]):
            S[r, i + r] = -1.0     # zera auto-similaridade
        maxsim[i:i+block.shape[0]] = S.max(axis=1)
    for thr in [0.99, 0.97, 0.95, 0.92, 0.90, 0.85]:
        frac = float((maxsim >= thr).mean())
        print(f"   tem irmao com cos>= {thr}: {frac*100:5.1f}%  ({int(frac*n)} questoes)")

    # (b) contagem de 'conteudo distinto' por raio (ordem fixa por id) + reducao
    print("\n[clusters por raio]  (quantas 'coisas distintas' ha de fato)")
    order_fixed = list(range(n))
    for radius in [0.97, 0.93, 0.90, 0.85, 0.80]:
        leaders, assign, _ = leader_clusters(E, radius, order_fixed)
        k = len(leaders)
        print(f"   raio cos>= {radius}:  {k:>5} clusters  =>  reducao {n/k:4.1f}x  "
              f"(maior cluster: {int(np.bincount(assign).max())})")

    # (c) curva de saturacao (ordem aleatoria, media 3) no raio 0.90
    print("\n[saturacao]  novos clusters acumulados (raio 0.90, ordem aleatoria, media 3)")
    RAD = 0.90
    reps = 3
    rng = random.Random(0)
    curves = []
    for _ in range(reps):
        order = list(range(n)); rng.shuffle(order)
        _, _, growth = leader_clusters(E, RAD, order)
        curves.append(growth)
    avg = np.mean(np.array(curves), axis=0)
    total_k = avg[-1]
    marks = [500, 1000, 2000, 3000, 4000, 5000, 6000, n]
    prev = 0
    for m in marks:
        if m <= n:
            novos = avg[m-1] - prev
            print(f"   ate {m:>5} q: {avg[m-1]:6.0f} clusters distintos "
                  f"({100*avg[m-1]/total_k:3.0f}% do total) | novos no ultimo bloco: +{novos:.0f}")
            prev = avg[m-1]
    # taxa de descoberta: clusters por 1000 q no inicio vs no fim
    rate_ini = (avg[999] - avg[0]) / 1.0 if n > 1000 else None
    rate_fim = (avg[n-1] - avg[max(0, n-1001)]) / 1.0 if n > 1000 else None
    if rate_ini:
        print(f"\n   descoberta por ~1000q:  inicio ~{rate_ini:.0f}  ->  fim ~{rate_fim:.0f}  "
              f"(queda {100*(1-rate_fim/max(1,rate_ini)):.0f}% = quanto achatou)")


if __name__ == "__main__":
    main()
