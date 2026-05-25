"""
Analise OAB FGV - Direito Administrativo.

Objetivos:
  1. Validar concurso_id_externo como ID de exame (lista os 43 valores)
  2. Listar TODOS os assuntos distintos em D.Adm OAB FGV com contagem
  3. Pra cada exame distinto, qto de questoes de D.Adm

Uso: DATABASE_URL=... python scripts/oab-analysis/analyze_d_adm.py
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
        sys.exit("ERRO: defina DATABASE_URL")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1) Lista TODOS os concurso_id_externo de OAB FGV
    section(1, "Lista de todos os exames OAB FGV (concurso_id_externo)")
    exames = fetch(cur, """
        SELECT concurso_id_externo, ano, MIN(data_publicacao) AS primeira_pub,
               COUNT(*) AS n_questoes,
               COUNT(DISTINCT materia) AS n_materias
        FROM questoes
        WHERE banca = 'FGV'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY concurso_id_externo, ano
        ORDER BY ano, concurso_id_externo
    """)
    print(f"  Total: {len(exames)} exames distintos\n")
    for e in exames:
        print(f"  cid_ext={e['concurso_id_externo']:>10}  ano={e['ano']}  "
              f"q={e['n_questoes']:>4}  materias={e['n_materias']:>3}  "
              f"pub={e['primeira_pub']}")

    # 2) Distribuicao de questoes de D.Adm por exame
    section(2, "Direito Administrativo - distribuicao por exame")
    adm_exames = fetch(cur, """
        SELECT concurso_id_externo, ano, COUNT(*) AS n
        FROM questoes
        WHERE banca = 'FGV'
          AND materia ILIKE '%administrativo%'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY concurso_id_externo, ano
        ORDER BY ano, concurso_id_externo
    """)
    print(f"  Direito Adm aparece em {len(adm_exames)} dos exames")
    print(f"  Range: {min(e['n'] for e in adm_exames)} a {max(e['n'] for e in adm_exames)} questoes por exame\n")
    for e in adm_exames:
        print(f"  cid_ext={e['concurso_id_externo']:>10}  ano={e['ano']}  q_adm={e['n']:>3}")

    # 3) TODOS os assuntos distintos em D.Adm OAB FGV
    section(3, "TODOS os assuntos em D.Adm OAB FGV (com count)")
    assuntos = fetch(cur, """
        SELECT assunto, COUNT(*) AS n,
               COUNT(DISTINCT concurso_id_externo) AS n_exames
        FROM questoes
        WHERE banca = 'FGV'
          AND materia ILIKE '%administrativo%'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY assunto
        ORDER BY n DESC
    """)
    print(f"  Total: {len(assuntos)} assuntos distintos em D.Adm\n")
    for a in assuntos:
        ass = (a['assunto'] or '(NULL)')
        # truncar se muito longo
        if len(ass) > 80:
            ass = ass[:77] + '...'
        print(f"  q={a['n']:>3}  exames={a['n_exames']:>2}  {ass}")

    # 4) Estatisticas globais D.Adm
    section(4, "Stats globais D.Adm OAB FGV")
    stats = fetch(cur, """
        SELECT COUNT(*) AS total_q,
               COUNT(DISTINCT assunto) AS n_assuntos,
               COUNT(DISTINCT concurso_id_externo) AS n_exames,
               COUNT(*) FILTER (WHERE assunto IS NULL) AS sem_assunto
        FROM questoes
        WHERE banca = 'FGV'
          AND materia ILIKE '%administrativo%'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
    """)[0]
    print(f"  Total questoes:        {stats['total_q']}")
    print(f"  Assuntos distintos:    {stats['n_assuntos']}")
    print(f"  Exames com D.Adm:      {stats['n_exames']}")
    print(f"  Questoes sem assunto:  {stats['sem_assunto']}")

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
