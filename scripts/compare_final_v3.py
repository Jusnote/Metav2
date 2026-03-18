#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script final para comparar artigos do JSON com o TXT oficial.
Versao 3: Trata corretamente o simbolo de grau (º) e outros problemas de formatacao.
"""

import json
import re
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher

def normalize_text(text):
    """Normaliza o texto para comparacao."""
    if not text:
        return ""
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_article_body(text):
    """Extrai o corpo do artigo removendo o prefixo Art. X completamente."""
    if not text:
        return ""
    text = normalize_text(text)
    # Remove "Art. Xo - ", "Art. Xº - ", "Art. X - " etc
    # Trata o 'o' ou 'º' que pode ficar grudado ou separado
    text = re.sub(r'^Art\.?\s*\d+(?:-[A-Za-z])?[º°o]?\s*[-–]?\s*', '', text, flags=re.IGNORECASE)
    # Remove 'o' isolado no inicio (residuo do numero ordinal)
    text = re.sub(r'^o\s+', '', text, flags=re.IGNORECASE)
    # Remove ponto inicial isolado
    text = re.sub(r'^\.\s*', '', text)
    return text.strip()

def parse_txt_articles(txt_path):
    """Extrai artigos do arquivo TXT."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}

    # Pattern para capturar artigos
    pattern = r'Art\.?\s*(\d+(?:-[A-Za-z])?)[º°]?\s*[-–]?\s*(.+?)(?=(?:\n\s*Art\.)|(?:\n\s*TÍTULO)|(?:\n\s*CAPÍTULO)|(?:\n\s*SEÇÃO)|(?:\n\s*PARTE\s+[A-Z])|$)'

    for match in re.finditer(pattern, content, re.DOTALL | re.IGNORECASE):
        num = match.group(1).upper()
        body = match.group(2).strip()

        # Limpa o corpo
        body = re.sub(r'\s+', ' ', body).strip()

        if num and body:
            articles[num] = extract_article_body("Art. " + num + " " + body)

    return articles

def parse_json_articles(json_path):
    """Extrai artigos do arquivo JSON."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    articles = {}

    def find_articles(obj):
        items = []
        if isinstance(obj, dict):
            if 'texto_plano' in obj:
                items.append(obj)
            for v in obj.values():
                items.extend(find_articles(v))
        elif isinstance(obj, list):
            for item in obj:
                items.extend(find_articles(item))
        return items

    for item in find_articles(data):
        num = str(item.get('numero', '')).replace('º', '').replace('°', '').strip().upper()
        texto = item.get('texto_plano', '')
        if num and texto:
            articles[num] = extract_article_body(texto)

    return articles

def similarity(t1, t2):
    """Calcula similaridade entre dois textos."""
    if not t1 or not t2:
        return 0
    return SequenceMatcher(None, t1.lower(), t2.lower()).ratio()

def find_real_differences(json_text, txt_text):
    """Identifica diferencas reais entre os textos."""
    # Normaliza ambos para comparacao justa
    j = json_text.lower().strip()
    t = txt_text.lower().strip()

    # Se identicos, retorna None
    if j == t:
        return None

    # Encontra palavras diferentes
    j_words = set(re.findall(r'\b\w+\b', j))
    t_words = set(re.findall(r'\b\w+\b', t))

    only_json = j_words - t_words
    only_txt = t_words - j_words

    # Filtra palavras muito curtas e numeros
    only_json = {w for w in only_json if len(w) > 2 and not w.isdigit()}
    only_txt = {w for w in only_txt if len(w) > 2 and not w.isdigit()}

    if not only_json and not only_txt:
        return None  # Apenas diferencas de pontuacao/formatacao

    return {
        'only_json': list(only_json)[:5],
        'only_txt': list(only_txt)[:5]
    }

def main():
    base_path = Path(r'D:\meta novo\Metav2\public')
    json_path = base_path / 'codigp_v2.json'
    txt_path = base_path / 'leioficial.txt'

    print("=" * 80)
    print("RELATORIO DE COMPARACAO: JSON vs TXT OFICIAL")
    print("=" * 80)
    print()

    # Parse
    txt_articles = parse_txt_articles(txt_path)
    json_articles = parse_json_articles(json_path)

    print(f"Total de artigos no JSON:  {len(json_articles)}")
    print(f"Total de artigos no TXT:   {len(txt_articles)}")

    json_nums = set(json_articles.keys())
    txt_nums = set(txt_articles.keys())
    comuns = json_nums & txt_nums

    print(f"Artigos em comum:          {len(comuns)}")

    # ========================================
    # 1. ARTIGOS FALTANDO
    # ========================================
    apenas_txt = txt_nums - json_nums
    apenas_json = json_nums - txt_nums

    print("\n" + "-" * 80)
    print("[1] ARTIGOS FALTANDO NO JSON")
    print("-" * 80)

    if apenas_txt:
        revogados = []
        ativos = []
        for num in sorted(apenas_txt, key=lambda x: (len(x), x)):
            body = txt_articles[num][:150].lower()
            if 'revogado' in body:
                revogados.append(num)
            else:
                ativos.append(num)

        print(f"\n  Total faltando: {len(apenas_txt)}")
        print(f"  - REVOGADOS (esperado): {len(revogados)}")
        if revogados:
            print(f"    Artigos: {', '.join(revogados[:15])}{'...' if len(revogados) > 15 else ''}")
        print(f"  - ATIVOS (problema): {len(ativos)}")
        if ativos:
            for num in ativos:
                print(f"    - Art. {num}: {txt_articles[num][:60]}...")
    else:
        print("\n  Nenhum artigo faltando.")

    if apenas_json:
        print("\n" + "-" * 80)
        print("[2] ARTIGOS EXTRAS NO JSON (nao existem no TXT)")
        print("-" * 80)
        print(f"\n  Total: {len(apenas_json)}")
        for num in sorted(apenas_json, key=lambda x: (len(x), x)):
            print(f"    - Art. {num}: {json_articles[num][:60]}...")
    else:
        print("\n[2] Nenhum artigo extra no JSON.")

    # ========================================
    # 3. COMPARACAO DE CONTEUDO
    # ========================================
    print("\n" + "-" * 80)
    print("[3] COMPARACAO DE CONTEUDO")
    print("-" * 80)

    identicos = 0
    formatacao_diff = 0  # So diferenca de formatacao
    conteudo_diff = []   # Diferenca real de conteudo

    for num in sorted(comuns, key=lambda x: (len(x), x)):
        json_body = json_articles[num]
        txt_body = txt_articles[num]

        # Compara primeiros 500 chars
        j_sample = json_body[:500]
        t_sample = txt_body[:500]

        sim = similarity(j_sample, t_sample)

        if sim >= 0.99:
            identicos += 1
        elif sim >= 0.90:
            # Verifica se e apenas formatacao
            diff = find_real_differences(j_sample, t_sample)
            if diff is None:
                formatacao_diff += 1
            else:
                conteudo_diff.append((num, sim, json_body[:100], txt_body[:100], diff))
        else:
            diff = find_real_differences(j_sample, t_sample)
            conteudo_diff.append((num, sim, json_body[:100], txt_body[:100], diff))

    print(f"\n  Artigos IDENTICOS:              {identicos}")
    print(f"  Artigos com dif. FORMATACAO:    {formatacao_diff}")
    print(f"  Artigos com dif. CONTEUDO:      {len(conteudo_diff)}")

    if conteudo_diff:
        # Separa por gravidade
        graves = [(n, s, j, t, d) for n, s, j, t, d in conteudo_diff if s < 0.80]
        moderadas = [(n, s, j, t, d) for n, s, j, t, d in conteudo_diff if 0.80 <= s < 0.95]
        leves = [(n, s, j, t, d) for n, s, j, t, d in conteudo_diff if s >= 0.95]

        if graves:
            print(f"\n  DIVERGENCIAS GRAVES (<80% similaridade): {len(graves)}")
            for num, sim, j_prev, t_prev, diff in graves[:10]:
                print(f"\n    Art. {num} ({sim:.0%}):")
                print(f"      JSON: {j_prev[:70]}...")
                print(f"      TXT:  {t_prev[:70]}...")
                if diff:
                    if diff['only_json']:
                        print(f"      Palavras so no JSON: {', '.join(diff['only_json'])}")
                    if diff['only_txt']:
                        print(f"      Palavras so no TXT: {', '.join(diff['only_txt'])}")

        if moderadas:
            print(f"\n  DIVERGENCIAS MODERADAS (80-95%): {len(moderadas)}")
            for num, sim, j_prev, t_prev, diff in moderadas[:5]:
                print(f"    - Art. {num} ({sim:.0%})")

        if leves:
            print(f"\n  DIVERGENCIAS LEVES (>=95%): {len(leves)}")
            print(f"    Artigos: {', '.join([n for n, _, _, _, _ in leves[:15]])}")

    # ========================================
    # CONCLUSAO
    # ========================================
    print("\n" + "=" * 80)
    print("CONCLUSAO")
    print("=" * 80)

    ativos_faltando = len([n for n in apenas_txt if 'revogado' not in txt_articles[n][:150].lower()])
    total_ok = identicos + formatacao_diff
    total_problemas = ativos_faltando + len(apenas_json) + len(conteudo_diff)

    print(f"\n  RESUMO:")
    print(f"  - Artigos OK (identicos ou formatacao): {total_ok} ({total_ok/len(comuns)*100:.1f}%)")
    print(f"  - Artigos com divergencia de conteudo:  {len(conteudo_diff)}")
    print(f"  - Artigos revogados omitidos (correto): {len([n for n in apenas_txt if 'revogado' in txt_articles[n][:150].lower()])}")
    print(f"  - Artigos ativos faltando:              {ativos_faltando}")
    print(f"  - Artigos extras no JSON:               {len(apenas_json)}")

    if total_problemas == 0:
        print(f"\n  VEREDICTO: O JSON esta FIEL ao TXT oficial!")
    elif len(conteudo_diff) < 10 and ativos_faltando == 0:
        print(f"\n  VEREDICTO: O JSON esta SUBSTANCIALMENTE fiel ao TXT.")
        print(f"  Apenas {len(conteudo_diff)} artigos com pequenas divergencias.")
    else:
        print(f"\n  VEREDICTO: Existem divergencias que requerem revisao.")
        print(f"  {len(conteudo_diff)} artigos com conteudo diferente.")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
