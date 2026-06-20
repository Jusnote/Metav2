"""Cenario do Aldemir: 2020-2025 + bancas principais. Tamanho da fila + cobertura."""
from __future__ import annotations
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2

CACHE = Path(r"D:\inventario-v2\_scale_probe")
OUTF = CACHE / "_incidencia2.txt"
L = []
def P(s): L.append(str(s))

BANCAS = ['FGV', 'CEBRASPE', 'VUNESP', 'FCC', 'QUADRIX']  # principais


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")
    return None


p = urlparse(envval("DATABASE_URL"))
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                        password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                        sslmode="disable", connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()

V = "coalesce(anulada,false)=false and assunto is not null and length(trim(assunto))>0"
flt = f"{V} and ano between 2020 and 2025 and banca = any(%s)"

cur.execute(f"select count(*) from questoes where {flt}", (BANCAS,))
tot = cur.fetchone()[0]
P(f"[2020-2025 + bancas {BANCAS}]: {tot:,} questoes")

cur.execute(f"""select assunto, count(*) c from questoes where {flt}
               group by assunto order by c desc""", (BANCAS,))
rows = cur.fetchall()
P(f"[assuntos distintos]: {len(rows):,}")
P("\n[cobertura cumulativa nesse filtro]")
acc = 0; marks = [0.5, 0.7, 0.8, 0.9]; mi = 0
for i, (a, c) in enumerate(rows, 1):
    acc += c
    while mi < len(marks) and acc / tot >= marks[mi]:
        P(f"   top {i:>5} assuntos = {100*marks[mi]:.0f}%  ({acc:,} questoes)")
        mi += 1

P("\n[TOP 40 assuntos da fila]")
for a, c in rows[:40]:
    P(f"   {c:>6,}  {(a or '')[:62]}")

cur.close(); conn.close()
OUTF.write_text("\n".join(L), encoding="utf-8")
print("ok")
