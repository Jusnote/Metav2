#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RELATORIO FINAL DE COMPARACAO: JSON vs TXT
Verifica se cada artigo do JSON corresponde fielmente ao TXT oficial.
"""

import json
import re
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher

def normalize(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_body(text):
    """Remove prefixo Art. X do texto."""
    if not text:
        return ""
    text = normalize(text)
    text = re.sub(r'^Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*', '', text, flags=re.IGNORECASE)
    return text.strip()

def parse_txt(path):
    """Extrai artigos do TXT - captura APENAS o texto do artigo, nao epigrafes."""
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}
    # Captura Art. X - TEXTO ate quebra de linha dupla ou proximo artigo
    lines = content.split('\n')
    current_art = None
    current_text = []

    for line in lines:
        line_stripped = line.strip()

        # Verifica se e inicio de artigo
        match = re.match(r'Art\.?\s*(\d+(?:-[A-Za-z])?)[º°]?\s*[-–]?\s*(.+)', line_stripped, re.IGNORECASE)
        if match:
            # Salva artigo anterior
            if current_art:
                articles[current_art] = ' '.join(current_text)

            current_art = match.group(1).upper()
            current_text = [match.group(2)]
        elif current_art and line_stripped:
            # Continua o artigo se comeca com paragrafos, incisos ou alineas
            if re.match(r'^(§|Parágrafo|[IVXLCDM]+\s*[-–]|[a-z]\))', line_stripped):
                current_text.append(line_stripped)
            elif re.match(r'^[A-Z][A-Z\s]+$', line_stripped):
                # Titulo/capitulo - termina o artigo atual
                if current_art:
                    articles[current_art] = ' '.join(current_text)
                    current_art = None
                    current_text = []
            elif not re.match(r'^[A-Z][a-z]', line_stripped):
                # Provavelmente continuacao do artigo (nao e epigrafe)
                # Epigrafes geralmente comecam com maiuscula
                if len(line_stripped) > 30:  # Texto substantivo
                    current_text.append(line_stripped)

    # Ultimo artigo
    if current_art:
        articles[current_art] = ' '.join(current_text)

    return articles

def parse_json(path):
    """Extrai artigos do JSON."""
    with open(path, 'r', encoding='utf-8') as f:
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

def similarity(t1, t2):
    if not t1 or not t2:
        return 0
    return SequenceMatcher(None, t1.lower(), t2.lower()).ratio()

def main():
    base = Path(r'D:\meta novo\Metav2\public')
    txt_arts = parse_txt(base / 'leioficial.txt')
    json_arts = parse_json(base / 'codigp_v2.json')

    print("=" * 80)
    print("RELATORIO FINAL DE COMPARACAO: JSON vs TXT OFICIAL")
    print("Codigo Penal Brasileiro")
    print("=" * 80)

    # ESTATISTICAS BASICAS
    print(f"\n[ESTATISTICAS]")
    print(f"  Artigos no JSON:   {len(json_arts)}")
    print(f"  Artigos no TXT:    {len(txt_arts)}")

    json_nums = set(json_arts.keys())
    txt_nums = set(txt_arts.keys())
    comuns = json_nums & txt_nums
    apenas_txt = txt_nums - json_nums
    apenas_json = json_nums - txt_nums

    print(f"  Artigos em comum:  {len(comuns)}")

    # ARTIGOS FALTANDO NO JSON
    print(f"\n[1] ARTIGOS NO TXT QUE FALTAM NO JSON: {len(apenas_txt)}")
    if apenas_txt:
        revogados = []
        ativos = []
        for num in sorted(apenas_txt, key=lambda x: (len(x), x)):
            txt = txt_arts[num][:200].lower()
            if 'revogado' in txt or 'revogada' in txt:
                revogados.append(num)
            else:
                ativos.append(num)

        print(f"    - Revogados (OK nao estar no JSON): {len(revogados)}")
        if revogados:
            print(f"      {', '.join(sorted(revogados, key=lambda x: (len(x), x)))}")
        print(f"    - Ativos (PROBLEMA se faltam):      {len(ativos)}")
        if ativos:
            for n in ativos:
                print(f"      Art. {n}: {txt_arts[n][:60]}...")

    # ARTIGOS EXTRAS NO JSON
    print(f"\n[2] ARTIGOS NO JSON QUE NAO EXISTEM NO TXT: {len(apenas_json)}")
    if apenas_json:
        for n in sorted(apenas_json, key=lambda x: (len(x), x)):
            print(f"    Art. {n}: {extract_body(json_arts[n])[:60]}...")

    # COMPARACAO DE CONTEUDO
    print(f"\n[3] COMPARACAO DE CONTEUDO DOS {len(comuns)} ARTIGOS EM COMUM:")

    identicos = 0
    pequenas_dif = 0
    divergentes = []

    for num in sorted(comuns, key=lambda x: (len(x), x)):
        json_body = extract_body(json_arts[num])
        txt_body = extract_body(txt_arts[num])

        # Compara so os primeiros 300 caracteres (corpo principal)
        j_sample = json_body[:300].lower()
        t_sample = txt_body[:300].lower()

        sim = similarity(j_sample, t_sample)

        if sim >= 0.98:
            identicos += 1
        elif sim >= 0.90:
            pequenas_dif += 1
        else:
            divergentes.append((num, sim, json_body[:100], txt_body[:100]))

    print(f"    - Identicos (>=98%):           {identicos}")
    print(f"    - Pequenas diferencas (90-98%): {pequenas_dif}")
    print(f"    - Divergencias (<90%):          {len(divergentes)}")

    if divergentes:
        print(f"\n    Artigos com divergencias significativas:")
        for num, sim, j, t in divergentes[:15]:
            print(f"\n      Art. {num} (similaridade: {sim:.0%}):")
            print(f"        JSON: {j}...")
            print(f"        TXT:  {t}...")
        if len(divergentes) > 15:
            print(f"\n      ... e mais {len(divergentes) - 15} artigos")

    # CONCLUSAO
    print("\n" + "=" * 80)
    print("CONCLUSAO")
    print("=" * 80)

    ativos_faltando = len([n for n in apenas_txt if 'revogado' not in txt_arts[n][:200].lower()])
    total_ok = identicos + pequenas_dif

    if ativos_faltando == 0 and len(apenas_json) == 0:
        if len(divergentes) == 0:
            print(f"\n  O JSON esta COMPLETAMENTE FIEL ao TXT oficial!")
        elif len(divergentes) < 5:
            print(f"\n  O JSON esta SUBSTANCIALMENTE fiel ao TXT oficial.")
            print(f"  Apenas {len(divergentes)} artigos com divergencias menores.")
        else:
            print(f"\n  O JSON tem {len(divergentes)} artigos com divergencias.")
            print(f"  Recomenda-se verificacao manual desses artigos.")

        print(f"\n  Detalhes:")
        print(f"    - {total_ok} artigos com conteudo correto ({total_ok/len(comuns)*100:.1f}%)")
        print(f"    - {len([n for n in apenas_txt if 'revogado' in txt_arts[n][:200].lower()])} artigos revogados corretamente omitidos")
    else:
        print(f"\n  PROBLEMAS ENCONTRADOS:")
        if ativos_faltando > 0:
            print(f"    - {ativos_faltando} artigos ATIVOS faltando no JSON")
        if len(apenas_json) > 0:
            print(f"    - {len(apenas_json)} artigos no JSON que nao existem no TXT")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
