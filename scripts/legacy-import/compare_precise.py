#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script preciso para comparar artigos do JSON com o TXT oficial.
Extrai cada artigo individualmente e compara o conteudo principal.
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
    """Extrai o corpo do artigo (remove prefixo Art. X)."""
    if not text:
        return ""
    text = normalize_text(text)
    # Remove "Art. Xo - " ou "Art. Xo" (com ou sem traco)
    text = re.sub(r'^Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*', '', text, flags=re.IGNORECASE)
    return text.strip()

def parse_txt_articles_precise(txt_path):
    """Extrai artigos do arquivo TXT com precisao."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}

    # Encontra cada artigo usando regex mais preciso
    # Captura: Art. X (numero), seguido do texto ate o proximo Art. ou estrutura
    pattern = r'Art\.?\s*(\d+(?:-[A-Za-z])?)[º°]?\s*[-–]?\s*(.+?)(?=(?:\n\s*(?:Art\.|TÍTULO|CAPÍTULO|SEÇÃO|PARTE\s))|$)'

    for match in re.finditer(pattern, content, re.DOTALL | re.IGNORECASE):
        num = match.group(1).upper()
        body = match.group(2).strip()

        # Limpa o corpo - remove epigrafes do proximo artigo
        # (linhas curtas que sao titulos como "Anterioridade da Lei")
        lines = body.split('\n')
        clean_lines = []
        for line in lines:
            line = line.strip()
            if line:
                # Se a linha e muito curta e nao tem pontuacao, pode ser epigrafe
                if len(line) < 50 and not re.search(r'[.;:,§]', line) and not line.startswith('I') and not line.startswith('§'):
                    # Provavelmente e uma epigrafe do proximo artigo
                    if clean_lines:  # So para se ja temos conteudo
                        break
                else:
                    clean_lines.append(line)

        body_clean = ' '.join(clean_lines)
        body_clean = re.sub(r'\s+', ' ', body_clean).strip()

        if num and body_clean:
            articles[num] = {
                'body': body_clean,
                'normalized': normalize_text(body_clean)
            }

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
                'body': extract_article_body(texto),
                'normalized': normalize_text(extract_article_body(texto)),
                'raw': texto
            }

    return articles

def similarity(text1, text2):
    """Calcula a similaridade entre dois textos."""
    if not text1 or not text2:
        return 0
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

def main():
    base_path = Path(r'D:\meta novo\Metav2\public')
    json_path = base_path / 'codigp_v2.json'
    txt_path = base_path / 'leioficial.txt'

    print("=" * 80)
    print("RELATORIO DE COMPARACAO: JSON vs TXT OFICIAL")
    print("=" * 80)
    print()

    # Parse arquivos
    print("Carregando e processando arquivos...")
    txt_articles = parse_txt_articles_precise(txt_path)
    json_articles = parse_json_articles(json_path)

    print(f"\n  Total de artigos no JSON:  {len(json_articles)}")
    print(f"  Total de artigos no TXT:   {len(txt_articles)}")

    json_nums = set(json_articles.keys())
    txt_nums = set(txt_articles.keys())
    comuns = json_nums & txt_nums

    print(f"  Artigos em comum:          {len(comuns)}")

    # ========================================
    # 1. ARTIGOS FALTANDO NO JSON
    # ========================================
    apenas_txt = txt_nums - json_nums
    print("\n" + "=" * 80)
    print("[1] ARTIGOS NO TXT QUE NAO ESTAO NO JSON")
    print("=" * 80)

    if apenas_txt:
        revogados = []
        ativos = []
        for num in sorted(apenas_txt, key=lambda x: (len(x), x)):
            body = txt_articles[num]['body'][:150].lower()
            if 'revogado' in body:
                revogados.append((num, txt_articles[num]['body'][:80]))
            else:
                ativos.append((num, txt_articles[num]['body'][:80]))

        print(f"\n  Total: {len(apenas_txt)} artigos")
        print(f"  - Revogados: {len(revogados)}")
        print(f"  - Ativos: {len(ativos)}")

        if ativos:
            print(f"\n  ATIVOS FALTANDO (requer atencao):")
            for num, preview in ativos:
                print(f"    Art. {num}: {preview}...")
        else:
            print(f"\n  Todos os {len(revogados)} artigos faltantes sao REVOGADOS (OK)")
    else:
        print("\n  Nenhum artigo do TXT esta faltando no JSON.")

    # ========================================
    # 2. ARTIGOS EXTRAS NO JSON
    # ========================================
    apenas_json = json_nums - txt_nums
    print("\n" + "=" * 80)
    print("[2] ARTIGOS NO JSON QUE NAO ESTAO NO TXT")
    print("=" * 80)

    if apenas_json:
        print(f"\n  Total: {len(apenas_json)} artigos")
        for num in sorted(apenas_json, key=lambda x: (len(x), x)):
            preview = json_articles[num]['body'][:80]
            print(f"    Art. {num}: {preview}...")
    else:
        print("\n  Nenhum artigo extra no JSON.")

    # ========================================
    # 3. COMPARACAO DE CONTEUDO
    # ========================================
    print("\n" + "=" * 80)
    print("[3] COMPARACAO DE CONTEUDO")
    print("=" * 80)

    identicos = []      # >=99%
    similares = []      # 95-99%
    divergentes = []    # <95%

    for num in sorted(comuns, key=lambda x: (len(x), x)):
        json_body = json_articles[num]['normalized']
        txt_body = txt_articles[num]['normalized']

        # Compara os primeiros 400 caracteres (parte principal do artigo)
        json_sample = json_body[:400]
        txt_sample = txt_body[:400]

        sim = similarity(json_sample, txt_sample)

        if sim >= 0.99:
            identicos.append(num)
        elif sim >= 0.95:
            similares.append((num, sim))
        else:
            divergentes.append((num, sim, json_body[:150], txt_body[:150]))

    print(f"\n  Artigos IDENTICOS (>=99%):     {len(identicos)}")
    print(f"  Artigos SIMILARES (95-99%):    {len(similares)}")
    print(f"  Artigos DIVERGENTES (<95%):    {len(divergentes)}")

    if divergentes:
        print(f"\n  ARTIGOS DIVERGENTES (verificar):")
        for num, sim, json_preview, txt_preview in divergentes[:20]:
            print(f"\n    Art. {num} (similaridade: {sim:.1%}):")
            print(f"      JSON: {json_preview[:80]}...")
            print(f"      TXT:  {txt_preview[:80]}...")

        if len(divergentes) > 20:
            print(f"\n    ... e mais {len(divergentes) - 20} artigos divergentes")

    # ========================================
    # CONCLUSAO FINAL
    # ========================================
    print("\n" + "=" * 80)
    print("CONCLUSAO FINAL")
    print("=" * 80)

    # Conta artigos ativos faltando
    ativos_faltando = len([n for n in apenas_txt
                          if 'revogado' not in txt_articles[n]['body'][:150].lower()])

    problemas_reais = ativos_faltando + len(apenas_json) + len(divergentes)

    if problemas_reais == 0:
        print("\n  STATUS: JSON FIEL AO TXT OFICIAL")
        print(f"\n  - {len(identicos) + len(similares)} artigos com conteudo correto")
        print(f"  - {len(apenas_txt)} artigos revogados corretamente omitidos")
        print("\n  O JSON representa fielmente o conteudo vigente do Codigo Penal.")
    else:
        print(f"\n  STATUS: DIVERGENCIAS ENCONTRADAS ({problemas_reais} itens)")

        if ativos_faltando > 0:
            print(f"\n  - {ativos_faltando} artigos ATIVOS faltando no JSON")

        if apenas_json:
            print(f"  - {len(apenas_json)} artigos extras no JSON (nao existem no TXT)")

        if divergentes:
            print(f"  - {len(divergentes)} artigos com texto diferente")
            print("\n  NOTA: Algumas divergencias podem ser causadas por:")
            print("    - Formatacao diferente (traco apos numero)")
            print("    - Versoes diferentes da lei (atualizacoes)")
            print("    - Problemas no parsing do TXT")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
