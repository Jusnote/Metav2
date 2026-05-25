"""
Análise OAB FGV — Direito Administrativo. Gera JSON enriquecido pra frontend:
- Por item: total, exames, %incidência, breakdown por ano, exames específicos onde caiu
- Lista de exames com label legível
- Samples de 3 questões reais por item
"""

import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import re


HTML_TAG_RE = re.compile(r'<[^>]+>')


def strip_html(s):
    if not s:
        return ''
    return re.sub(r'\s+', ' ', HTML_TAG_RE.sub('', s)).strip()


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        sys.exit("ERRO: DATABASE_URL")

    base = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(base, 'mapping-d-adm.json'), 'r', encoding='utf-8') as f:
        mapping = json.load(f)

    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Total exames OAB FGV
    cur.execute("""
        SELECT COUNT(DISTINCT concurso_id_externo) AS n
        FROM questoes
        WHERE banca = 'FGV'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
    """)
    total_exames = cur.fetchone()['n']

    # Total questões D. Adm
    cur.execute("""
        SELECT COUNT(*) AS n
        FROM questoes
        WHERE banca = 'FGV'
          AND materia ILIKE '%administrativo%'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
    """)
    total_q_adm = cur.fetchone()['n']

    # Lista completa de exames OAB FGV (todos, mesmo sem D.Adm)
    cur.execute("""
        SELECT concurso_id_externo AS id, ano, MIN(data_publicacao) AS publicacao,
               COUNT(*) AS n_questoes
        FROM questoes
        WHERE banca = 'FGV'
          AND (orgao ILIKE '%OAB%' OR orgao_nome ILIKE '%OAB%')
        GROUP BY concurso_id_externo, ano
        ORDER BY ano, concurso_id_externo
    """)
    exames_raw = cur.fetchall()

    # Atribui número sequencial dentro do ano + label "OAB ANO·N"
    exames = []
    ano_counter = {}
    for e in exames_raw:
        ano = e['ano']
        ano_counter[ano] = ano_counter.get(ano, 0) + 1
        label = f"{ano}.{ano_counter[ano]}" if ano_counter[ano] > 1 or any(
            er['ano'] == ano for er in exames_raw if er['id'] != e['id']
        ) else str(ano)
        # Sempre usa N quando ano repete
        exames.append({
            'id': e['id'],
            'ano': ano,
            'label': f"{ano}.{ano_counter[ano]}",
            'n_questoes': e['n_questoes'],
        })

    # Pra cada item: count, exames, breakdown
    items_data = []
    for item in mapping['items']:
        item_id = str(item['id'])
        label = item['label']
        assuntos = item['assuntos']

        if not assuntos:
            items_data.append({
                'id': item_id,
                'label': label,
                'questoes': 0,
                'exames': 0,
                'pct_cobertura': 0,
                'pct_incidencia': 0,
                'sem_mapping': True,
                'exames_apareceu': [],
                'por_ano': [],
                'samples': [],
            })
            continue

        # Aggregated count
        cur.execute("""
            SELECT COUNT(*) AS n_q,
                   COUNT(DISTINCT concurso_id_externo) AS n_exames
            FROM questoes
            WHERE banca = 'FGV'
              AND materia ILIKE %s
              AND (orgao ILIKE %s OR orgao_nome ILIKE %s)
              AND assunto = ANY(%s)
        """, ('%administrativo%', '%OAB%', '%OAB%', assuntos))
        r = cur.fetchone()
        n_q = r['n_q']
        n_exames = r['n_exames']

        # Por exame (lista de ids onde caiu + counts)
        cur.execute("""
            SELECT concurso_id_externo AS id, COUNT(*) AS n
            FROM questoes
            WHERE banca = 'FGV'
              AND materia ILIKE %s
              AND (orgao ILIKE %s OR orgao_nome ILIKE %s)
              AND assunto = ANY(%s)
            GROUP BY concurso_id_externo
            ORDER BY concurso_id_externo
        """, ('%administrativo%', '%OAB%', '%OAB%', assuntos))
        exames_apareceu = [{'id': r['id'], 'n': r['n']} for r in cur.fetchall()]

        # Breakdown por ano
        cur.execute("""
            SELECT ano, COUNT(*) AS n
            FROM questoes
            WHERE banca = 'FGV'
              AND materia ILIKE %s
              AND (orgao ILIKE %s OR orgao_nome ILIKE %s)
              AND assunto = ANY(%s)
            GROUP BY ano
            ORDER BY ano
        """, ('%administrativo%', '%OAB%', '%OAB%', assuntos))
        por_ano = [{'ano': r['ano'], 'n': r['n']} for r in cur.fetchall()]

        # Sample 3 questões (mais recentes)
        cur.execute("""
            SELECT id, ano, concurso_id_externo AS exam_id,
                   COALESCE(NULLIF(enunciado, ''), enunciado_html) AS texto,
                   assunto
            FROM questoes
            WHERE banca = 'FGV'
              AND materia ILIKE %s
              AND (orgao ILIKE %s OR orgao_nome ILIKE %s)
              AND assunto = ANY(%s)
            ORDER BY ano DESC NULLS LAST, id DESC
            LIMIT 3
        """, ('%administrativo%', '%OAB%', '%OAB%', assuntos))
        samples = []
        for r in cur.fetchall():
            txt = strip_html(r['texto'])
            samples.append({
                'id': r['id'],
                'ano': r['ano'],
                'exam_id': r['exam_id'],
                'assunto': r['assunto'],
                'enunciado': (txt[:280] + '...') if len(txt) > 280 else txt,
            })

        items_data.append({
            'id': item_id,
            'label': label,
            'questoes': n_q,
            'exames': n_exames,
            'pct_cobertura': round(100 * n_q / total_q_adm, 1) if total_q_adm else 0,
            'pct_incidencia': round(100 * n_exames / total_exames, 1) if total_exames else 0,
            'sem_mapping': False,
            'exames_apareceu': exames_apareceu,
            'por_ano': por_ano,
            'samples': samples,
        })

    soma = sum(i['questoes'] for i in items_data)
    output = {
        'materia': 'Direito Administrativo',
        'banca': 'FGV',
        'orgao': 'OAB',
        'total_exames': total_exames,
        'total_questoes': total_q_adm,
        'cobertura_mapping_pct': round(100 * soma / total_q_adm, 1) if total_q_adm else 0,
        'gerado_em': datetime.now().isoformat(),
        'exames': exames,
        'items': sorted(items_data, key=lambda x: -x['pct_incidencia']),
    }

    out_dir = os.path.normpath(os.path.join(base, '..', '..', 'public', 'data'))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'oab-analysis.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"JSON gerado: {out_path}")
    print(f"  - {len(exames)} exames")
    print(f"  - {len(items_data)} itens (cobertura {output['cobertura_mapping_pct']}%)")
    print(f"  - {sum(len(i['samples']) for i in items_data)} samples de questoes")

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
