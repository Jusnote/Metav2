"""Conta o ESCOPO definido pelo Aldemir (bancas + anos por grupo + materias).
Transparente: mostra quais bancas/materias casaram, e o total por materia.
So metadado (SQL), gratis."""
from __future__ import annotations
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUT = Path(r"D:\inventario-v2\_scale_probe\_scope.txt")
L = []
def P(s): L.append(str(s));

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

# bancas alvo (padroes ILIKE) — mostra o que casou
BANCA_PATS = ['%cespe%', '%cebraspe%', 'fgv', 'fcc', '%cesgranrio%', '%quadrix%', '%aocp%', '%fundatec%']
banca_where = " OR ".join(["banca ILIKE %s"] * len(BANCA_PATS))
cur.execute(f"select banca, count(*) c from questoes where ({banca_where}) group by banca order by c desc", BANCA_PATS)
bancas = cur.fetchall()
P("=== BANCAS que casaram ===")
for b, c in bancas:
    P(f"   {c:>8,}  {b}")
banca_vals = [b for b, _ in bancas]

# materias: grupo DIREITO (2019-2026) e OUTRAS (2015-2026)
DIREITO = ['Direito Penal', 'Direito Processual Penal', 'Direito Civil', 'Direito Processual Civil',
           'Direito Administrativo', 'Direito Constitucional', 'Direito Tributário',
           'Direitos Humanos']
DIREITO_LIKE = ['Legislação%Penal%']
OUTRAS = ['Língua Portuguesa%', 'Contabilidade Geral%', 'Estatística%', 'Física%',
          'Matemática%', 'Raciocínio Lógico%', 'Informática%']
OUTRAS_LIKE = ['%Tecnologia da Informação%']

def materia_clause():
    parts, params = [], []
    for m in DIREITO:
        parts.append("(materia = %s AND ano between 2019 and 2026)"); params.append(m)
    for m in DIREITO_LIKE:
        parts.append("(materia ILIKE %s AND ano between 2019 and 2026)"); params.append(m)
    for m in OUTRAS:
        parts.append("(materia ILIKE %s AND ano between 2015 and 2026)"); params.append(m)
    for m in OUTRAS_LIKE:
        parts.append("(materia ILIKE %s AND ano between 2015 and 2026)"); params.append(m)
    return "(" + " OR ".join(parts) + ")", params

mclause, mparams = materia_clause()
banca_in_where = " OR ".join(["banca ILIKE %s"] * len(BANCA_PATS))

q = f"""
  select materia, count(*) c from questoes
  where coalesce(anulada,false)=false
    and ({banca_in_where})
    and {mclause}
  group by materia order by c desc
"""
cur.execute(q, BANCA_PATS + mparams)
rows = cur.fetchall()
total = sum(c for _, c in rows)
P(f"\n=== MATERIAS no escopo (total {total:,} questoes) ===")
for m, c in rows:
    P(f"   {c:>8,}  {m}")

# custo/tempo
P(f"\n=== TRADUCAO ===")
P(f"   total escopo: {total:,} questoes")
P(f"   embeddings voyage-4-large: ~${total*500/1e6*0.12:,.0f}  (taxonomia)")
P(f"   resumo Opus API padrao (~$0.02/q): ~${total*0.02:,.0f}")
P(f"   resumo Opus + porteiro(~0.6) + Batch(-50%): ~${total*0.02*0.6*0.5:,.0f}")
P(f"   resumo na Max: R$0 (so tempo)")

cur.close(); conn.close()
OUT.write_text("\n".join(L), encoding="utf-8")
print("\n".join(L))
