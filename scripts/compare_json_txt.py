#!/usr/bin/env python3
"""
Script para comparar artigos do JSON (codigp_v2.json) com o TXT oficial (leioficial.txt)
"""

import json
import re
import unicodedata
from pathlib import Path
from difflib import unified_diff

def normalize_text(text):
    """Normaliza o texto para comparação."""
    if not text:
        return ""
    # Normaliza unicode
    text = unicodedata.normalize('NFKC', text)
    # Remove múltiplos espaços/quebras de linha
    text = re.sub(r'\s+', ' ', text)
    # Remove espaços no início e fim
    text = text.strip()
    return text

def extract_article_number(text):
    """Extrai o número do artigo do texto."""
    # Padrões: "Art. 1º", "Art. 10", "Art. 100-A"
    match = re.match(r'Art\.?\s*(\d+(?:-[A-Za-z])?)[º°]?\s*[-–]?\s*', text, re.IGNORECASE)
    if match:
        # Normaliza para uppercase o sufixo (ex: 91-a -> 91-A)
        return match.group(1).upper()
    return None

def parse_txt_articles(txt_path):
    """Extrai artigos do arquivo TXT oficial."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}

    # Padrão para encontrar artigos
    # Captura "Art. Xº - " ou "Art. Xº" seguido do texto até o próximo artigo ou fim
    pattern = r'(Art\.?\s*\d+(?:-[A-Z])?[º°]?\s*[-–]?\s*)(.*?)(?=Art\.?\s*\d+(?:-[A-Z])?[º°]?\s*[-–]?\s*|$)'

    matches = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)

    for prefix, body in matches:
        art_num = extract_article_number(prefix)
        if art_num:
            full_text = prefix + body
            articles[art_num] = {
                'raw': full_text,
                'normalized': normalize_text(full_text),
                'body': normalize_text(body)
            }

    return articles

def parse_json_articles(json_path):
    """Extrai artigos do arquivo JSON."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    articles = {}

    # Navega pela estrutura do JSON
    if isinstance(data, dict):
        # Pode ter estrutura com 'artigos' ou ser o próprio array
        if 'artigos' in data:
            items = data['artigos']
        elif 'capitulos' in data:
            # Estrutura aninhada por capítulos
            items = []
            for cap in data.get('capitulos', []):
                if 'artigos' in cap:
                    items.extend(cap['artigos'])
                if 'secoes' in cap:
                    for sec in cap['secoes']:
                        if 'artigos' in sec:
                            items.extend(sec['artigos'])
        else:
            # Tenta encontrar artigos em qualquer nível
            items = find_articles_recursive(data)
    elif isinstance(data, list):
        items = data
    else:
        items = []

    for item in items:
        if isinstance(item, dict):
            # Tenta diferentes campos para o número do artigo
            art_num = None
            if 'numero' in item:
                art_num = str(item['numero']).replace('º', '').replace('°', '').strip().upper()
            elif 'artigo' in item:
                art_num = extract_article_number(str(item['artigo']))
            elif 'id' in item:
                match = re.search(r'art[_-]?(\d+(?:-[A-Z])?)', str(item['id']), re.IGNORECASE)
                if match:
                    art_num = match.group(1)

            # Tenta diferentes campos para o texto
            texto = item.get('texto_plano', '') or item.get('texto', '') or item.get('conteudo', '')

            if art_num and texto:
                articles[art_num] = {
                    'raw': texto,
                    'normalized': normalize_text(texto),
                    'item': item
                }

    return articles, items

def find_articles_recursive(obj, articles=None):
    """Busca recursivamente por artigos em estrutura aninhada."""
    if articles is None:
        articles = []

    if isinstance(obj, dict):
        if 'texto_plano' in obj or 'texto' in obj:
            articles.append(obj)
        for value in obj.values():
            find_articles_recursive(value, articles)
    elif isinstance(obj, list):
        for item in obj:
            find_articles_recursive(item, articles)

    return articles

def count_structures(text):
    """Conta incisos, parágrafos e alíneas no texto."""
    counts = {
        'paragrafos': len(re.findall(r'§\s*\d+[º°]?', text)),
        'paragrafo_unico': 1 if re.search(r'Parágrafo\s+único', text, re.IGNORECASE) else 0,
        'incisos': len(re.findall(r'\b[IVXLCDM]+\s*[-–]', text)),
        'alineas': len(re.findall(r'\b[a-z]\)\s', text))
    }
    return counts

def compare_articles(json_articles, txt_articles):
    """Compara os artigos e retorna divergências."""
    divergencias = {
        'apenas_json': [],
        'apenas_txt': [],
        'texto_diferente': [],
        'estrutura_diferente': []
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

    # Artigos em ambos - comparar texto
    comuns = json_nums & txt_nums
    for num in sorted(comuns, key=lambda x: (len(x), x)):
        json_text = json_articles[num]['normalized']
        txt_text = txt_articles[num]['normalized']

        # Remove o prefixo "Art. Xº - " para comparação mais justa
        json_clean = re.sub(r'^Art\.?\s*\d+(?:-[A-Z])?[º°]?\s*[-–]?\s*', '', json_text, flags=re.IGNORECASE)
        txt_clean = re.sub(r'^Art\.?\s*\d+(?:-[A-Z])?[º°]?\s*[-–]?\s*', '', txt_text, flags=re.IGNORECASE)

        if json_clean != txt_clean:
            # Calcula diferença
            diff_ratio = len(set(json_clean.split()) ^ set(txt_clean.split())) / max(len(json_clean.split()), len(txt_clean.split()), 1)

            divergencias['texto_diferente'].append({
                'artigo': num,
                'json_preview': json_clean[:200] + '...' if len(json_clean) > 200 else json_clean,
                'txt_preview': txt_clean[:200] + '...' if len(txt_clean) > 200 else txt_clean,
                'diff_ratio': diff_ratio
            })

        # Compara estruturas
        json_struct = count_structures(json_text)
        txt_struct = count_structures(txt_text)

        if json_struct != txt_struct:
            divergencias['estrutura_diferente'].append({
                'artigo': num,
                'json_struct': json_struct,
                'txt_struct': txt_struct
            })

    return divergencias, len(json_nums), len(txt_nums), len(comuns)

def main():
    base_path = Path(r'D:\meta novo\Metav2\public')
    json_path = base_path / 'codigp_v2.json'
    txt_path = base_path / 'leioficial.txt'

    print("=" * 80)
    print("RELATÓRIO DE COMPARAÇÃO: JSON vs TXT OFICIAL")
    print("=" * 80)
    print()

    # Parse arquivos
    print("Carregando arquivos...")
    txt_articles = parse_txt_articles(txt_path)
    json_articles, raw_items = parse_json_articles(json_path)

    print(f"  - JSON: {len(json_articles)} artigos encontrados (de {len(raw_items)} itens)")
    print(f"  - TXT:  {len(txt_articles)} artigos encontrados")
    print()

    # Debug: mostrar primeiros artigos de cada
    print("Primeiros artigos encontrados:")
    print(f"  JSON: {sorted(list(json_articles.keys())[:10], key=lambda x: (len(x), x))}")
    print(f"  TXT:  {sorted(list(txt_articles.keys())[:10], key=lambda x: (len(x), x))}")
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
    print("DIVERGÊNCIAS ENCONTRADAS")
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
            print(f"    - Art. {art}")
    else:
        print("\n[2] ARTIGOS APENAS NO TXT: Nenhum")

    # Textos diferentes
    if divergencias['texto_diferente']:
        print(f"\n[3] ARTIGOS COM TEXTO DIFERENTE ({len(divergencias['texto_diferente'])}):")
        for item in divergencias['texto_diferente'][:20]:  # Limita a 20
            print(f"\n    Art. {item['artigo']} (diferença: {item['diff_ratio']:.1%}):")
            print(f"      JSON: {item['json_preview'][:100]}...")
            print(f"      TXT:  {item['txt_preview'][:100]}...")
        if len(divergencias['texto_diferente']) > 20:
            print(f"\n    ... e mais {len(divergencias['texto_diferente']) - 20} artigos com diferenças")
    else:
        print("\n[3] ARTIGOS COM TEXTO DIFERENTE: Nenhum")

    # Estruturas diferentes
    if divergencias['estrutura_diferente']:
        print(f"\n[4] ARTIGOS COM ESTRUTURA DIFERENTE ({len(divergencias['estrutura_diferente'])}):")
        for item in divergencias['estrutura_diferente'][:10]:
            print(f"    Art. {item['artigo']}:")
            print(f"      JSON: {item['json_struct']}")
            print(f"      TXT:  {item['txt_struct']}")
        if len(divergencias['estrutura_diferente']) > 10:
            print(f"    ... e mais {len(divergencias['estrutura_diferente']) - 10} artigos")
    else:
        print("\n[4] ARTIGOS COM ESTRUTURA DIFERENTE: Nenhum")

    # Conclusão
    print()
    print("=" * 80)
    print("CONCLUSÃO")
    print("=" * 80)

    total_divergencias = (
        len(divergencias['apenas_json']) +
        len(divergencias['apenas_txt']) +
        len(divergencias['texto_diferente'])
    )

    if total_divergencias == 0:
        print("O JSON está FIEL ao TXT oficial. Nenhuma divergência encontrada.")
    else:
        print(f"DIVERGÊNCIAS DETECTADAS: {total_divergencias} problemas encontrados.")
        print(f"  - {len(divergencias['apenas_json'])} artigos apenas no JSON")
        print(f"  - {len(divergencias['apenas_txt'])} artigos apenas no TXT")
        print(f"  - {len(divergencias['texto_diferente'])} artigos com texto diferente")
        print("\nO JSON NÃO está totalmente fiel ao TXT oficial.")

if __name__ == '__main__':
    main()
