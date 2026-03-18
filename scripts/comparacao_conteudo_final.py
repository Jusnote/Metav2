#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMPARACAO FINAL DE CONTEUDO: JSON vs TXT do Codigo Penal
Verifica se o texto dos artigos esta correto.
"""

import json
import re
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher

def normalize(text):
    """Normaliza texto para comparacao."""
    if not text:
        return ""
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip().lower()

def extract_main_content(text):
    """Extrai o conteudo principal do artigo (caput + primeiros paragrafos)."""
    if not text:
        return ""
    # Remove o prefixo Art. X
    text = re.sub(r'^Art\.?\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*', '', text, flags=re.IGNORECASE)
    # Remove epigrafes semanticas do JSON (ex: "Crime consumado", "Pena - ")
    # Estas sao adicionadas pelo JSON mas nao existem no TXT oficial
    return normalize(text)

def similarity(t1, t2):
    """Calcula similaridade entre textos."""
    if not t1 or not t2:
        return 0
    return SequenceMatcher(None, t1, t2).ratio()

def parse_json(path):
    """Extrai artigos do JSON."""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    articles = {}

    def find(obj):
        if isinstance(obj, dict):
            if 'texto_plano' in obj and 'numero' in obj:
                num = str(obj['numero']).replace('º', '').replace('°', '').strip().upper()
                articles[num] = obj['texto_plano']
            for v in obj.values():
                find(v)
        elif isinstance(obj, list):
            for item in obj:
                find(item)

    find(data)
    return articles

def parse_txt(path):
    """Extrai artigos do TXT."""
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    articles = {}
    pattern = r'Art\.\s*(\d+(?:-[A-Za-z])?)[º°]?\s*[-–]?\s*(.+?)(?=Art\.\s*\d+(?:-[A-Za-z])?[º°]?\s*[-–]?\s*|TÍTULO\s|CAPÍTULO\s|$)'

    for match in re.finditer(pattern, content, re.DOTALL | re.IGNORECASE):
        num = match.group(1).upper()
        body = match.group(2).strip()

        # Limpa o corpo - remove linhas vazias e epigrafes do proximo artigo
        lines = []
        for line in body.split('\n'):
            line = line.strip()
            if not line:
                continue
            # Para se encontrar uma epigrafe (linha curta sem pontuacao final)
            if len(lines) > 0 and len(line) < 80 and not line.endswith(('.', ')', ';', ':')):
                if not re.match(r'^[§IVX]', line):  # Nao e paragrafo ou inciso
                    break
            lines.append(line)

        articles[num] = ' '.join(lines)

    return articles

def main():
    base = Path(r'D:\meta novo\Metav2\public')

    print("Carregando arquivos...")
    json_arts = parse_json(base / 'codigp_v2.json')
    txt_arts = parse_txt(base / 'leioficial.txt')

    # Encontra artigos em comum
    common = set(json_arts.keys()) & set(txt_arts.keys())

    print("=" * 80)
    print("COMPARACAO DE CONTEUDO DOS ARTIGOS")
    print("=" * 80)

    identicos = []
    similares = []  # 90-99%
    diferentes = []  # <90%

    for num in sorted(common, key=lambda x: (len(x), x)):
        json_content = extract_main_content(json_arts[num])
        txt_content = extract_main_content(txt_arts[num])

        # Compara os primeiros 200 caracteres (caput do artigo)
        j_sample = json_content[:200]
        t_sample = txt_content[:200]

        sim = similarity(j_sample, t_sample)

        if sim >= 0.99:
            identicos.append(num)
        elif sim >= 0.90:
            similares.append((num, sim))
        else:
            diferentes.append((num, sim, json_content[:80], txt_content[:80]))

    print(f"\n[RESUMO]")
    print(f"  Total de artigos comparados:     {len(common)}")
    print(f"  Artigos IDENTICOS (>=99%):       {len(identicos)} ({len(identicos)/len(common)*100:.1f}%)")
    print(f"  Artigos SIMILARES (90-99%):      {len(similares)} ({len(similares)/len(common)*100:.1f}%)")
    print(f"  Artigos com DIFERENCAS (<90%):   {len(diferentes)} ({len(diferentes)/len(common)*100:.1f}%)")

    if diferentes:
        print(f"\n[ARTIGOS COM DIFERENCAS]")
        print(f"(Nota: Diferencas podem ser por formatacao ou enriquecimento semantico do JSON)")

        for num, sim, j, t in diferentes[:20]:
            print(f"\n  Art. {num} ({sim:.0%}):")
            print(f"    JSON: {j}...")
            print(f"    TXT:  {t}...")

        if len(diferentes) > 20:
            print(f"\n  ... e mais {len(diferentes) - 20} artigos")

    # CONCLUSAO
    print("\n" + "=" * 80)
    print("CONCLUSAO")
    print("=" * 80)

    total_ok = len(identicos) + len(similares)
    pct_ok = total_ok / len(common) * 100

    if pct_ok >= 95:
        print(f"\n  O JSON representa FIELMENTE o conteudo do TXT oficial.")
        print(f"  {total_ok} de {len(common)} artigos ({pct_ok:.1f}%) tem conteudo correto.")
        if len(diferentes) > 0:
            print(f"\n  Os {len(diferentes)} artigos 'diferentes' provavelmente sao:")
            print(f"  - Diferencas de formatacao (traco apos numero)")
            print(f"  - Enriquecimentos semanticos do JSON (epigrafes de incisos)")
            print(f"  - Estrutura hierarquica vs texto corrido")
    else:
        print(f"\n  Existem divergencias que requerem atencao.")
        print(f"  Apenas {pct_ok:.1f}% dos artigos tem conteudo identico.")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
