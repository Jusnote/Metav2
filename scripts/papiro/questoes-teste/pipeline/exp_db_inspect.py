"""Inspeciona o banco (via tunnel 5433) p/ achar a tabela de questoes e assuntos de maior volume.
Nao imprime segredos. Read-only."""
from __future__ import annotations
import os, sys
from urllib.parse import urlparse, unquote
import psycopg2

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# ---- DATABASE_URL do verus_api/.env, forcando host/port do tunnel ----
def load_db_url(path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            v = line[len("DATABASE_URL="):].strip().strip('"').strip("'")
            return v
    raise RuntimeError("DATABASE_URL nao encontrada")

p = urlparse(load_db_url())
user = unquote(p.username or "")
pwd = unquote(p.password or "")
db = (p.path or "/postgres").lstrip("/")
print(f"[db] conectando como user='{user}' db='{db}' via tunnel 127.0.0.1:5433 (host original ocultado)")

conn = psycopg2.connect(host="127.0.0.1", port=5433, user=user, password=pwd, dbname=db,
                        sslmode="disable", connect_timeout=10)
conn.autocommit = True
cur = conn.cursor()

# 1) achar tabelas com 'quest' no nome
cur.execute("""
  select table_schema, table_name
  from information_schema.tables
  where table_name ilike '%quest%' and table_schema not in ('pg_catalog','information_schema')
  order by 1,2
""")
tabs = cur.fetchall()
print("[tabelas ~quest]:", tabs)

# escolher a principal: prefere schema public, nome exato 'questoes'
target = None
for sch, t in tabs:
    if t == "questoes":
        target = (sch, t)
        break
if not target and tabs:
    target = tabs[0]
print("[alvo]:", target)
if not target:
    sys.exit("nenhuma tabela de questoes encontrada")

sch, tbl = target
fq = f'"{sch}"."{tbl}"'

# 2) colunas
cur.execute("""
  select column_name, data_type from information_schema.columns
  where table_schema=%s and table_name=%s order by ordinal_position
""", (sch, tbl))
cols = cur.fetchall()
print(f"[colunas {fq}]:")
for c in cols:
    print("   ", c[0], c[1])

colnames = {c[0].lower() for c in cols}

# 3) total
cur.execute(f"select count(*) from {fq}")
print("[total questoes]:", cur.fetchone()[0])

# 4) achar coluna de assunto e materia
def pick(*cands):
    for c in cands:
        if c in colnames:
            return c
    return None

col_assunto = pick("nome_assunto", "nomeassunto", "assunto", "assunto_nome", "nomeassuntopredominante")
col_materia = pick("nome_materia", "nomemateria", "materia", "disciplina", "materia_nome")
col_enun = pick("enunciado", "texto", "enunciado_html")
col_alts = pick("alternativas", "alternativas_json", "opcoes")
print(f"[cols-chave] assunto={col_assunto} materia={col_materia} enunciado={col_enun} alternativas={col_alts}")

# 5) top assuntos por volume (se achou a coluna)
if col_assunto:
    q = f'select "{col_assunto}", count(*) c from {fq} group by 1 order by c desc limit 20'
    cur.execute(q)
    print("\n[TOP 20 assuntos por volume]:")
    for nome, c in cur.fetchall():
        s = (nome or "")[:60]
        print(f"   {c:>7,}  {s}")

cur.close(); conn.close()
