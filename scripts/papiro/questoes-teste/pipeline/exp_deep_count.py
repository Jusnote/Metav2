"""Conta o nº de questoes DEEP no plano 'deep ate teto por assunto' (sem classificacao).
Escopo do Aldemir: bancas principais + anos (Direito 2019-2026, outras 2015-2026) + materias.
deep_q = sum(min(tamanho_assunto, CAP)). So metadado (SQL), gratis."""
from __future__ import annotations
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

def env(k, p=r"D:/verus_api/.env"):
    for l in open(p, encoding="utf-8", errors="replace"):
        if l.strip().startswith(k + "="):
            return l.split("=", 1)[1].strip().strip('"').strip("'")

p = urlparse(env("DATABASE_URL"))
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                        password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                        sslmode="disable", connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()

BANCAS = ['%cespe%', '%cebraspe%', 'fgv', 'fcc', '%cesgranrio%', '%quadrix%', '%aocp%', '%fundatec%']
bw = " OR ".join(["banca ILIKE %s"] * len(BANCAS))

# grupos de materia (com janela de ano)
DIR = ['Direito Penal', 'Direito Processual Penal', 'Direito Civil', 'Direito Processual Civil',
       'Direito Administrativo', 'Direito Constitucional', 'Direito Tributário', 'Direitos Humanos']
DIR_LIKE = ['Legislação%Penal%']
OUT = ['Língua Portuguesa%', 'Contabilidade Geral%', 'Estatística%', 'Física%',
       'Matemática%', 'Raciocínio Lógico%', 'Informática%']
OUT_LIKE = ['%Tecnologia da Informação%']

def materia_sql():
    parts, ps = [], []
    for m in DIR: parts.append("(materia=%s AND ano between 2019 and 2026)"); ps.append(m)
    for m in DIR_LIKE: parts.append("(materia ILIKE %s AND ano between 2019 and 2026)"); ps.append(m)
    for m in OUT: parts.append("(materia ILIKE %s AND ano between 2015 and 2026)"); ps.append(m)
    for m in OUT_LIKE: parts.append("(materia ILIKE %s AND ano between 2015 and 2026)"); ps.append(m)
    return "(" + " OR ".join(parts) + ")", ps

mc, mps = materia_sql()
V = "coalesce(anulada,false)=false and assunto is not null and length(trim(assunto))>0"

def run(extra_mat=""):
    q = f"""
      with pa as (
        select materia, assunto, count(*) c from questoes
        where {V} and ({bw}) and {mc} {extra_mat}
        group by materia, assunto
      )
      select count(*) n_ass, sum(c) total_q,
             sum(least(c,250)) d250, sum(least(c,350)) d350, sum(least(c,500)) d500
      from pa
    """
    cur.execute(q, BANCAS + mps)
    return cur.fetchone()

def show(label, row):
    n, tot, d250, d350, d500 = [int(x) for x in row]
    print(f"\n[{label}]")
    print(f"  assuntos: {n:,} | total de questoes no escopo: {tot:,}")
    for cap, dq in [(250, d250), (350, d350), (500, d500)]:
        print(f"  CAP {cap}: deep = {dq:,} questoes ({100*dq//tot}% do total) | "
              f"resumo+comentado Opus ~${dq*0.093:,.0f} (Batch ~${dq*0.093/2:,.0f}) | "
              f"Max 5x ~{dq/6800:.1f} sem / 20x ~{dq/27000:.1f} sem")

# escopo todo
show("ESCOPO TODO (Direito+Port+Exatas+Info+Contab)", run())
# nucleo: so Direito + Contabilidade + Informatica (tira Portugues e exatas)
NUC = " and (materia ilike 'Direito%%' or materia ilike '%%Legisla%%Penal%%' or materia ilike '%%Direitos Humanos%%' or materia ilike 'Contabilidade Geral%%' or materia ilike 'Informática%%' or materia ilike '%%Tecnologia da Informação%%')"
show("NUCLEO (Direito + Contabilidade + Informatica)", run(NUC))
cur.close(); conn.close()
