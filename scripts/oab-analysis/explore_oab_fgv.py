"""
Análise exploratória OAB FGV — investiga quantas questões existem, distribuição
por matéria, e identifica como agrupar por exame.

Uso:
  DATABASE_URL=... python scripts/oab-analysis/explore_oab_fgv.py
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor


def fetch(cur, sql, params=None):
    if params is None:
        cur.execute(sql)
    else:
        cur.execute(sql, params)
    return cur.fetchall()


def section(n, title):
    print(f"\n{'=' * 70}")
    print(f"#{n} - {title}")
    print('=' * 70)


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        sys.exit("ERRO: defina DATABASE_URL no env")

    print("Conectando...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1) Total geral
    section(1, "Total de questoes na DB")
    total = fetch(cur, "SELECT COUNT(*) AS n FROM questoes")[0]['n']
    print(f"  {total:,} questoes totais")

    # 2) Distinct orgao values containing OAB
    section(2, "Valores de 'orgao' que contem OAB")
    orgaos_oab = fetch(cur, """
        SELECT orgao, orgao_nome, COUNT(*) AS n
        FROM questoes
        WHERE orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%'
        GROUP BY orgao, orgao_nome
        ORDER BY n DESC
        LIMIT 20
    """)
    for o in orgaos_oab:
        print(f"  orgao={(o['orgao'] or '(NULL)'):20} nome={(o['orgao_nome'] or '(NULL)'):40} n={o['n']:>6,}")

    # 3) Total OAB
    section(3, "Total OAB (qualquer banca)")
    oab_total = fetch(cur, """
        SELECT COUNT(*) AS n FROM questoes
        WHERE orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%'
    """)[0]['n']
    print(f"  {oab_total:,}")

    # 4) Bancas que aplicaram OAB
    section(4, "Bancas aplicadoras de OAB")
    bancas = fetch(cur, """
        SELECT banca, COUNT(*) AS n
        FROM questoes
        WHERE orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%'
        GROUP BY banca
        ORDER BY n DESC
    """)
    for b in bancas:
        print(f"  {(b['banca'] or '(NULL)'):20} {b['n']:>8,}")

    # 5) FGV+OAB
    section(5, "FGV+OAB total")
    fgv_oab = fetch(cur, """
        SELECT COUNT(*) AS n FROM questoes
        WHERE banca = 'FGV' AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
    """)[0]['n']
    print(f"  {fgv_oab:,}")

    # 6) FGV+OAB por materia
    section(6, "FGV+OAB por materia (top 30)")
    materias = fetch(cur, """
        SELECT materia, COUNT(*) AS n
        FROM questoes
        WHERE banca = 'FGV' AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY materia
        ORDER BY n DESC
        LIMIT 30
    """)
    for m in materias:
        print(f"  {(m['materia'] or '(NULL)'):45} {m['n']:>6,}")

    # 7) Identificar exame via concurso_id
    section(7, "Distintos concurso_id em FGV+OAB")
    n_concursos = fetch(cur, """
        SELECT COUNT(DISTINCT concurso_id) AS n,
               COUNT(DISTINCT concurso_id_externo) AS n_ext,
               COUNT(DISTINCT (ano, cargo)) AS n_anocargo
        FROM questoes
        WHERE banca = 'FGV' AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
    """)[0]
    print(f"  concurso_id distintos:           {n_concursos['n']}")
    print(f"  concurso_id_externo distintos:   {n_concursos['n_ext']}")
    print(f"  (ano, cargo) distintos:          {n_concursos['n_anocargo']}")

    # 8) Sample concursos OAB FGV
    section(8, "Sample de concursos OAB FGV (top 30 por contagem)")
    concursos = fetch(cur, """
        SELECT concurso_id, ano, cargo, COUNT(*) AS n
        FROM questoes
        WHERE banca = 'FGV' AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY concurso_id, ano, cargo
        ORDER BY ano DESC NULLS LAST, concurso_id DESC NULLS LAST
        LIMIT 30
    """)
    for e in concursos:
        cid = e['concurso_id']
        ano = e['ano']
        cargo = (e['cargo'] or '(NULL)')[:40]
        print(f"  cid={cid}  ano={ano}  cargo={cargo:40} q={e['n']:>3}")

    # 9) Top 30 assuntos em D. Adm OAB FGV
    section(9, "Top 30 assuntos em Direito Administrativo OAB FGV")
    assuntos = fetch(cur, """
        SELECT assunto, COUNT(*) AS n
        FROM questoes
        WHERE banca = 'FGV'
          AND materia ILIKE '%administrativo%'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY assunto
        ORDER BY n DESC
        LIMIT 30
    """)
    for a in assuntos:
        ass = (a['assunto'] or '(NULL)')[:60]
        print(f"  {ass:60} {a['n']:>4}")

    # 10) Distribuicao por ano em FGV+OAB
    section(10, "Distribuicao por ano em FGV+OAB")
    anos = fetch(cur, """
        SELECT ano, COUNT(*) AS n, COUNT(DISTINCT concurso_id) AS n_exames
        FROM questoes
        WHERE banca = 'FGV' AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY ano
        ORDER BY ano DESC NULLS LAST
    """)
    for a in anos:
        print(f"  ano={str(a['ano'] or '(NULL)'):>6}  q={a['n']:>5}  exames_distintos={a['n_exames']}")

    cur.close()
    conn.close()
    print("\nFim.")


if __name__ == '__main__':
    main()
