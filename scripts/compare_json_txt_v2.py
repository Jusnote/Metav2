#!/usr/bin/env python3
"""
Script para comparar artigos do JSON (codigp_v2.json) com o TXT oficial (leioficial.txt)
Versao refinada - ignora diferencas de formatacao triviais
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
    # Normaliza unicode
    text = unicodedata.normalize('NFKC', text)
    # Remove multiplos espacos/quebras de linha
    text = re.sub(r'\s+', ' ', text)
    # Remove espacos no inicio e fim
    text = text.strip()
    return text

def clean_for_comparison(text):
    """Remove elementos de formatacao para comparacao justa."""
    if not text:
        return ""
    text = normalize_text(text)
    # Remove prefixo "Art. Xo - " ou "Art. Xo"
    text = re.sub(r'^Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*', '', text, flags=re.IGNORECASE)
    # Normaliza traco/hifen
    text = re.sub(r'[-–—]', '-', text)
    # Remove espacos extras ao redor de pontuacao
    text = re.sub(r'\s*([.,;:!?])\s*', r'\1 ', text)
    # Remove espacos duplicados
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_article_number(text):
    """Extrai o numero do artigo do texto."""
    match = re.match(r'Art\.?\s*(\d+(?:-[A-Za-z])?)[º°]?\s*[-–]?\s*', text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return None

def parse_txt_articles(txt_path):
    """Extrai artigos do arquivo TXT oficial."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}
    pattern = r'(Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*)(.*?)(?=Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*|$)'
    matches = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)

    for prefix, body in matches:
        art_num = extract_article_number(prefix)
        if art_num:
            full_text = prefix + body
            articles[art_num] = {
                'raw': full_text.strip(),
                'normalized': normalize_text(full_text),
                'clean': clean_for_comparison(full_text)
            }

    return articles

def parse_json_articles(json_path):
    """Extrai artigos do arquivo JSON."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    articles = {}

    def find_articles_recursive(obj, articles_list):
        if isinstance(obj, dict):
            if 'texto_plano' in obj or 'texto' in obj:
                articles_list.append(obj)
            for value in obj.values():
                find_articles_recursive(value, articles_list)
        elif isinstance(obj, list):
            for item in obj:
                find_articles_recursive(item, articles_list)
        return articles_list

    items = find_articles_recursive(data, [])

    for item in items:
        if isinstance(item, dict):
            art_num = None
            if 'numero' in item:
                art_num = str(item['numero']).replace('º', '').replace('°', '').strip().upper()
            elif 'artigo' in item:
                art_num = extract_article_number(str(item['artigo']))

            texto = item.get('texto_plano', '') or item.get('texto', '') or item.get('conteudo', '')

            if art_num and texto:
                articles[art_num] = {
                    'raw': texto.strip(),
                    'normalized': normalize_text(texto),
                    'clean': clean_for_comparison(texto),
                    'item': item
                }

    return articles, items

def similarity_ratio(text1, text2):
    """Calcula a similaridade entre dois textos."""
    return SequenceMatcher(None, text1, text2).ratio()

def find_differences(text1, text2):
    """Encontra as diferencas entre dois textos."""
    words1 = set(text1.split())
    words2 = set(text2.split())
    only_in_1 = words1 - words2
    only_in_2 = words2 - words1
    return only_in_1, only_in_2

def count_structures(text):
    """Conta incisos, paragrafos e alineas no texto."""
    return {
        'paragrafos': len(re.findall(r'§\s*\d+[º°]?', text)),
        'paragrafo_unico': 1 if re.search(r'Parágrafo\s+único', text, re.IGNORECASE) else 0,
        'incisos': len(re.findall(r'\b[IVXLCDM]+\s*[-–]', text)),
        'alineas': len(re.findall(r'\b[a-z]\)\s', text))
    }

def compare_articles(json_articles, txt_articles):
    """Compara os artigos e retorna divergencias."""
    divergencias = {
        'apenas_json': [],
        'apenas_txt': [],
        'texto_diferente': [],
        'conteudo_significativo': []
    }

    json_nums = set(json_articles.keys())
    txt_nums = set(txt_articles.keys())

    # Artigos apenas no JSON
    apenas_json = json_nums - txt_nums
    for num in sorted(apenas_json, key=lambda x: (len(x), x)):
        divergencias['apenas_json'].append(num)

    # Artigos apenas no TXT
    apenas_txt = txt_nums - json_nums
    for num in sorted(apenas_txt, key=lambda x: (len(x), x)):
        divergencias['apenas_txt'].append(num)

    # Artigos em ambos - comparar texto limpo
    comuns = json_nums & txt_nums
    for num in sorted(comuns, key=lambda x: (len(x), x)):
        json_clean = json_articles[num]['clean']
        txt_clean = txt_articles[num]['clean']

        # Similaridade alta = sem divergencia significativa
        sim = similarity_ratio(json_clean, txt_clean)

        if sim < 0.95:  # Menos de 95% similar = divergencia
            only_json, only_txt = find_differences(json_clean, txt_clean)

            # Filtra palavras muito curtas ou numeros isolados
            only_json = {w for w in only_json if len(w) > 2 and not w.isdigit()}
            only_txt = {w for w in only_txt if len(w) > 2 and not w.isdigit()}

            if only_json or only_txt:
                divergencias['conteudo_significativo'].append({
                    'artigo': num,
                    'similaridade': sim,
                    'json_preview': json_clean[:300],
                    'txt_preview': txt_clean[:300],
                    'palavras_so_json': list(only_json)[:10],
                    'palavras_so_txt': list(only_txt)[:10]
                })

    return divergencias, len(json_nums), len(txt_nums), len(comuns)

def main():
    base_path = Path(r'D:\meta novo\Metav2\public')
    json_path = base_path / 'codigp_v2.json'
    txt_path = base_path / 'leioficial.txt'

    print("=" * 80)
    print("RELATORIO DE COMPARACAO: JSON vs TXT OFICIAL")
    print("=" * 80)
    print()

    print("Carregando arquivos...")
    txt_articles = parse_txt_articles(txt_path)
    json_articles, raw_items = parse_json_articles(json_path)

    print(f"  - JSON: {len(json_articles)} artigos encontrados")
    print(f"  - TXT:  {len(txt_articles)} artigos encontrados")
    print()

    # Compara
    divergencias, n_json, n_txt, n_comuns = compare_articles(json_articles, txt_articles)

    print("-" * 80)
    print("RESUMO")
    print("-" * 80)
    print(f"Total de artigos no JSON:  {n_json}")
    print(f"Total de artigos no TXT:   {n_txt}")
    print(f"Artigos em comum:          {n_comuns}")
    print()

    print("-" * 80)
    print("DIVERGENCIAS ENCONTRADAS")
    print("-" * 80)

    # Artigos apenas no JSON
    if divergencias['apenas_json']:
        print(f"\n[1] ARTIGOS APENAS NO JSON ({len(divergencias['apenas_json'])}):")
        for art in divergencias['apenas_json']:
            print(f"    - Art. {art}")
    else:
        print("\n[1] ARTIGOS APENAS NO JSON: Nenhum")

    # Artigos apenas no TXT
    if divergencias['apenas_txt']:
        print(f"\n[2] ARTIGOS APENAS NO TXT ({len(divergencias['apenas_txt'])}):")
        for art in divergencias['apenas_txt']:
            # Tenta dar contexto sobre o artigo
            if art in txt_articles:
                preview = txt_articles[art]['clean'][:80]
                print(f"    - Art. {art}: {preview}...")
            else:
                print(f"    - Art. {art}")
    else:
        print("\n[2] ARTIGOS APENAS NO TXT: Nenhum")

    # Divergencias significativas de conteudo
    if divergencias['conteudo_significativo']:
        print(f"\n[3] ARTIGOS COM CONTEUDO SIGNIFICATIVAMENTE DIFERENTE ({len(divergencias['conteudo_significativo'])}):")
        for item in divergencias['conteudo_significativo']:
            print(f"\n    Art. {item['artigo']} (similaridade: {item['similaridade']:.1%}):")
            if item['palavras_so_json']:
                print(f"      Palavras so no JSON: {', '.join(item['palavras_so_json'][:5])}")
            if item['palavras_so_txt']:
                print(f"      Palavras so no TXT:  {', '.join(item['palavras_so_txt'][:5])}")
            print(f"      JSON: {item['json_preview'][:100]}...")
            print(f"      TXT:  {item['txt_preview'][:100]}...")
    else:
        print("\n[3] ARTIGOS COM CONTEUDO SIGNIFICATIVAMENTE DIFERENTE: Nenhum")

    # Conclusao
    print()
    print("=" * 80)
    print("CONCLUSAO")
    print("=" * 80)

    total_divergencias = (
        len(divergencias['apenas_json']) +
        len(divergencias['apenas_txt']) +
        len(divergencias['conteudo_significativo'])
    )

    if total_divergencias == 0:
        print("O JSON esta FIEL ao TXT oficial. Nenhuma divergencia significativa encontrada.")
        print(f"Todos os {n_comuns} artigos em comum tem conteudo identico ou equivalente.")
    else:
        print(f"DIVERGENCIAS DETECTADAS: {total_divergencias} problemas encontrados.")
        if divergencias['apenas_json']:
            print(f"  - {len(divergencias['apenas_json'])} artigos existem APENAS no JSON (nao estao no TXT)")
        if divergencias['apenas_txt']:
            print(f"  - {len(divergencias['apenas_txt'])} artigos existem APENAS no TXT (faltam no JSON)")
        if divergencias['conteudo_significativo']:
            print(f"  - {len(divergencias['conteudo_significativo'])} artigos com texto significativamente diferente")

        if len(divergencias['apenas_txt']) > 0:
            print(f"\n  NOTA: Os {len(divergencias['apenas_txt'])} artigos faltantes no JSON provavelmente")
            print("  sao artigos revogados que foram mantidos no TXT para referencia historica.")

if __name__ == '__main__':
    main()
