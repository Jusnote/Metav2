#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMPARACAO DEFINITIVA: JSON vs TXT do Codigo Penal
"""

import json
import re
from pathlib import Path

def parse_json_articles(json_path):
    """Extrai numeros dos artigos do JSON."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    articles = {}

    def find_articles(obj):
        if isinstance(obj, dict):
            if 'texto_plano' in obj and 'numero' in obj:
                num = str(obj['numero']).replace('º', '').replace('°', '').strip().upper()
                articles[num] = obj['texto_plano']
            for v in obj.values():
                find_articles(v)
        elif isinstance(obj, list):
            for item in obj:
                find_articles(item)

    find_articles(data)
    return articles

def parse_txt_articles(txt_path):
    """Extrai artigos do TXT com seus textos."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}

    # Encontra cada artigo
    pattern = r'Art\.\s*(\d+(?:-[A-Za-z])?)[º°]?[\s\-–]*(.+?)(?=Art\.\s*\d+|$)'

    for match in re.finditer(pattern, content, re.DOTALL | re.IGNORECASE):
        num = match.group(1).upper()
        body = match.group(2).strip()
        # Pega so as primeiras linhas (corpo principal)
        body_lines = body.split('\n')
        clean_body = ' '.join(line.strip() for line in body_lines[:20] if line.strip())
        articles[num] = clean_body

    return articles

def is_revogado(text):
    """Verifica se o artigo esta revogado."""
    return 'revogado' in text[:300].lower()

def main():
    base = Path(r'D:\meta novo\Metav2\public')

    json_arts = parse_json_articles(base / 'codigp_v2.json')
    txt_arts = parse_txt_articles(base / 'leioficial.txt')

    json_nums = set(json_arts.keys())
    txt_nums = set(txt_arts.keys())

    # Calcula conjuntos
    apenas_txt = txt_nums - json_nums
    apenas_json = json_nums - txt_nums
    comuns = json_nums & txt_nums

    # Separa revogados
    revogados_txt = {n for n in apenas_txt if is_revogado(txt_arts.get(n, ''))}
    ativos_faltando = apenas_txt - revogados_txt

    print("=" * 80)
    print("RELATORIO DEFINITIVO DE COMPARACAO")
    print("JSON (codigp_v2.json) vs TXT (leioficial.txt)")
    print("=" * 80)

    print(f"\n[CONTAGEM DE ARTIGOS]")
    print(f"  JSON:              {len(json_nums)} artigos")
    print(f"  TXT:               {len(txt_nums)} artigos")
    print(f"  Em comum:          {len(comuns)} artigos")

    print(f"\n[1] ARTIGOS FALTANDO NO JSON ({len(apenas_txt)})")
    print(f"    - Revogados:     {len(revogados_txt)} (CORRETO nao incluir)")
    print(f"    - Ativos:        {len(ativos_faltando)} (VERIFICAR)")

    if revogados_txt:
        print(f"\n    Artigos revogados (omitidos corretamente):")
        for n in sorted(revogados_txt, key=lambda x: (len(x), x)):
            print(f"      Art. {n}")

    if ativos_faltando:
        print(f"\n    Artigos ATIVOS faltando (PROBLEMA):")
        for n in sorted(ativos_faltando, key=lambda x: (len(x), x)):
            print(f"      Art. {n}: {txt_arts[n][:60]}...")

    print(f"\n[2] ARTIGOS EXTRAS NO JSON ({len(apenas_json)})")
    if apenas_json:
        print(f"    (artigos que existem no JSON mas nao no TXT)")
        for n in sorted(apenas_json, key=lambda x: (len(x), x)):
            print(f"      Art. {n}: {json_arts[n][:60]}...")
    else:
        print(f"    Nenhum artigo extra.")

    # Conclusao
    print("\n" + "=" * 80)
    print("CONCLUSAO")
    print("=" * 80)

    if len(ativos_faltando) == 0 and len(apenas_json) == 0:
        print(f"\n  STATUS: JSON ESTA CORRETO")
        print(f"\n  - Todos os {len(comuns)} artigos vigentes do TXT estao no JSON")
        print(f"  - Os {len(revogados_txt)} artigos revogados foram corretamente omitidos")
        print(f"\n  VEREDICTO: O JSON esta FIEL ao TXT oficial!")
    else:
        print(f"\n  STATUS: DIVERGENCIAS ENCONTRADAS")
        if ativos_faltando:
            print(f"  - {len(ativos_faltando)} artigos ativos faltando no JSON")
        if apenas_json:
            print(f"  - {len(apenas_json)} artigos extras no JSON")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
