"""Prepara o COMPLEMENTO do art.5 (as ~5000 questoes que ainda nao foram extraidas),
em lotes numerados a partir de 20, na MESMA pasta peg_batches/ — assim o extrator
pula as 00-19 (ja feitas em peg_out_cli) e faz so o resto. Objetivo: cobrir as 7029.
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
START_IDX = 20          # batches 00-19 ja existem (amostra de 2000)
PER = 100


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")
    return None


ids_all = json.loads(IDS_JSON.read_text(encoding="utf-8"))
# reproduz EXATAMENTE a amostra ja feita (mesmo seed) p/ achar o complemento
rng = random.Random(0)
done = set(rng.sample(ids_all, min(2000, len(ids_all))))
rest = [i for i in ids_all if i not in done]
print(f"[prep-full] total={len(ids_all)} | ja feitas={len(done)} | complemento={len(rest)}")

p = urlparse(envval("DATABASE_URL"))
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                        password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                        sslmode="disable", connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()
cur.execute("""
  select id, enunciado, alternativas, gabarito_correto
  from public.questoes where id = any(%s)
""", (rest,))
rows = {r[0]: r for r in cur.fetchall()}
cur.close(); conn.close()

items = []
for qid in rest:
    if qid not in rows:
        continue
    _, enun, alts, gab = rows[qid]
    enun = (enun or "")[:1500]
    alts = list(alts) if isinstance(alts, (list, tuple)) else []
    linhas = []
    for i, a in enumerate(alts):
        marca = "  <<< CORRETA" if (gab is not None and i == gab) else ""
        linhas.append(f"  [{i}] {(a or '')[:400]}{marca}")
    items.append({"id": qid, "text": f"QUESTAO id={qid}\n{enun}\nALTERNATIVAS:\n" + "\n".join(linhas)})

print(f"[prep-full] {len(items)} questoes do complemento com dados")
nb = 0
for b, off in enumerate(range(0, len(items), PER)):
    idx = START_IDX + b
    (OUT / f"batch-{idx:02d}.json").write_text(
        json.dumps(items[off:off+PER], ensure_ascii=False), encoding="utf-8")
    nb += 1
print(f"[prep-full] {nb} lotes novos escritos (batch-{START_IDX:02d}..batch-{START_IDX+nb-1:02d})")
