"""Conta o universo no escopo de lancamento: top-10 bancas, 2018-2025,
materias = todos os Direito* + Portugues + Matematica + RLM + Contabilidade.
Mostra a quebra por materia e estima folhas (proxy: ~50 questoes/folha) e custo."""
import re
import socket
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

VERUS_API_ENV = Path(r"D:/verus_api/.env")
ANO_MIN, ANO_MAX = 2018, 2025

BANCAS_TOP10 = [
    "VUNESP", "CEBRASPE (CESPE)", "FGV", "QUADRIX", "FUNDATEC",
    "Instituto AOCP", "Instituto Consulplan", "AVANÇASP", "IBFC", "FEPESE",
]
MATERIAS_FIXAS = [
    "Língua Portuguesa (Português)", "Matemática", "Raciocínio Lógico", "Contabilidade Geral",
]

VALIDAS = """
  AND COALESCE(anulada, false) = false
  AND COALESCE(desatualizada, false) = false
  AND gabarito_correto IS NOT NULL
  AND ano BETWEEN %(ano_min)s AND %(ano_max)s
  AND banca = ANY(%(bancas)s)
"""


def tunnel_aberto() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 5433), timeout=2):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def read_database_url() -> str:
    env = dotenv_values(str(VERUS_API_ENV))
    return re.sub(r"^postgresql\+psycopg2://", "postgresql://", env.get("DATABASE_URL", ""))


def main() -> int:
    if not tunnel_aberto():
        print("TUNNEL FECHADO. Abra: ssh -L 5433:127.0.0.1:5433 root@95.217.197.95")
        return 1
    conn = psycopg2.connect(read_database_url(), connect_timeout=5)
    p = {"ano_min": ANO_MIN, "ano_max": ANO_MAX, "bancas": BANCAS_TOP10}
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"""
            SELECT materia, COUNT(*) n FROM questoes
            WHERE (materia LIKE 'Direito%%' OR materia = ANY(%(fixas)s)) {VALIDAS}
            GROUP BY materia ORDER BY n DESC
        """, {**p, "fixas": MATERIAS_FIXAS})
        rows = cur.fetchall()
        total = sum(r["n"] for r in rows)
        print(f"=== ESCOPO: top-10 bancas | {ANO_MIN}-{ANO_MAX} | Direito* + Pt + Mat + RLM + Contab ===\n")
        for r in rows:
            print(f"  {r['n']:>8,}  {r['materia']}")
        print(f"\n  {'-'*40}")
        print(f"  TOTAL no escopo: {total:,} questoes")
        folhas = total / 50
        print(f"\n  Estimativas (proxy ~50 questoes/folha):")
        print(f"    ~folhas:        {folhas:,.0f}")
        print(f"    ~tokens (Opus): {total/50*470_000/1e6:,.1f} M  (~470K/folha v2)")
        print(f"    ~custo API/Batch (~$1,5/folha): ${folhas*1.5:,.0f}")
        print(f"    ~tempo no Max (~100 folhas/mes): {folhas/100:,.1f} meses")
    return 0


if __name__ == "__main__":
    sys.exit(main())
