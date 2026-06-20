"""Prepara amostra p/ o teste de SATURACAO DE PEGADINHA.

Pega 2000 questoes reais do art.5 CF (com gabarito), monta o texto questao+alternativas
marcando a correta, e escreve 20 lotes em CACHE/peg_batches/ pro workflow de extracao.
"""
from __future__ import annotations
import json, random, sys
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CACHE = Path(r"D:\inventario-v2\_scale_probe")
IDS_JSON = CACHE / "art5-cf.ids.json"
OUT = CACHE / "peg_batches"
OUT.mkdir(parents=True, exist_ok=True)
N_SAMPLE = 2000
N_BATCHES = 20


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")
    return None


ids_all = json.loads(IDS_JSON.read_text(encoding="utf-8"))
rng = random.Random(0)
sample = rng.sample(ids_all, min(N_SAMPLE, len(ids_all)))
print(f"[prep] amostra {len(sample)} de {len(ids_all)} ids")

p = urlparse(envval("DATABASE_URL"))
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                        password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                        sslmode="disable", connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()
cur.execute("""
  select id, enunciado, alternativas, gabarito_correto
  from public.questoes where id = any(%s)
""", (sample,))
rows = {r[0]: r for r in cur.fetchall()}
cur.close(); conn.close()

items = []
for qid in sample:
    if qid not in rows:
        continue
    _, enun, alts, gab = rows[qid]
    enun = (enun or "")[:1500]
    alts = list(alts) if isinstance(alts, (list, tuple)) else []
    linhas = []
    for i, a in enumerate(alts):
        marca = "  <<< CORRETA" if (gab is not None and i == gab) else ""
        linhas.append(f"  [{i}] {(a or '')[:400]}{marca}")
    txt = f"QUESTAO id={qid}\n{enun}\nALTERNATIVAS:\n" + "\n".join(linhas)
    items.append({"id": qid, "text": txt})

print(f"[prep] {len(items)} questoes com dados completos")

# escreve em N lotes
per = (len(items) + N_BATCHES - 1) // N_BATCHES
for b in range(N_BATCHES):
    chunk = items[b * per:(b + 1) * per]
    if not chunk:
        continue
    (OUT / f"batch-{b:02d}.json").write_text(json.dumps(chunk, ensure_ascii=False), encoding="utf-8")
print(f"[prep] {N_BATCHES} lotes escritos em {OUT}")
