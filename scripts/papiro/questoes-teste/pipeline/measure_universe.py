"""Explora o universo de questoes pra dimensionar o lancamento.
Pre-requisito: tunnel SSH aberto (ssh -L 5433:127.0.0.1:5433 root@95.217.197.95).
Passo 1 (este): lista top bancas + materias com contagem, pra mapear o escopo real."""
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

VALIDAS = """
  AND COALESCE(anulada, false) = false
  AND COALESCE(desatualizada, false) = false
  AND gabarito_correto IS NOT NULL
  AND ano BETWEEN %(ano_min)s AND %(ano_max)s
"""


def tunnel_aberto() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 5433), timeout=2):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def read_database_url() -> str:
    env = dotenv_values(str(VERUS_API_ENV))
    url = env.get("DATABASE_URL", "")
    return re.sub(r"^postgresql\+psycopg2://", "postgresql://", url)


def main() -> int:
    if not tunnel_aberto():
        print("TUNNEL FECHADO. Abra: ssh -L 5433:127.0.0.1:5433 root@95.217.197.95")
        return 1
    conn = psycopg2.connect(read_database_url(), connect_timeout=5)
    params = {"ano_min": ANO_MIN, "ano_max": ANO_MAX}
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        print(f"=== UNIVERSO VALIDO {ANO_MIN}-{ANO_MAX} (anulada=false, desatualizada=false, gab NOT NULL) ===")
        cur.execute(f"SELECT COUNT(*) n FROM questoes WHERE true {VALIDAS}", params)
        print(f"Total valido no periodo: {cur.fetchone()['n']:,}\n")

        print("=== TOP 20 BANCAS ===")
        cur.execute(f"""
            SELECT banca, COUNT(*) n FROM questoes
            WHERE banca IS NOT NULL {VALIDAS}
            GROUP BY banca ORDER BY n DESC LIMIT 20
        """, params)
        for r in cur.fetchall():
            print(f"  {r['n']:>8,}  {r['banca']}")

        print("\n=== MATERIAS (todas, por volume) ===")
        cur.execute(f"""
            SELECT materia, COUNT(*) n FROM questoes
            WHERE materia IS NOT NULL {VALIDAS}
            GROUP BY materia ORDER BY n DESC
        """, params)
        for r in cur.fetchall():
            print(f"  {r['n']:>8,}  {r['materia']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
