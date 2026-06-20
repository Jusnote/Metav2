"""Mede SATURACAO DE PEGADINHA a partir das extracoes (peg_out/traps-*.json).

A pergunta: conforme analisamos mais questoes, a descoberta de ARMADILHA DISTINTA
achata? Se sim, 'triar barato + escalar so o novo' corta custo (a maioria das
questoes novas so recombina armadilhas ja vistas). Se nao, custo e linear.

Metodo: embeda as frases 'confusao', clusteriza (mesma armadilha => mesmo cluster),
e calcula curva de saturacao + set-cover sobre as questoes.
"""
from __future__ import annotations
import json, sys, random
from pathlib import Path
from collections import defaultdict, Counter
import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CACHE = Path(r"D:\inventario-v2\_scale_probe")
PEG_OUT = CACHE / "peg_out_cli"
EMB_NPY = CACHE / "peg_confusao_cli.emb.npy"
MODEL = "voyage-3-lite"


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")
    return None


# ---- 1) carregar extracoes ----
q_traps = defaultdict(list)   # qid -> list de indices na lista flat
flat_conf, flat_tipo, flat_qid = [], [], []
tipos = Counter()
files = sorted(PEG_OUT.glob("traps-*.json"))
bad = 0
for f in files:
    try:
        d = json.loads(f.read_text(encoding="utf-8-sig"))
    except Exception as e:
        bad += 1
        print(f"   [warn] {f.name} invalido: {e}")
        continue
    for r in d.get("results", []):
        qid = r.get("id")
        for t in r.get("traps", []):
            c = (t.get("confusao") or "").strip()
            if not c:
                continue
            q_traps[qid].append(len(flat_conf))
            flat_conf.append(c)
            flat_tipo.append(t.get("tipo", "?"))
            flat_qid.append(qid)
            tipos[t.get("tipo", "?")] += 1

nq = len(q_traps)
nt = len(flat_conf)
print(f"[carga] {len(files)} arquivos ({bad} ruins) | {nq} questoes | {nt} traps brutas")
print(f"[carga] traps/questao media: {nt/max(1,nq):.2f}")
print(f"[carga] tipos: {dict(tipos)}")
if nt == 0:
    sys.exit("nenhuma trap extraida — verificar workflow")


# ---- 2) embed das frases 'confusao' (cache) ----
def embed(texts):
    if EMB_NPY.exists():
        E = np.load(EMB_NPY)
        if len(E) == len(texts):
            print(f"[embed] cache {E.shape}")
            return E
    import voyageai, time
    vo = voyageai.Client(api_key=envval("VOYAGE_API_KEY"))
    vecs = []
    B = 128
    for i in range(0, len(texts), B):
        for attempt in range(4):
            try:
                r = vo.embed(texts[i:i+B], model=MODEL, input_type="document")
                vecs.extend(r.embeddings); break
            except Exception as e:
                if attempt == 3: raise
                time.sleep(2*(attempt+1))
    E = np.asarray(vecs, dtype=np.float32)
    E /= (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
    np.save(EMB_NPY, E)
    print(f"[embed] {E.shape} salvo")
    return E

E = embed(flat_conf)


# ---- 3) clusterizar traps (mesma armadilha => mesmo cluster) ----
def leader(E, radius, order):
    n, dim = E.shape
    buf = np.empty((n, dim), dtype=np.float32)  # preallocado (evita vstack lento)
    k = 0
    assign = np.full(n, -1, np.int32)
    for idx in order:
        v = E[idx]
        if k:
            s = buf[:k] @ v
            j = int(np.argmax(s))
            if s[j] >= radius:
                assign[idx] = j; continue
        assign[idx] = k
        buf[k] = v; k += 1
    return assign, k

order_fixed = list(range(nt))
print("\n[armadilhas distintas por raio]")
chosen_assign = None
for radius in [0.92, 0.88, 0.85, 0.80, 0.75]:
    assign, k = leader(E, radius, order_fixed)
    print(f"   raio cos>= {radius}: {k:>5} armadilhas distintas  (de {nt} brutas => {nt/max(1,k):.1f}x)")
    if abs(radius - 0.85) < 1e-6:
        chosen_assign = assign
        K_CHOSEN = k

# ---- 4) por questao: conjunto de clusters de armadilha (no raio escolhido) ----
qid_list = list(q_traps.keys())
q_clusters = {q: set(chosen_assign[i] for i in idxs) for q, idxs in q_traps.items()}

# ---- 5) saturacao: ordem aleatoria, media ----
def q_to_clusters():
    return q_clusters

def sat_curve(order):
    seen = set(); curve = []
    for q in order:
        seen |= q_clusters[q]
        curve.append(len(seen))
    return curve

reps = 5
rng = random.Random(0)
curves = []
for _ in range(reps):
    o = qid_list[:]; rng.shuffle(o)
    curves.append(sat_curve(o))
avg = np.mean(np.array(curves), axis=0)
TOT = avg[-1]
print(f"\n[saturacao de ARMADILHA]  (raio 0.85, {int(TOT)} armadilhas distintas, ordem aleat., media {reps})")
marks = [100, 250, 500, 750, 1000, 1250, 1500, 1750, nq]
prev = 0
for m in marks:
    if m <= nq:
        novas = avg[m-1] - prev
        print(f"   ate {m:>4} q: {avg[m-1]:6.0f} armadilhas ({100*avg[m-1]/TOT:3.0f}%) | novas no bloco: +{novas:.0f}")
        prev = avg[m-1]

# taxa de descoberta inicio vs fim (por 250 q)
if nq > 600:
    blk = 250
    rate_ini = avg[blk-1] - avg[0]
    rate_fim = avg[nq-1] - avg[max(0, nq-1-blk)]
    queda = 100*(1 - rate_fim/max(1e-9, rate_ini))
    print(f"\n   descoberta por ~{blk}q:  inicio +{rate_ini:.0f}  ->  fim +{rate_fim:.0f}  "
          f"(queda {queda:.0f}%)")
    print(f"   => {'ACHATA (novelty-routing economiza!)' if queda >= 40 else 'NAO achata o suficiente (custo ~linear)'}")

# ---- 6) set-cover: min questoes p/ cobrir todas as armadilhas ----
def greedy_cover():
    cl2q = defaultdict(set)
    for q, cs in q_clusters.items():
        for c in cs: cl2q[c].add(q)
    remaining = set(range(K_CHOSEN)); chosen = []
    qsets = {q: set(cs) for q, cs in q_clusters.items()}
    while remaining:
        best, gain = None, 0
        for q, cs in qsets.items():
            g = len(cs & remaining)
            if g > gain: gain, best = g, q
        if not best: break
        chosen.append(best); remaining -= qsets[best]
    return len(chosen)

cover = greedy_cover()
print(f"\n[set-cover] {cover} questoes cobrem TODAS as {K_CHOSEN} armadilhas "
      f"(de {nq} = {100*cover/nq:.0f}%)  => teto de reducao {nq/max(1,cover):.1f}x")
