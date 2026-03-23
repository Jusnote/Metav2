#!/usr/bin/env python3
"""
Script final para comparar artigos do JSON com o TXT oficial.
Foco em identificar divergencias REAIS de conteudo.
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

def extract_article_number(text):
    """Extrai o numero do artigo do texto."""
    match = re.match(r'Art\.?\s*(\d+(?:-[A-Za-z])?)[º°]?\s*[-–]?\s*', text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return None

def clean_article_text(text):
    """Remove prefixo do artigo e normaliza para comparacao."""
    if not text:
        return ""
    text = normalize_text(text)
    # Remove "Art. Xo - " ou "Art. Xo"
    text = re.sub(r'^Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*', '', text, flags=re.IGNORECASE)
    # Normaliza tracoes
    text = re.sub(r'[-–—]', '-', text)
    return text.strip()

def parse_txt_articles(txt_path):
    """Extrai artigos do arquivo TXT oficial."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}
    # Encontra todos os artigos
    pattern = r'(Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*)'
    parts = re.split(pattern, content, flags=re.IGNORECASE)

    i = 1
    while i < len(parts):
        prefix = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""

        art_num = extract_article_number(prefix)
        if art_num:
            # Para o TXT, pegamos so ate encontrar um marcador estrutural
            # (TITULO, CAPITULO, SECAO, etc.) ou outro artigo
            body_clean = body
            for marker in ['TÍTULO', 'CAPÍTULO', 'SEÇÃO', 'PARTE', 'T\xc3\x8dTULO']:
                idx = body_clean.upper().find(marker)
                if idx > 0:
                    body_clean = body_clean[:idx]

            full_text = prefix + body_clean
            articles[art_num] = {
                'raw': full_text.strip(),
                'clean': clean_article_text(full_text)
            }
        i += 2

    return articles

def parse_json_articles(json_path):
    """Extrai artigos do arquivo JSON."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    articles = {}

    def find_articles_recursive(obj):
        items = []
        if isinstance(obj, dict):
            if 'texto_plano' in obj:
                items.append(obj)
            for value in obj.values():
                items.extend(find_articles_recursive(value))
        elif isinstance(obj, list):
            for item in obj:
                items.extend(find_articles_recursive(item))
        return items

    for item in find_articles_recursive(data):
        art_num = None
        if 'numero' in item:
            art_num = str(item['numero']).replace('º', '').replace('°', '').strip().upper()

        texto = item.get('texto_plano', '')

        if art_num and texto:
            articles[art_num] = {
                'raw': texto.strip(),
                'clean': clean_article_text(texto)
            }

    return articles

def similarity(text1, text2):
    """Calcula a similaridade entre dois textos."""
    return SequenceMatcher(None, text1, text2).ratio()

def main():
    base_path = Path(r'D:\meta novo\Metav2\public')
    json_path = base_path / 'codigp_v2.json'
    txt_path = base_path / 'leioficial.txt'

    print("=" * 80)
    print("RELATORIO DE COMPARACAO: JSON vs TXT OFICIAL")
    print("=" * 80)
    print()

    # Parse arquivos
    txt_articles = parse_txt_articles(txt_path)
    json_articles = parse_json_articles(json_path)

    print(f"Total de artigos no JSON:  {len(json_articles)}")
    print(f"Total de artigos no TXT:   {len(txt_articles)}")
    print()

    json_nums = set(json_articles.keys())
    txt_nums = set(txt_articles.keys())
    comuns = json_nums & txt_nums

    print(f"Artigos em comum:          {len(comuns)}")
    print()

    # 1. Artigos faltando no JSON
    apenas_txt = txt_nums - json_nums
    if apenas_txt:
        print("-" * 80)
        print(f"[1] ARTIGOS FALTANDO NO JSON ({len(apenas_txt)}):")
        print("-" * 80)
        revogados = []
        ativos = []
        for num in sorted(apenas_txt, key=lambda x: (len(x), x)):
            txt_clean = txt_articles[num]['clean'][:100].lower()
            if 'revogado' in txt_clean or 'revogada' in txt_clean:
                revogados.append(num)
            else:
                ativos.append(num)

        if revogados:
            print(f"\n  Artigos REVOGADOS (nao precisam estar no JSON): {len(revogados)}")
            for num in revogados:
                preview = txt_articles[num]['clean'][:60]
                print(f"    - Art. {num}: {preview}...")

        if ativos:
            print(f"\n  Artigos ATIVOS faltando (PROBLEMA): {len(ativos)}")
            for num in ativos:
                preview = txt_articles[num]['clean'][:60]
                print(f"    - Art. {num}: {preview}...")
    else:
        print("[1] Todos os artigos do TXT estao no JSON.")

    # 2. Artigos extras no JSON (nao estao no TXT)
    apenas_json = json_nums - txt_nums
    if apenas_json:
        print()
        print("-" * 80)
        print(f"[2] ARTIGOS EXTRAS NO JSON ({len(apenas_json)}) - nao encontrados no TXT:")
        print("-" * 80)
        for num in sorted(apenas_json, key=lambda x: (len(x), x)):
            preview = json_articles[num]['clean'][:60]
            print(f"    - Art. {num}: {preview}...")
    else:
        print("\n[2] Nenhum artigo extra no JSON.")

    # 3. Comparar conteudo dos artigos em comum
    print()
    print("-" * 80)
    print("[3] COMPARACAO DE CONTEUDO DOS ARTIGOS EM COMUM:")
    print("-" * 80)

    divergentes = []
    identicos = 0
    quase_identicos = 0  # >98% similaridade

    for num in sorted(comuns, key=lambda x: (len(x), x)):
        json_clean = json_articles[num]['clean']
        txt_clean = txt_articles[num]['clean']

        # Compara apenas o inicio do texto (primeiro paragrafo principal)
        # porque o TXT pode ter texto adicional apos o artigo
        json_first = json_clean[:500]  # Primeiros 500 chars
        txt_first = txt_clean[:500]

        sim = similarity(json_first, txt_first)

        if sim >= 0.99:
            identicos += 1
        elif sim >= 0.98:
            quase_identicos += 1
        elif sim < 0.90:  # Divergencia significativa
            divergentes.append({
                'num': num,
                'sim': sim,
                'json': json_clean[:200],
                'txt': txt_clean[:200]
            })

    print(f"\n  Artigos identicos (>=99% similaridade):       {identicos}")
    print(f"  Artigos quase identicos (98-99%):             {quase_identicos}")
    print(f"  Artigos com divergencia significativa (<90%): {len(divergentes)}")

    if divergentes:
        print(f"\n  Detalhes das divergencias significativas:")
        for item in divergentes[:15]:  # Mostra ate 15
            print(f"\n    Art. {item['num']} (similaridade: {item['sim']:.1%}):")
            print(f"      JSON: {item['json'][:100]}...")
            print(f"      TXT:  {item['txt'][:100]}...")
        if len(divergentes) > 15:
            print(f"\n    ... e mais {len(divergentes) - 15} artigos com divergencias")

    # CONCLUSAO
    print()
    print("=" * 80)
    print("CONCLUSAO")
    print("=" * 80)

    # Calcula artigos ativos faltando
    ativos_faltando = len([n for n in apenas_txt if 'revogado' not in txt_articles[n]['clean'][:100].lower()])

    if len(divergentes) == 0 and ativos_faltando == 0 and len(apenas_json) == 0:
        print("\nO JSON esta FIEL ao TXT oficial!")
        print(f"- {identicos + quase_identicos} artigos com conteudo identico ou equivalente")
        print(f"- {len([n for n in apenas_txt if 'revogado' in txt_articles[n]['clean'][:100].lower()])} artigos revogados corretamente omitidos do JSON")
    else:
        total_problemas = len(divergentes) + ativos_faltando + len(apenas_json)
        print(f"\nDIVERGENCIAS ENCONTRADAS: {total_problemas} problemas potenciais")

        if ativos_faltando > 0:
            print(f"  - {ativos_faltando} artigos ATIVOS faltando no JSON (verificar manualmente)")
        if len(apenas_json) > 0:
            print(f"  - {len(apenas_json)} artigos no JSON que nao existem no TXT")
        if len(divergentes) > 0:
            print(f"  - {len(divergentes)} artigos com texto significativamente diferente")

        # Verificar se sao divergencias reais ou problemas de parsing
        print("\n  NOTA: Muitas 'divergencias' podem ser devido a:")
        print("    - Diferencas de formatacao (traco apos numero do artigo)")
        print("    - Titulos/capitulos incluidos no parsing do TXT")
        print("    - Incisos com numeracao romana (I, II, III)")
        print("    Recomenda-se verificacao manual dos casos listados.")

if __name__ == '__main__':
    main()
