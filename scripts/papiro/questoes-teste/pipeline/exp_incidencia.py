"""INCIDENCIA = contar metadado (gratis, sem LLM). Monta a 'fila de processamento'
sem analisar nenhuma questao. Escreve relatorio em _incidencia.txt."""
from __future__ import annotations
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2

CACHE = Path(r"D:\inventario-v2\_scale_probe")
OUTF = CACHE / "_incidencia.txt"
L = []
def P(s): L.append(str(s))


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

cur.execute(f"select count(*) from questoes where {V}")
P(f"[universo valido (assunto preenchido, nao anulada)]: {cur.fetchone()[0]:,}")

cur.execute(f"select count(*) from questoes where {V} and ano between 2020 and 2025")
tot_2025 = cur.fetchone()[0]
P(f"[filtro 2020-2025]: {tot_2025:,}")

# por ano
cur.execute(f"select ano, count(*) c from questoes where {V} and ano between 2016 and 2025 group by ano order by ano")
P("\n[por ano]")
for ano, c in cur.fetchall():
    P(f"   {ano}: {c:,}")

# taxonomia node coverage
cur.execute(f"select count(*) filter (where taxonomia_node_id is not null), count(*) from questoes where {V} and ano between 2020 and 2025")
tn, tt = cur.fetchone()
P(f"\n[taxonomia_node_id preenchido em 2020-2025]: {tn:,}/{tt:,} ({100*tn/max(1,tt):.0f}%)")

# bancas (2020-2025)
cur.execute(f"select banca, count(*) c from questoes where {V} and ano between 2020 and 2025 group by banca order by c desc limit 15")
P("\n[TOP bancas 2020-2025] (escolha as principais aqui)")
for b, c in cur.fetchall():
    P(f"   {c:>8,}  {b}")

# materias (2020-2025)
cur.execute(f"select materia, count(*) c from questoes where {V} and ano between 2020 and 2025 group by materia order by c desc limit 15")
P("\n[TOP materias 2020-2025]")
for m, c in cur.fetchall():
    P(f"   {c:>8,}  {(m or '')[:50]}")

# ASSUNTOS com cobertura cumulativa (2020-2025) -> a FILA
cur.execute(f"""
  select assunto, count(*) c from questoes
  where {V} and ano between 2020 and 2025
  group by assunto order by c desc
""")
rows = cur.fetchall()
total = sum(c for _, c in rows)
P(f"\n[ASSUNTOS distintos em 2020-2025]: {len(rows):,}  | total questoes: {total:,}")
P("[cobertura cumulativa — quantos assuntos cobrem X% das questoes]")
acc = 0
marks = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]
mi = 0
for i, (a, c) in enumerate(rows, 1):
    acc += c
    while mi < len(marks) and acc / total >= marks[mi]:
        P(f"   top {i:>5} assuntos = {100*marks[mi]:.0f}% das questoes ({acc:,})")
        mi += 1
P("\n[TOP 25 assuntos (o inicio da fila)]")
for a, c in rows[:25]:
    P(f"   {c:>7,}  {(a or '')[:60]}")

cur.close(); conn.close()
OUTF.write_text("\n".join(L), encoding="utf-8")
print("ok ->", OUTF)
