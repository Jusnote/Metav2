#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VALIDADOR PERFEITO v2.0 - Arquitetura de 3 Camadas

FONTE: HTML Planalto (download automático + BeautifulSoup)

CAMADA 1: Validação INTERNA (JSON consigo mesmo)
    - Hierarquia válida: Art → § → Inciso → Alínea
    - Sequências contínuas: I, II, III (sem pular)
    - Consistência: texto_plano = Σ plate_content
    - Slugs válidos

CAMADA 2: Validação EXTERNA - ESTRUTURA (JSON vs HTML parseado)
    - Partes, Livros, Títulos, Capítulos, Seções
    - Artigos, §§, Incisos, Alíneas

CAMADA 3: Validação EXTERNA - TEXTO (2 passes)
    - Pass 1: sem normalização → detecta TUDO (incluindo formatação)
    - Pass 2: com normalização → classifica severidade

OUTPUT: Divergências classificadas por severidade (CRITICO, ALTO, MEDIO, BAIXO, FORMATACAO)

Uso:
    python validator_perfeito_v2.py <json_path> --url <planalto_url>
    python validator_perfeito_v2.py <json_path> --txt <txt_path>
    python validator_perfeito_v2.py <json_path> --url <url> --html report.html

Exemplo:
    python validator_perfeito_v2.py ../public/codigp_v2.json --url "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm"
"""

import json
import re
import sys
import argparse
import hashlib
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Set, Any
from difflib import SequenceMatcher, unified_diff
from collections import defaultdict
from datetime import datetime
import os

# Dependências opcionais
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich.tree import Tree
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

console = Console() if RICH_AVAILABLE else None


# =============================================================================
# CONFIGURAÇÕES
# =============================================================================

CACHE_DIR = Path(".cache_validator")
CACHE_EXPIRY_HOURS = 24


# =============================================================================
# TIPOS E ESTRUTURAS
# =============================================================================

@dataclass
class Divergencia:
    """Representa uma divergência encontrada"""
    tipo: str
    severidade: str  # 'CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'FORMATACAO', 'INFO'
    categoria: str   # 'INTERNA', 'ESTRUTURA', 'TEXTO'
    artigo: str
    campo: str
    esperado: str
    encontrado: str
    linha_fonte: int = 0
    posicao_json: str = ""
    detalhes: str = ""
    raw_esperado: str = ""  # Valor sem normalização
    raw_encontrado: str = ""  # Valor sem normalização


@dataclass
class ArtigoFonte:
    """Artigo extraído da fonte (HTML/TXT)"""
    numero: str
    numero_canonico: str
    linha_inicio: int
    linha_fim: int
    caput: str = ""
    caput_raw: str = ""  # Sem normalização
    epigrafe: str = ""
    paragrafos: Dict[str, str] = field(default_factory=dict)
    paragrafos_raw: Dict[str, str] = field(default_factory=dict)
    incisos: Dict[str, str] = field(default_factory=dict)
    incisos_raw: Dict[str, str] = field(default_factory=dict)
    alineas: Dict[str, Dict[str, str]] = field(default_factory=dict)
    alineas_raw: Dict[str, Dict[str, str]] = field(default_factory=dict)
    itens: Dict[str, str] = field(default_factory=dict)
    revogado: bool = False
    vetado: bool = False
    contexto: str = ""


@dataclass
class ArtigoJSON:
    """Artigo extraído do JSON"""
    numero: str
    numero_canonico: str
    id: str
    slug: str
    epigrafe: str = ""
    caput: str = ""
    caput_raw: str = ""
    texto_plano: str = ""
    paragrafos: Dict[str, str] = field(default_factory=dict)
    paragrafos_raw: Dict[str, str] = field(default_factory=dict)
    incisos: Dict[str, str] = field(default_factory=dict)
    incisos_raw: Dict[str, str] = field(default_factory=dict)
    alineas: Dict[str, Dict[str, str]] = field(default_factory=dict)
    alineas_raw: Dict[str, Dict[str, str]] = field(default_factory=dict)
    itens: Dict[str, str] = field(default_factory=dict)
    vigente: bool = True
    contexto: str = ""
    path: dict = field(default_factory=dict)
    plate_content: list = field(default_factory=list)


@dataclass
class EstruturaHierarquica:
    """Estrutura hierárquica da lei"""
    partes: List[Tuple[str, int]] = field(default_factory=list)
    livros: List[Tuple[str, int]] = field(default_factory=list)
    titulos: List[Tuple[str, int]] = field(default_factory=list)
    capitulos: List[Tuple[str, int]] = field(default_factory=list)
    secoes: List[Tuple[str, int]] = field(default_factory=list)


# =============================================================================
# FUNÇÕES DE CONVERSÃO
# =============================================================================

def arabico_para_romano(n: int) -> str:
    """Converte número arábico para romano"""
    if n <= 0:
        return str(n)
    valores = [
        (1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'),
        (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'),
        (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')
    ]
    resultado = ''
    for valor, numeral in valores:
        while n >= valor:
            resultado += numeral
            n -= valor
    return resultado


def romano_para_arabico(s: str) -> int:
    """Converte número romano para arábico"""
    valores = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    resultado = 0
    prev = 0
    for c in reversed(s.upper()):
        curr = valores.get(c, 0)
        if curr < prev:
            resultado -= curr
        else:
            resultado += curr
        prev = curr
    return resultado


# =============================================================================
# FUNÇÕES DE NORMALIZAÇÃO
# =============================================================================

def canonizar_numero(num: str) -> str:
    """Normaliza número do artigo para comparação (usado para MATCH)
    Ex: "1º", "1°", "1 ", "1-A", "1 -A" -> "1A"
    """
    if not num:
        return ""
    result = str(num).upper()
    # Remove º, °, ª
    result = re.sub(r'[º°ª]', '', result)
    # Remove espaços
    result = re.sub(r'\s+', '', result)
    # Remove traço antes de letra (1-A -> 1A)
    result = re.sub(r'-([A-Z])', r'\1', result)
    return result.strip()


def normalizar_texto(texto: str) -> str:
    """Normaliza texto para comparação de CONTEÚDO"""
    if not texto:
        return ""
    result = texto.strip()

    # Remove quebras de linha
    result = result.replace('\n', ' ').replace('\r', ' ')

    # Remove múltiplos espaços
    result = re.sub(r'\s+', ' ', result)

    # Normaliza aspas
    result = result.replace('"', '"').replace('"', '"').replace(''', "'").replace(''', "'")

    # Normaliza traços (todos os tipos para hífen simples)
    result = result.replace('–', '-').replace('—', '-').replace('‐', '-').replace('−', '-')

    # Remove prefixo Art. X (case insensitive, mais robusto)
    # Padrões: "Art. 10", "Art 10", "Art. 10.", "Art. 10 -", "Art. 10-A", "Art. 121-A."
    # IMPORTANTE: sufixo de letra deve estar COLADO ao número (121A ou 121-A), NÃO separado por espaço
    # Por isso NÃO tem \s* antes do grupo de sufixo
    result = re.sub(
        r'^\s*Art\.?\s*\d+[º°ª]?(?:-[A-Za-z]+|[A-Za-z](?=\s|$|[.,;:]))?\s*[-–—.]?\s*',
        '', result, flags=re.IGNORECASE
    )

    # Remove prefixo de parágrafo no início
    result = re.sub(r'^\s*§\s*\d+[º°ª]?\s*[-–—.\s]*', '', result)
    result = re.sub(r'^\s*Parágrafo\s+único\s*[-–—.\s]*', '', result, flags=re.IGNORECASE)

    # Remove prefixo de inciso romano no início
    result = re.sub(r'^\s*[IVXLCDM]+(?:\s*-\s*[A-Za-z0-9]+)?\s*[-–—]\s*', '', result)

    # Remove prefixo de alínea no início
    result = re.sub(r'^\s*[a-z](?:\s*-\s*[A-Za-z0-9]+)?\s*[)\-–—]\s*', '', result)

    # Remove espaços antes de pontuação
    result = re.sub(r'\s+([.,;:!?)])', r'\1', result)

    # Remove espaços extras novamente
    result = re.sub(r'\s+', ' ', result)

    return result.strip()


def normalizar_paragrafo(texto: str) -> str:
    """Normaliza texto de parágrafo"""
    # normalizar_texto já remove prefixos de parágrafo
    return normalizar_texto(texto)


def normalizar_inciso(texto: str) -> str:
    """Normaliza texto de inciso"""
    # normalizar_texto já remove prefixos de inciso
    return normalizar_texto(texto)


def normalizar_alinea(texto: str) -> str:
    """Normaliza texto de alínea"""
    result = normalizar_texto(texto)
    result = re.sub(r'^[a-z](?:-[A-Za-z0-9]+)?\s*[)\-–—.]\s*', '', result)
    return result.strip()


# =============================================================================
# DOWNLOAD E CACHE DO HTML
# =============================================================================

class FontePlanalto:
    """Gerencia download e cache do HTML do Planalto"""

    # Seletores CSS para diferentes layouts do Planalto
    SELETORES = [
        'div.textoLei',
        'div#texto',
        'div.texto',
        'div#conteudo',
        'div.conteudo',
        'table[width="600"]',
        'body',
    ]

    def __init__(self, url: str = None, txt_path: str = None, use_cache: bool = True):
        self.url = url
        self.txt_path = txt_path
        self.use_cache = use_cache
        self.texto_raw = ""
        self.linhas = []

    def carregar(self) -> str:
        """Carrega o texto da fonte (HTML ou TXT)"""
        if self.txt_path:
            return self._carregar_txt()
        elif self.url:
            return self._carregar_html()
        else:
            raise ValueError("Nenhuma fonte especificada (url ou txt_path)")

    def _carregar_txt(self) -> str:
        """Carrega de arquivo TXT local"""
        with open(self.txt_path, 'r', encoding='utf-8') as f:
            self.texto_raw = f.read()
        self.linhas = self.texto_raw.split('\n')
        return self.texto_raw

    def _carregar_html(self) -> str:
        """Baixa e extrai texto do HTML do Planalto"""
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests não instalado. Use: pip install requests")
        if not BS4_AVAILABLE:
            raise ImportError("beautifulsoup4 não instalado. Use: pip install beautifulsoup4")

        # Verifica cache
        if self.use_cache:
            cached = self._get_cache()
            if cached:
                print(f"[CACHE] Usando versão em cache do HTML")
                self.texto_raw = cached
                self.linhas = cached.split('\n')
                return cached

        # Download
        print(f"[DOWNLOAD] Baixando: {self.url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        resp = requests.get(self.url, headers=headers, timeout=30)
        resp.encoding = 'utf-8'

        if resp.status_code != 200:
            raise Exception(f"Erro ao baixar: HTTP {resp.status_code}")

        # Parse HTML
        soup = BeautifulSoup(resp.text, 'html.parser')

        # Remove elementos indesejados
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript']):
            tag.decompose()

        # Tenta múltiplos seletores
        texto = ""
        for seletor in self.SELETORES:
            elemento = soup.select_one(seletor)
            if elemento:
                texto_candidato = elemento.get_text(separator='\n', strip=True)
                # Valida se tem conteúdo suficiente (mais de 500 chars)
                if len(texto_candidato) > 500:
                    texto = texto_candidato
                    print(f"[HTML] Extraído com seletor: {seletor}")
                    break

        if not texto:
            # Fallback: body inteiro
            texto = soup.body.get_text(separator='\n', strip=True) if soup.body else ""
            print("[HTML] Usando fallback: body completo")

        # Salva em cache
        if self.use_cache:
            self._set_cache(texto)

        self.texto_raw = texto
        self.linhas = texto.split('\n')
        return texto

    def _get_cache_path(self) -> Path:
        """Retorna caminho do arquivo de cache"""
        CACHE_DIR.mkdir(exist_ok=True)
        url_hash = hashlib.md5(self.url.encode()).hexdigest()
        return CACHE_DIR / f"{url_hash}.txt"

    def _get_cache(self) -> Optional[str]:
        """Retorna conteúdo do cache se válido"""
        cache_path = self._get_cache_path()
        if not cache_path.exists():
            return None

        # Verifica idade do cache
        age_hours = (datetime.now().timestamp() - cache_path.stat().st_mtime) / 3600
        if age_hours > CACHE_EXPIRY_HOURS:
            return None

        return cache_path.read_text(encoding='utf-8')

    def _set_cache(self, content: str):
        """Salva conteúdo em cache"""
        cache_path = self._get_cache_path()
        cache_path.write_text(content, encoding='utf-8')
        print(f"[CACHE] Salvo em: {cache_path}")


# =============================================================================
# PARSER DA FONTE (HTML/TXT)
# =============================================================================

class ParserFonte:
    """Parser completo do texto oficial (extraído de HTML ou TXT)"""

    # Regex patterns
    RE_ARTIGO = re.compile(r'^\s*Art\.?\s*(\d+(?:-[A-Z]+|[A-Z])?)[º°ª]?\s*[-–—.]?\s*(.*)$', re.IGNORECASE)
    RE_PARAGRAFO = re.compile(r'^\s*§\s*(\d+)[º°ª]?\s*[-–—.]?\s*(.*)$')
    RE_PARAGRAFO_UNICO = re.compile(r'^\s*Parágrafo\s+único\s*[-–—.]?\s*(.*)$', re.IGNORECASE)
    RE_INCISO = re.compile(r'^\s*([IVXLCDM]+(?:-[A-Za-z0-9]+)?)\s*[-–—]\s*(.*)$')
    RE_ALINEA = re.compile(r'^\s*([a-z](?:-[A-Za-z0-9]+)?)\s*[)\-–—]\s*(.*)$')
    RE_ITEM = re.compile(r'^\s*(\d+)\s*[)\-.]\s*(.*)$')

    RE_PARTE = re.compile(r'^\s*PARTE\s+(GERAL|ESPECIAL|[IVX]+)', re.IGNORECASE)
    RE_LIVRO = re.compile(r'^\s*LIVRO\s+([IVX]+)', re.IGNORECASE)
    RE_TITULO = re.compile(r'^\s*T[ÍI]TULO\s+([IVX]+(?:-[A-Z]+)?)', re.IGNORECASE)
    RE_CAPITULO = re.compile(r'^\s*CAP[ÍI]TULO\s+([IVX]+(?:-[A-Z]+)?)', re.IGNORECASE)
    RE_SECAO = re.compile(r'^\s*SE[ÇC][ÃA]O\s+([IVX]+(?:-[A-Z]+)?)', re.IGNORECASE)

    RE_REVOGADO = re.compile(r'\((?:Revogad[oa]|Suprimid[oa])', re.IGNORECASE)
    RE_VETADO = re.compile(r'\(VETAD[OA]\)', re.IGNORECASE)

    # Detecta epígrafes (títulos antes dos artigos) - NÃO devem ser concatenadas
    # Ex: "Frações não computáveis da pena (Redação dada pela Lei nº 7.209, de 11.7.1984)"
    RE_EPIGRAFE = re.compile(
        r'^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^.!?]*\s*\((?:Redação|Incluíd[oa]|Acrescid[oa]|Acrescentad[oa])',
        re.IGNORECASE
    )

    def __init__(self, linhas: List[str]):
        self.linhas = linhas
        self.artigos: Dict[str, ArtigoFonte] = {}
        self.estrutura = EstruturaHierarquica()
        self.contexto_atual = ""

    def parse(self) -> Tuple[Dict[str, ArtigoFonte], EstruturaHierarquica]:
        """Executa o parse completo"""
        artigo_atual: Optional[ArtigoFonte] = None
        inciso_atual: Optional[str] = None
        paragrafo_atual: Optional[str] = None

        for num_linha, linha in enumerate(self.linhas, 1):
            linha_stripped = linha.strip()

            if not linha_stripped:
                continue

            # Detecta estrutura hierárquica
            self._detectar_estrutura(linha_stripped, num_linha)

            # Detecta artigo
            match_art = self.RE_ARTIGO.match(linha_stripped)
            if match_art:
                # Salva artigo anterior
                if artigo_atual:
                    artigo_atual.linha_fim = num_linha - 1
                    self.artigos[artigo_atual.numero_canonico] = artigo_atual

                numero = match_art.group(1)
                texto_raw = match_art.group(2).strip()

                artigo_atual = ArtigoFonte(
                    numero=numero,
                    numero_canonico=canonizar_numero(numero),
                    linha_inicio=num_linha,
                    linha_fim=num_linha,
                    caput_raw=texto_raw,
                    caput=normalizar_texto(texto_raw),
                    contexto=self.contexto_atual,
                    revogado=bool(self.RE_REVOGADO.search(texto_raw)),
                    vetado=bool(self.RE_VETADO.search(texto_raw))
                )
                inciso_atual = None
                paragrafo_atual = None
                continue

            if not artigo_atual:
                continue

            # Detecta parágrafo único
            match_pu = self.RE_PARAGRAFO_UNICO.match(linha_stripped)
            if match_pu:
                texto_raw = match_pu.group(1).strip()
                artigo_atual.paragrafos_raw['unico'] = texto_raw
                artigo_atual.paragrafos['unico'] = normalizar_paragrafo(texto_raw)
                paragrafo_atual = 'unico'
                inciso_atual = None
                continue

            # Detecta parágrafo numerado
            match_par = self.RE_PARAGRAFO.match(linha_stripped)
            if match_par:
                num_par = match_par.group(1)
                texto_raw = match_par.group(2).strip()
                artigo_atual.paragrafos_raw[num_par] = texto_raw
                artigo_atual.paragrafos[num_par] = normalizar_paragrafo(texto_raw)
                paragrafo_atual = num_par
                inciso_atual = None
                continue

            # Detecta inciso
            match_inc = self.RE_INCISO.match(linha_stripped)
            if match_inc:
                num_inc = match_inc.group(1)
                texto_raw = match_inc.group(2).strip()
                artigo_atual.incisos_raw[num_inc] = texto_raw
                artigo_atual.incisos[num_inc] = normalizar_inciso(texto_raw)
                inciso_atual = num_inc
                if num_inc not in artigo_atual.alineas:
                    artigo_atual.alineas[num_inc] = {}
                    artigo_atual.alineas_raw[num_inc] = {}
                continue

            # Detecta alínea
            match_ali = self.RE_ALINEA.match(linha_stripped)
            if match_ali and inciso_atual:
                letra = match_ali.group(1)
                texto_raw = match_ali.group(2).strip()
                if inciso_atual not in artigo_atual.alineas:
                    artigo_atual.alineas[inciso_atual] = {}
                    artigo_atual.alineas_raw[inciso_atual] = {}
                artigo_atual.alineas_raw[inciso_atual][letra] = texto_raw
                artigo_atual.alineas[inciso_atual][letra] = normalizar_alinea(texto_raw)
                continue

            # Detecta item
            match_item = self.RE_ITEM.match(linha_stripped)
            if match_item:
                num_item = match_item.group(1)
                texto_raw = match_item.group(2).strip()
                artigo_atual.itens[num_item] = texto_raw
                continue

            # Verifica se é epígrafe (título antes do próximo artigo) - NÃO concatenar
            if self.RE_EPIGRAFE.match(linha_stripped):
                # É uma epígrafe, não concatenar ao artigo atual
                continue

            # Linha de continuação (só concatena se não for epígrafe ou estrutura)
            # Também não concatena se a linha parece ser um título curto isolado
            if self._e_linha_continuacao(linha_stripped):
                if inciso_atual and inciso_atual in artigo_atual.incisos_raw:
                    artigo_atual.incisos_raw[inciso_atual] += " " + linha_stripped
                    artigo_atual.incisos[inciso_atual] = normalizar_inciso(artigo_atual.incisos_raw[inciso_atual])
                elif paragrafo_atual and paragrafo_atual in artigo_atual.paragrafos_raw:
                    artigo_atual.paragrafos_raw[paragrafo_atual] += " " + linha_stripped
                    artigo_atual.paragrafos[paragrafo_atual] = normalizar_paragrafo(artigo_atual.paragrafos_raw[paragrafo_atual])
                elif artigo_atual.caput_raw:
                    artigo_atual.caput_raw += " " + linha_stripped
                    artigo_atual.caput = normalizar_texto(artigo_atual.caput_raw)

        # Salva último artigo
        if artigo_atual:
            artigo_atual.linha_fim = len(self.linhas)
            self.artigos[artigo_atual.numero_canonico] = artigo_atual

        return self.artigos, self.estrutura

    def _e_linha_continuacao(self, linha: str) -> bool:
        """Verifica se a linha é uma continuação válida do texto anterior"""
        # Não é continuação se for uma epígrafe
        if self.RE_EPIGRAFE.match(linha):
            return False

        # Não é continuação se for estrutura hierárquica
        if (self.RE_PARTE.match(linha) or self.RE_LIVRO.match(linha) or
            self.RE_TITULO.match(linha) or self.RE_CAPITULO.match(linha) or
            self.RE_SECAO.match(linha)):
            return False

        # Não é continuação se for um título curto (menos de 80 chars) que começa com maiúscula
        # e termina com referência de lei
        if len(linha) < 100 and re.search(r'\((?:Redação|Incluíd|Acrescid)', linha, re.IGNORECASE):
            return False

        # É continuação se começa com "Pena" (parte do caput em leis penais)
        if re.match(r'^Pena\s*[-–—]', linha, re.IGNORECASE):
            return True

        # É continuação se começa com letra minúscula (continuação de frase)
        if linha and linha[0].islower():
            return True

        # É continuação se começa com pontuação ou número
        if linha and linha[0] in '.,;:0123456789':
            return True

        # Caso contrário, assume que não é continuação (seguro)
        # Isso pode perder algumas continuações legítimas, mas evita falsos positivos
        return False

    def _detectar_estrutura(self, linha: str, num_linha: int):
        """Detecta elementos de estrutura hierárquica"""
        if self.RE_PARTE.match(linha):
            self.estrutura.partes.append((linha, num_linha))
            self.contexto_atual = linha
        elif self.RE_LIVRO.match(linha):
            self.estrutura.livros.append((linha, num_linha))
            self.contexto_atual = linha
        elif self.RE_TITULO.match(linha):
            self.estrutura.titulos.append((linha, num_linha))
            self.contexto_atual = linha
        elif self.RE_CAPITULO.match(linha):
            self.estrutura.capitulos.append((linha, num_linha))
            self.contexto_atual += " > " + linha
        elif self.RE_SECAO.match(linha):
            self.estrutura.secoes.append((linha, num_linha))


# =============================================================================
# PARSER DO JSON
# =============================================================================

class ParserJSON:
    """Parser do arquivo JSON gerado"""

    def __init__(self, conteudo: dict):
        self.data = conteudo
        self.artigos: Dict[str, ArtigoJSON] = {}
        self.estrutura = EstruturaHierarquica()

    def parse(self) -> Dict[str, ArtigoJSON]:
        """Executa o parse completo"""
        # Extrai estrutura
        lei_info = self.data.get('lei', {})
        estrutura = lei_info.get('estrutura', {})

        for parte in estrutura.get('partes', []):
            if isinstance(parte, dict):
                self.estrutura.partes.append((parte.get('nome', ''), 0))
            else:
                self.estrutura.partes.append((str(parte), 0))

        for livro in estrutura.get('livros', []):
            if isinstance(livro, dict):
                self.estrutura.livros.append((livro.get('nome', ''), 0))
            else:
                self.estrutura.livros.append((str(livro), 0))

        for titulo in estrutura.get('titulos', []):
            if isinstance(titulo, dict):
                self.estrutura.titulos.append((titulo.get('nome', ''), 0))
            else:
                self.estrutura.titulos.append((str(titulo), 0))

        for capitulo in estrutura.get('capitulos', []):
            if isinstance(capitulo, dict):
                self.estrutura.capitulos.append((capitulo.get('nome', ''), 0))
            else:
                self.estrutura.capitulos.append((str(capitulo), 0))

        for secao in estrutura.get('secoes', []):
            if isinstance(secao, dict):
                self.estrutura.secoes.append((secao.get('nome', ''), 0))
            else:
                self.estrutura.secoes.append((str(secao), 0))

        # Processa artigos
        for idx, art_data in enumerate(self.data.get('artigos', [])):
            numero = art_data.get('numero', '')
            numero_canonico = canonizar_numero(numero)

            artigo = ArtigoJSON(
                numero=numero,
                numero_canonico=numero_canonico,
                id=art_data.get('id', ''),
                slug=art_data.get('slug', ''),
                epigrafe=art_data.get('epigrafe', ''),
                texto_plano=art_data.get('texto_plano', ''),
                vigente=art_data.get('vigente', True),
                contexto=art_data.get('contexto', ''),
                path=art_data.get('path', {}),
                plate_content=art_data.get('plate_content', [])
            )

            # Extrai estrutura do plate_content
            self._extrair_estrutura_plate(art_data.get('plate_content', []), artigo)

            self.artigos[numero_canonico] = artigo

        return self.artigos

    def _extrair_estrutura_plate(self, plate_content: list, artigo: ArtigoJSON):
        """Extrai TUDO do plate_content"""
        inciso_atual = None
        paragrafo_atual = None

        for block in plate_content:
            slug = block.get('slug', '')
            search_text = block.get('search_text', '')

            if not slug or not search_text:
                continue

            # CAPUT
            if slug == 'caput':
                artigo.caput_raw = search_text
                artigo.caput = normalizar_texto(search_text)
                continue

            # ALÍNEA
            if 'alinea-' in slug:
                match_alinea = re.search(r'alinea-([a-z])', slug, re.IGNORECASE)
                if match_alinea:
                    letra = match_alinea.group(1).lower()
                    match_inciso = re.search(r'inciso-(\d+)', slug)
                    if match_inciso:
                        inciso_num = arabico_para_romano(int(match_inciso.group(1)))
                        if inciso_num not in artigo.alineas:
                            artigo.alineas[inciso_num] = {}
                            artigo.alineas_raw[inciso_num] = {}
                        artigo.alineas_raw[inciso_num][letra] = search_text
                        artigo.alineas[inciso_num][letra] = normalizar_alinea(search_text)
                    elif inciso_atual:
                        if inciso_atual not in artigo.alineas:
                            artigo.alineas[inciso_atual] = {}
                            artigo.alineas_raw[inciso_atual] = {}
                        artigo.alineas_raw[inciso_atual][letra] = search_text
                        artigo.alineas[inciso_atual][letra] = normalizar_alinea(search_text)
                    else:
                        chave = f"PAR_{paragrafo_atual}" if paragrafo_atual else 'DIRETO'
                        if chave not in artigo.alineas:
                            artigo.alineas[chave] = {}
                            artigo.alineas_raw[chave] = {}
                        artigo.alineas_raw[chave][letra] = search_text
                        artigo.alineas[chave][letra] = normalizar_alinea(search_text)
                continue

            # INCISO
            if 'inciso-' in slug and 'alinea-' not in slug:
                match_inciso = re.search(r'inciso-(\d+)', slug)
                if match_inciso:
                    num_arabico = int(match_inciso.group(1))
                    num_romano = arabico_para_romano(num_arabico)
                    artigo.incisos_raw[num_romano] = search_text
                    artigo.incisos[num_romano] = normalizar_inciso(search_text)
                    inciso_atual = num_romano
                    if num_romano not in artigo.alineas:
                        artigo.alineas[num_romano] = {}
                        artigo.alineas_raw[num_romano] = {}
                continue

            # PARÁGRAFO
            if 'paragrafo-' in slug and 'inciso-' not in slug and 'alinea-' not in slug:
                if '-epigraph' in slug:
                    continue
                match_par = re.search(r'paragrafo-(\d+(?:-[a-z])?|unico)', slug, re.IGNORECASE)
                if match_par:
                    num = match_par.group(1).lower()
                    artigo.paragrafos_raw[num] = search_text
                    artigo.paragrafos[num] = normalizar_paragrafo(search_text)
                    paragrafo_atual = num
                    inciso_atual = None
                continue

            # PENA
            if '.penalty' in slug:
                match_par = re.search(r'paragrafo-(\d+(?:-[a-z])?)', slug)
                if match_par:
                    num = match_par.group(1).lower()
                    if num in artigo.paragrafos_raw:
                        artigo.paragrafos_raw[num] += " " + search_text
                        artigo.paragrafos[num] = normalizar_paragrafo(artigo.paragrafos_raw[num])
                else:
                    if artigo.caput_raw:
                        artigo.caput_raw += " " + search_text
                        artigo.caput = normalizar_texto(artigo.caput_raw)
                continue

            # EPÍGRAFE
            if '_epigrafe' in slug or 'epigrafe' in slug:
                artigo.epigrafe = search_text
                continue


# =============================================================================
# VALIDADOR CAMADA 1: INTERNA
# =============================================================================

class ValidadorInterno:
    """Validação INTERNA: JSON consigo mesmo"""

    def __init__(self, artigos_json: Dict[str, ArtigoJSON]):
        self.artigos = artigos_json
        self.divergencias: List[Divergencia] = []

    def validar(self) -> List[Divergencia]:
        """Executa todas as validações internas"""
        self._validar_hierarquia()
        self._validar_sequencias()
        self._validar_consistencia_texto()
        self._validar_slugs()
        return self.divergencias

    def _validar_hierarquia(self):
        """Valida hierarquia: Art → § → Inciso → Alínea"""
        for num, artigo in self.artigos.items():
            # Verifica se alíneas têm incisos pai
            for inciso_key, alineas in artigo.alineas.items():
                if inciso_key not in artigo.incisos and inciso_key != 'DIRETO' and not inciso_key.startswith('PAR_'):
                    self.divergencias.append(Divergencia(
                        tipo='HIERARQUIA_INVALIDA',
                        severidade='ALTO',
                        categoria='INTERNA',
                        artigo=f"Art. {artigo.numero}",
                        campo=f"Alíneas do inciso {inciso_key}",
                        esperado=f"Inciso {inciso_key} existir",
                        encontrado=f"Inciso {inciso_key} não existe",
                        detalhes=f"Alíneas órfãs: {list(alineas.keys())}"
                    ))

    def _validar_sequencias(self):
        """Valida sequências contínuas (I, II, III sem pular)"""
        for num, artigo in self.artigos.items():
            # Valida sequência de incisos
            incisos = list(artigo.incisos.keys())
            if incisos:
                try:
                    numeros = sorted([romano_para_arabico(i.split('-')[0]) for i in incisos])
                    esperado = list(range(1, len(numeros) + 1))
                    if numeros != esperado:
                        faltando = set(esperado) - set(numeros)
                        if faltando:
                            self.divergencias.append(Divergencia(
                                tipo='SEQUENCIA_INCISO_QUEBRADA',
                                severidade='MEDIO',
                                categoria='INTERNA',
                                artigo=f"Art. {artigo.numero}",
                                campo='incisos',
                                esperado=f"Sequência: {esperado}",
                                encontrado=f"Encontrado: {numeros}",
                                detalhes=f"Faltando: {[arabico_para_romano(f) for f in faltando]}"
                            ))
                except:
                    pass  # Incisos com sufixo podem quebrar a lógica

            # Valida sequência de parágrafos
            pars = [p for p in artigo.paragrafos.keys() if p != 'unico']
            if pars:
                try:
                    numeros = sorted([int(p.split('-')[0]) for p in pars])
                    esperado = list(range(1, len(numeros) + 1))
                    if numeros != esperado:
                        faltando = set(esperado) - set(numeros)
                        if faltando:
                            self.divergencias.append(Divergencia(
                                tipo='SEQUENCIA_PARAGRAFO_QUEBRADA',
                                severidade='MEDIO',
                                categoria='INTERNA',
                                artigo=f"Art. {artigo.numero}",
                                campo='paragrafos',
                                esperado=f"Sequência: {esperado}",
                                encontrado=f"Encontrado: {numeros}",
                                detalhes=f"Faltando: §{faltando}"
                            ))
                except:
                    pass

    def _validar_consistencia_texto(self):
        """Valida: texto_plano = soma do plate_content"""
        for num, artigo in self.artigos.items():
            if not artigo.texto_plano or not artigo.plate_content:
                continue

            # Reconstrói texto do plate_content
            texto_reconstruido = ""
            for block in artigo.plate_content:
                search_text = block.get('search_text', '')
                if search_text:
                    texto_reconstruido += " " + search_text

            texto_reconstruido = normalizar_texto(texto_reconstruido)
            texto_plano_norm = normalizar_texto(artigo.texto_plano)

            ratio = SequenceMatcher(None, texto_plano_norm, texto_reconstruido).ratio()
            if ratio < 0.95:
                self.divergencias.append(Divergencia(
                    tipo='INCONSISTENCIA_TEXTO_PLANO',
                    severidade='BAIXO',
                    categoria='INTERNA',
                    artigo=f"Art. {artigo.numero}",
                    campo='texto_plano vs plate_content',
                    esperado=f"Similaridade >= 95%",
                    encontrado=f"Similaridade: {ratio*100:.1f}%",
                    detalhes="texto_plano não corresponde à soma do plate_content"
                ))

    def _validar_slugs(self):
        """Valida se slugs são válidos"""
        for num, artigo in self.artigos.items():
            for block in artigo.plate_content:
                slug = block.get('slug', '')
                if not slug:
                    continue

                # Slug deve ter formato válido
                if not re.match(r'^[a-z0-9_\-\.]+$', slug, re.IGNORECASE):
                    self.divergencias.append(Divergencia(
                        tipo='SLUG_INVALIDO',
                        severidade='BAIXO',
                        categoria='INTERNA',
                        artigo=f"Art. {artigo.numero}",
                        campo='slug',
                        esperado="Formato: [a-z0-9_-.]",
                        encontrado=slug,
                        detalhes="Slug contém caracteres inválidos"
                    ))


# =============================================================================
# VALIDADOR CAMADA 2: ESTRUTURA
# =============================================================================

class ValidadorEstrutura:
    """Validação EXTERNA de ESTRUTURA: JSON vs Fonte"""

    def __init__(self, artigos_fonte: Dict[str, ArtigoFonte], artigos_json: Dict[str, ArtigoJSON],
                 estrutura_fonte: EstruturaHierarquica, estrutura_json: EstruturaHierarquica):
        self.artigos_fonte = artigos_fonte
        self.artigos_json = artigos_json
        self.estrutura_fonte = estrutura_fonte
        self.estrutura_json = estrutura_json
        self.divergencias: List[Divergencia] = []

    def validar(self) -> List[Divergencia]:
        """Executa validação de estrutura"""
        self._validar_artigos_presentes()
        self._validar_paragrafos_presentes()
        self._validar_incisos_presentes()
        self._validar_alineas_presentes()
        self._validar_hierarquia_lei()
        return self.divergencias

    def _validar_artigos_presentes(self):
        """Valida se todos os artigos estão presentes"""
        nums_fonte = set(self.artigos_fonte.keys())
        nums_json = set(self.artigos_json.keys())

        # Faltando no JSON
        for num in sorted(nums_fonte - nums_json, key=lambda x: (len(x), x)):
            art = self.artigos_fonte[num]
            severidade = 'INFO' if art.revogado or art.vetado else 'CRITICO'
            self.divergencias.append(Divergencia(
                tipo='ARTIGO_FALTANDO_JSON',
                severidade=severidade,
                categoria='ESTRUTURA',
                artigo=f"Art. {art.numero}",
                campo='artigo',
                esperado=f"Presente (linha {art.linha_inicio})",
                encontrado="AUSENTE",
                linha_fonte=art.linha_inicio,
                detalhes="Revogado/Vetado" if severidade == 'INFO' else "VIGENTE faltando!"
            ))

        # Extras no JSON
        for num in sorted(nums_json - nums_fonte, key=lambda x: (len(x), x)):
            art = self.artigos_json[num]
            self.divergencias.append(Divergencia(
                tipo='ARTIGO_EXTRA_JSON',
                severidade='CRITICO',
                categoria='ESTRUTURA',
                artigo=f"Art. {art.numero}",
                campo='artigo',
                esperado="AUSENTE",
                encontrado=f"Presente (id: {art.id})",
                posicao_json=f"artigos[id={art.id}]",
                detalhes="Artigo no JSON não existe na fonte!"
            ))

    def _validar_paragrafos_presentes(self):
        """Valida parágrafos em cada artigo"""
        nums_comuns = set(self.artigos_fonte.keys()) & set(self.artigos_json.keys())

        for num in nums_comuns:
            art_fonte = self.artigos_fonte[num]
            art_json = self.artigos_json[num]

            pars_fonte = set(art_fonte.paragrafos.keys())
            pars_json = set(art_json.paragrafos.keys())

            # Faltando no JSON
            for p in pars_fonte - pars_json:
                self.divergencias.append(Divergencia(
                    tipo='PARAGRAFO_FALTANDO_JSON',
                    severidade='ALTO',
                    categoria='ESTRUTURA',
                    artigo=f"Art. {art_fonte.numero}",
                    campo=f"§{p}" if p != 'unico' else "Parágrafo único",
                    esperado=art_fonte.paragrafos.get(p, '')[:100],
                    encontrado="AUSENTE",
                    linha_fonte=art_fonte.linha_inicio
                ))

            # Extras no JSON
            for p in pars_json - pars_fonte:
                self.divergencias.append(Divergencia(
                    tipo='PARAGRAFO_EXTRA_JSON',
                    severidade='MEDIO',
                    categoria='ESTRUTURA',
                    artigo=f"Art. {art_json.numero}",
                    campo=f"§{p}" if p != 'unico' else "Parágrafo único",
                    esperado="AUSENTE",
                    encontrado=art_json.paragrafos.get(p, '')[:100],
                    posicao_json=f"artigos[numero={art_json.numero}].paragrafos.{p}"
                ))

    def _validar_incisos_presentes(self):
        """Valida incisos em cada artigo"""
        nums_comuns = set(self.artigos_fonte.keys()) & set(self.artigos_json.keys())

        for num in nums_comuns:
            art_fonte = self.artigos_fonte[num]
            art_json = self.artigos_json[num]

            incs_fonte = set(art_fonte.incisos.keys())
            incs_json = set(art_json.incisos.keys())

            # Faltando no JSON
            for i in incs_fonte - incs_json:
                self.divergencias.append(Divergencia(
                    tipo='INCISO_FALTANDO_JSON',
                    severidade='ALTO',
                    categoria='ESTRUTURA',
                    artigo=f"Art. {art_fonte.numero}",
                    campo=f"Inciso {i}",
                    esperado=art_fonte.incisos.get(i, '')[:100],
                    encontrado="AUSENTE",
                    linha_fonte=art_fonte.linha_inicio
                ))

            # Extras no JSON
            for i in incs_json - incs_fonte:
                self.divergencias.append(Divergencia(
                    tipo='INCISO_EXTRA_JSON',
                    severidade='MEDIO',
                    categoria='ESTRUTURA',
                    artigo=f"Art. {art_json.numero}",
                    campo=f"Inciso {i}",
                    esperado="AUSENTE",
                    encontrado=art_json.incisos.get(i, '')[:100]
                ))

    def _validar_alineas_presentes(self):
        """Valida alíneas em cada inciso"""
        nums_comuns = set(self.artigos_fonte.keys()) & set(self.artigos_json.keys())

        for num in nums_comuns:
            art_fonte = self.artigos_fonte[num]
            art_json = self.artigos_json[num]

            for inciso, alineas_fonte in art_fonte.alineas.items():
                alineas_json = art_json.alineas.get(inciso, {})

                als_fonte = set(alineas_fonte.keys())
                als_json = set(alineas_json.keys())

                # Faltando no JSON
                for a in als_fonte - als_json:
                    self.divergencias.append(Divergencia(
                        tipo='ALINEA_FALTANDO_JSON',
                        severidade='MEDIO',
                        categoria='ESTRUTURA',
                        artigo=f"Art. {art_fonte.numero}",
                        campo=f"Inciso {inciso}, alínea {a}",
                        esperado=alineas_fonte.get(a, '')[:100],
                        encontrado="AUSENTE",
                        linha_fonte=art_fonte.linha_inicio
                    ))

    def _validar_hierarquia_lei(self):
        """Valida estrutura hierárquica: Partes, Livros, Títulos, Capítulos, Seções"""
        # Partes
        if len(self.estrutura_fonte.partes) != len(self.estrutura_json.partes):
            self.divergencias.append(Divergencia(
                tipo='ESTRUTURA_PARTES',
                severidade='MEDIO',
                categoria='ESTRUTURA',
                artigo='LEI',
                campo='partes',
                esperado=f"{len(self.estrutura_fonte.partes)} partes",
                encontrado=f"{len(self.estrutura_json.partes)} partes"
            ))

        # Livros
        if len(self.estrutura_fonte.livros) != len(self.estrutura_json.livros):
            self.divergencias.append(Divergencia(
                tipo='ESTRUTURA_LIVROS',
                severidade='MEDIO',
                categoria='ESTRUTURA',
                artigo='LEI',
                campo='livros',
                esperado=f"{len(self.estrutura_fonte.livros)} livros",
                encontrado=f"{len(self.estrutura_json.livros)} livros"
            ))

        # Títulos
        if len(self.estrutura_fonte.titulos) != len(self.estrutura_json.titulos):
            self.divergencias.append(Divergencia(
                tipo='ESTRUTURA_TITULOS',
                severidade='MEDIO',
                categoria='ESTRUTURA',
                artigo='LEI',
                campo='titulos',
                esperado=f"{len(self.estrutura_fonte.titulos)} títulos",
                encontrado=f"{len(self.estrutura_json.titulos)} títulos"
            ))

        # Capítulos
        if len(self.estrutura_fonte.capitulos) != len(self.estrutura_json.capitulos):
            self.divergencias.append(Divergencia(
                tipo='ESTRUTURA_CAPITULOS',
                severidade='MEDIO',
                categoria='ESTRUTURA',
                artigo='LEI',
                campo='capitulos',
                esperado=f"{len(self.estrutura_fonte.capitulos)} capítulos",
                encontrado=f"{len(self.estrutura_json.capitulos)} capítulos"
            ))

        # Seções
        if len(self.estrutura_fonte.secoes) != len(self.estrutura_json.secoes):
            self.divergencias.append(Divergencia(
                tipo='ESTRUTURA_SECOES',
                severidade='BAIXO',
                categoria='ESTRUTURA',
                artigo='LEI',
                campo='secoes',
                esperado=f"{len(self.estrutura_fonte.secoes)} seções",
                encontrado=f"{len(self.estrutura_json.secoes)} seções"
            ))


# =============================================================================
# VALIDADOR CAMADA 3: TEXTO (2 PASSES)
# =============================================================================

class ValidadorTexto:
    """Validação EXTERNA de TEXTO: JSON vs Fonte (2 passes)"""

    def __init__(self, artigos_fonte: Dict[str, ArtigoFonte], artigos_json: Dict[str, ArtigoJSON]):
        self.artigos_fonte = artigos_fonte
        self.artigos_json = artigos_json
        self.divergencias: List[Divergencia] = []

    def validar(self) -> List[Divergencia]:
        """Executa validação de texto em 2 passes"""
        nums_comuns = set(self.artigos_fonte.keys()) & set(self.artigos_json.keys())

        for num in sorted(nums_comuns, key=lambda x: (len(x), x)):
            art_fonte = self.artigos_fonte[num]
            art_json = self.artigos_json[num]

            # Compara caput
            self._comparar_texto(
                art_fonte, art_json, 'caput',
                art_fonte.caput, art_json.caput,
                art_fonte.caput_raw, art_json.caput_raw
            )

            # Compara parágrafos
            pars_comuns = set(art_fonte.paragrafos.keys()) & set(art_json.paragrafos.keys())
            for p in pars_comuns:
                campo = f"§{p}" if p != 'unico' else "Parágrafo único"
                self._comparar_texto(
                    art_fonte, art_json, campo,
                    art_fonte.paragrafos[p], art_json.paragrafos[p],
                    art_fonte.paragrafos_raw.get(p, ''), art_json.paragrafos_raw.get(p, '')
                )

            # Compara incisos
            incs_comuns = set(art_fonte.incisos.keys()) & set(art_json.incisos.keys())
            for i in incs_comuns:
                self._comparar_texto(
                    art_fonte, art_json, f"Inciso {i}",
                    art_fonte.incisos[i], art_json.incisos[i],
                    art_fonte.incisos_raw.get(i, ''), art_json.incisos_raw.get(i, '')
                )

            # Compara alíneas
            for inciso in art_fonte.alineas:
                if inciso in art_json.alineas:
                    als_comuns = set(art_fonte.alineas[inciso].keys()) & set(art_json.alineas[inciso].keys())
                    for a in als_comuns:
                        self._comparar_texto(
                            art_fonte, art_json, f"Inciso {inciso}, alínea {a}",
                            art_fonte.alineas[inciso][a], art_json.alineas[inciso][a],
                            art_fonte.alineas_raw.get(inciso, {}).get(a, ''),
                            art_json.alineas_raw.get(inciso, {}).get(a, '')
                        )

        return self.divergencias

    def _comparar_texto(self, art_fonte: ArtigoFonte, art_json: ArtigoJSON, campo: str,
                        texto_norm_fonte: str, texto_norm_json: str,
                        texto_raw_fonte: str, texto_raw_json: str):
        """Compara texto em 2 passes para classificar severidade"""

        if not texto_norm_fonte and not texto_norm_json:
            return

        # PASS 1: Sem normalização (detecta TUDO)
        if texto_raw_fonte and texto_raw_json:
            ratio_raw = SequenceMatcher(None, texto_raw_fonte, texto_raw_json).ratio()
        else:
            ratio_raw = 1.0

        # PASS 2: Com normalização (classifica severidade)
        ratio_norm = SequenceMatcher(None, texto_norm_fonte, texto_norm_json).ratio()

        # Determina severidade baseado nos 2 passes
        if ratio_norm >= 0.95:
            # Conteúdo OK
            if ratio_raw < 0.99:
                # Só formatação difere
                self.divergencias.append(Divergencia(
                    tipo='TEXTO_FORMATACAO',
                    severidade='FORMATACAO',
                    categoria='TEXTO',
                    artigo=f"Art. {art_fonte.numero}",
                    campo=campo,
                    esperado=texto_norm_fonte[:150],
                    encontrado=texto_norm_json[:150],
                    raw_esperado=texto_raw_fonte[:150],
                    raw_encontrado=texto_raw_json[:150],
                    linha_fonte=art_fonte.linha_inicio,
                    detalhes=f"Conteúdo OK ({ratio_norm*100:.1f}%), Formatação difere ({ratio_raw*100:.1f}%)"
                ))
        else:
            # Conteúdo difere
            if ratio_norm >= 0.90:
                severidade = 'MEDIO'
            elif ratio_norm >= 0.80:
                severidade = 'ALTO'
            else:
                severidade = 'CRITICO'

            diff_words = self._get_diff_words(texto_norm_fonte, texto_norm_json)

            self.divergencias.append(Divergencia(
                tipo='TEXTO_DIFERENTE',
                severidade=severidade,
                categoria='TEXTO',
                artigo=f"Art. {art_fonte.numero}",
                campo=campo,
                esperado=texto_norm_fonte[:200],
                encontrado=texto_norm_json[:200],
                raw_esperado=texto_raw_fonte[:200],
                raw_encontrado=texto_raw_json[:200],
                linha_fonte=art_fonte.linha_inicio,
                detalhes=f"Similaridade: {ratio_norm*100:.1f}% | Diff: {diff_words}"
            ))

    def _get_diff_words(self, texto1: str, texto2: str) -> str:
        """Retorna palavras diferentes"""
        words1 = set(texto1.lower().split())
        words2 = set(texto2.lower().split())
        diff = (words1 - words2) | (words2 - words1)
        return ', '.join(list(diff)[:5]) if diff else 'formatação'


# =============================================================================
# VALIDADOR COMPLETO
# =============================================================================

class ValidadorPerfeito:
    """Orquestra as 3 camadas de validação"""

    def __init__(self, json_path: str, url: str = None, txt_path: str = None):
        self.json_path = json_path
        self.url = url
        self.txt_path = txt_path

        self.artigos_fonte: Dict[str, ArtigoFonte] = {}
        self.artigos_json: Dict[str, ArtigoJSON] = {}
        self.estrutura_fonte = EstruturaHierarquica()
        self.estrutura_json = EstruturaHierarquica()

        self.divergencias: List[Divergencia] = []
        self.stats = {}

    def executar(self) -> List[Divergencia]:
        """Executa validação completa"""
        # Carrega fonte
        print("\n[1/5] Carregando fonte oficial...")
        fonte = FontePlanalto(url=self.url, txt_path=self.txt_path)
        fonte.carregar()

        # Parse fonte
        print("[2/5] Parseando fonte...")
        parser_fonte = ParserFonte(fonte.linhas)
        self.artigos_fonte, self.estrutura_fonte = parser_fonte.parse()

        # Carrega e parse JSON
        print("[3/5] Carregando e parseando JSON...")
        with open(self.json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)

        parser_json = ParserJSON(json_data)
        self.artigos_json = parser_json.parse()
        self.estrutura_json = parser_json.estrutura

        # Estatísticas
        self.stats = {
            'artigos_fonte': len(self.artigos_fonte),
            'artigos_json': len(self.artigos_json),
            'artigos_comuns': len(set(self.artigos_fonte.keys()) & set(self.artigos_json.keys()))
        }

        # CAMADA 1: Validação Interna
        print("[4/5] Validando (Camada 1: Interna)...")
        validador_interno = ValidadorInterno(self.artigos_json)
        self.divergencias.extend(validador_interno.validar())

        # CAMADA 2: Validação de Estrutura
        print("[4/5] Validando (Camada 2: Estrutura)...")
        validador_estrutura = ValidadorEstrutura(
            self.artigos_fonte, self.artigos_json,
            self.estrutura_fonte, self.estrutura_json
        )
        self.divergencias.extend(validador_estrutura.validar())

        # CAMADA 3: Validação de Texto
        print("[5/5] Validando (Camada 3: Texto - 2 passes)...")
        validador_texto = ValidadorTexto(self.artigos_fonte, self.artigos_json)
        self.divergencias.extend(validador_texto.validar())

        # Ordena por severidade
        ordem_sev = {'CRITICO': 0, 'ALTO': 1, 'MEDIO': 2, 'BAIXO': 3, 'FORMATACAO': 4, 'INFO': 5}
        self.divergencias.sort(key=lambda d: (ordem_sev.get(d.severidade, 99), d.artigo))

        return self.divergencias


# =============================================================================
# RELATÓRIOS
# =============================================================================

def gerar_relatorio_terminal(divergencias: List[Divergencia], stats: dict):
    """Gera relatório no terminal"""
    if RICH_AVAILABLE:
        _gerar_relatorio_rich(divergencias, stats)
    else:
        _gerar_relatorio_texto(divergencias, stats)


def _gerar_relatorio_rich(divergencias: List[Divergencia], stats: dict):
    """Relatório usando Rich"""
    console.print()
    console.print(Panel.fit(
        "[bold blue]VALIDADOR PERFEITO v2.0[/] - Arquitetura de 3 Camadas",
        border_style="blue"
    ))

    # Estatísticas
    table_stats = Table(title="Estatísticas", box=box.ROUNDED)
    table_stats.add_column("Métrica", style="cyan")
    table_stats.add_column("Fonte", style="green")
    table_stats.add_column("JSON", style="yellow")

    table_stats.add_row("Artigos", str(stats['artigos_fonte']), str(stats['artigos_json']))
    table_stats.add_row("Em comum", str(stats['artigos_comuns']), str(stats['artigos_comuns']))
    table_stats.add_row("Divergências", str(len(divergencias)), "-")

    console.print(table_stats)
    console.print()

    # Por severidade
    por_sev = defaultdict(int)
    por_cat = defaultdict(int)
    for d in divergencias:
        por_sev[d.severidade] += 1
        por_cat[d.categoria] += 1

    table_sev = Table(title="Por Severidade", box=box.ROUNDED)
    table_sev.add_column("Severidade", style="bold")
    table_sev.add_column("Qtd")

    cores = {'CRITICO': 'red', 'ALTO': 'orange1', 'MEDIO': 'yellow', 'BAIXO': 'green', 'FORMATACAO': 'cyan', 'INFO': 'blue'}
    for sev in ['CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'FORMATACAO', 'INFO']:
        if por_sev[sev]:
            table_sev.add_row(f"[{cores[sev]}]{sev}[/]", str(por_sev[sev]))

    table_cat = Table(title="Por Categoria", box=box.ROUNDED)
    table_cat.add_column("Categoria", style="bold")
    table_cat.add_column("Qtd")

    for cat in ['INTERNA', 'ESTRUTURA', 'TEXTO']:
        if por_cat[cat]:
            table_cat.add_row(cat, str(por_cat[cat]))

    console.print(table_sev)
    console.print(table_cat)
    console.print()

    # Lista de divergências
    if divergencias:
        table_div = Table(title="Divergências (Top 50)", box=box.ROUNDED, show_lines=True)
        table_div.add_column("#", width=4)
        table_div.add_column("Sev", width=10)
        table_div.add_column("Cat", width=10)
        table_div.add_column("Artigo", width=10)
        table_div.add_column("Campo", width=20)
        table_div.add_column("Tipo", width=25)
        table_div.add_column("Detalhes", width=40)

        for i, d in enumerate(divergencias[:50], 1):
            sev_cor = cores.get(d.severidade, 'white')
            table_div.add_row(
                str(i),
                f"[{sev_cor}]{d.severidade}[/]",
                d.categoria,
                d.artigo,
                d.campo[:18],
                d.tipo,
                d.detalhes[:38] if d.detalhes else "-"
            )

        console.print(table_div)

        if len(divergencias) > 50:
            console.print(f"\n[dim]... e mais {len(divergencias) - 50} divergências. Use --html para ver todas.[/]")
    else:
        console.print(Panel("[bold green]NENHUMA DIVERGÊNCIA ENCONTRADA![/]", border_style="green"))


def _gerar_relatorio_texto(divergencias: List[Divergencia], stats: dict):
    """Relatório em texto simples"""
    print("\n" + "="*80)
    print("VALIDADOR PERFEITO v2.0 - Arquitetura de 3 Camadas")
    print("="*80)

    print(f"\nESTATÍSTICAS:")
    print(f"  Artigos na fonte: {stats['artigos_fonte']}")
    print(f"  Artigos no JSON: {stats['artigos_json']}")
    print(f"  Em comum: {stats['artigos_comuns']}")
    print(f"  Divergências: {len(divergencias)}")

    if divergencias:
        print("\nDIVERGÊNCIAS:")
        for i, d in enumerate(divergencias[:30], 1):
            print(f"\n{i}. [{d.severidade}] [{d.categoria}] {d.tipo}")
            print(f"   Artigo: {d.artigo} | Campo: {d.campo}")
            if d.detalhes:
                print(f"   Detalhes: {d.detalhes}")


def gerar_relatorio_html(divergencias: List[Divergencia], stats: dict, output_path: str):
    """Gera relatório HTML completo"""
    por_sev = defaultdict(int)
    por_cat = defaultdict(int)
    for d in divergencias:
        por_sev[d.severidade] += 1
        por_cat[d.categoria] += 1

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Validador Perfeito v2.0 - Relatório</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #1a1a2e; color: #eee; }}
        .container {{ max-width: 1600px; margin: 0 auto; }}
        h1 {{ color: #00d4ff; border-bottom: 2px solid #00d4ff; padding-bottom: 10px; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin: 20px 0; }}
        .stat-card {{ background: #16213e; padding: 20px; border-radius: 10px; border-left: 4px solid #00d4ff; }}
        .stat-card h3 {{ margin: 0 0 10px 0; color: #888; font-size: 14px; }}
        .stat-card .value {{ font-size: 28px; font-weight: bold; color: #00d4ff; }}
        .filters {{ background: #16213e; padding: 15px; border-radius: 10px; margin: 20px 0; }}
        .filters input, .filters select {{ padding: 8px 12px; border: 1px solid #333; border-radius: 5px; background: #0f0f23; color: #eee; margin-right: 10px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; background: #16213e; border-radius: 10px; overflow: hidden; }}
        th {{ background: #0f3460; color: #00d4ff; padding: 12px; text-align: left; position: sticky; top: 0; }}
        td {{ padding: 10px 12px; border-bottom: 1px solid #333; vertical-align: top; }}
        tr:hover {{ background: #1f4068; }}
        .sev-CRITICO {{ color: #ff4757; font-weight: bold; }}
        .sev-ALTO {{ color: #ffa502; font-weight: bold; }}
        .sev-MEDIO {{ color: #ffda79; }}
        .sev-BAIXO {{ color: #7bed9f; }}
        .sev-FORMATACAO {{ color: #70a1ff; }}
        .sev-INFO {{ color: #a4b0be; }}
        .cat-INTERNA {{ background: #5f27cd; padding: 2px 6px; border-radius: 3px; font-size: 11px; }}
        .cat-ESTRUTURA {{ background: #ee5253; padding: 2px 6px; border-radius: 3px; font-size: 11px; }}
        .cat-TEXTO {{ background: #10ac84; padding: 2px 6px; border-radius: 3px; font-size: 11px; }}
        .diff {{ font-family: monospace; font-size: 11px; background: #0f0f23; padding: 5px; border-radius: 3px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
        .diff:hover {{ white-space: normal; }}
        .esperado {{ color: #ff6b6b; }}
        .encontrado {{ color: #4ecdc4; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Validador Perfeito v2.0 - Relatório</h1>
        <p>Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>

        <div class="stats">
            <div class="stat-card"><h3>Artigos Fonte</h3><div class="value">{stats['artigos_fonte']}</div></div>
            <div class="stat-card"><h3>Artigos JSON</h3><div class="value">{stats['artigos_json']}</div></div>
            <div class="stat-card"><h3>Em Comum</h3><div class="value">{stats['artigos_comuns']}</div></div>
            <div class="stat-card"><h3>Divergências</h3><div class="value" style="color: {'#ff4757' if divergencias else '#2ed573'}">{len(divergencias)}</div></div>
            <div class="stat-card"><h3>CRÍTICO</h3><div class="value sev-CRITICO">{por_sev['CRITICO']}</div></div>
            <div class="stat-card"><h3>ALTO</h3><div class="value sev-ALTO">{por_sev['ALTO']}</div></div>
            <div class="stat-card"><h3>MÉDIO</h3><div class="value sev-MEDIO">{por_sev['MEDIO']}</div></div>
            <div class="stat-card"><h3>FORMATAÇÃO</h3><div class="value sev-FORMATACAO">{por_sev['FORMATACAO']}</div></div>
        </div>

        <div class="filters">
            <strong>Filtros:</strong>
            <input type="text" id="filtroArtigo" placeholder="Artigo..." onkeyup="filtrar()">
            <select id="filtroSev" onchange="filtrar()">
                <option value="">Todas severidades</option>
                <option value="CRITICO">Crítico</option>
                <option value="ALTO">Alto</option>
                <option value="MEDIO">Médio</option>
                <option value="BAIXO">Baixo</option>
                <option value="FORMATACAO">Formatação</option>
                <option value="INFO">Info</option>
            </select>
            <select id="filtroCat" onchange="filtrar()">
                <option value="">Todas categorias</option>
                <option value="INTERNA">Interna</option>
                <option value="ESTRUTURA">Estrutura</option>
                <option value="TEXTO">Texto</option>
            </select>
        </div>

        <table id="tabela">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Sev</th>
                    <th>Cat</th>
                    <th>Artigo</th>
                    <th>Campo</th>
                    <th>Tipo</th>
                    <th>Esperado</th>
                    <th>Encontrado</th>
                    <th>Detalhes</th>
                </tr>
            </thead>
            <tbody>
"""

    for i, d in enumerate(divergencias, 1):
        html += f"""
                <tr data-artigo="{d.artigo}" data-sev="{d.severidade}" data-cat="{d.categoria}">
                    <td>{i}</td>
                    <td class="sev-{d.severidade}">{d.severidade}</td>
                    <td><span class="cat-{d.categoria}">{d.categoria}</span></td>
                    <td><strong>{d.artigo}</strong></td>
                    <td>{d.campo}</td>
                    <td>{d.tipo}</td>
                    <td><div class="diff esperado" title="{d.esperado}">{d.esperado[:80]}{'...' if len(d.esperado) > 80 else ''}</div></td>
                    <td><div class="diff encontrado" title="{d.encontrado}">{d.encontrado[:80]}{'...' if len(d.encontrado) > 80 else ''}</div></td>
                    <td>{d.detalhes or '-'}</td>
                </tr>
"""

    html += """
            </tbody>
        </table>

        <script>
        function filtrar() {
            const artigo = document.getElementById('filtroArtigo').value.toLowerCase();
            const sev = document.getElementById('filtroSev').value;
            const cat = document.getElementById('filtroCat').value;

            document.querySelectorAll('#tabela tbody tr').forEach(row => {
                const matchArtigo = !artigo || row.dataset.artigo.toLowerCase().includes(artigo);
                const matchSev = !sev || row.dataset.sev === sev;
                const matchCat = !cat || row.dataset.cat === cat;
                row.style.display = (matchArtigo && matchSev && matchCat) ? '' : 'none';
            });
        }
        </script>
    </div>
</body>
</html>
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Relatório HTML salvo em: {output_path}")


def gerar_relatorio_json(divergencias: List[Divergencia], stats: dict, output_path: str):
    """Gera relatório JSON"""
    data = {
        'gerado_em': datetime.now().isoformat(),
        'estatisticas': stats,
        'total_divergencias': len(divergencias),
        'por_severidade': dict(defaultdict(int)),
        'por_categoria': dict(defaultdict(int)),
        'divergencias': []
    }

    for d in divergencias:
        data['por_severidade'][d.severidade] = data['por_severidade'].get(d.severidade, 0) + 1
        data['por_categoria'][d.categoria] = data['por_categoria'].get(d.categoria, 0) + 1
        data['divergencias'].append({
            'tipo': d.tipo,
            'severidade': d.severidade,
            'categoria': d.categoria,
            'artigo': d.artigo,
            'campo': d.campo,
            'esperado': d.esperado,
            'encontrado': d.encontrado,
            'raw_esperado': d.raw_esperado,
            'raw_encontrado': d.raw_encontrado,
            'linha_fonte': d.linha_fonte,
            'posicao_json': d.posicao_json,
            'detalhes': d.detalhes
        })

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Relatório JSON salvo em: {output_path}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Validador Perfeito v2.0 - Arquitetura de 3 Camadas',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  # Usando URL do Planalto (recomendado)
  python validator_perfeito_v2.py ../public/codigp_v2.json --url "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm"

  # Usando arquivo TXT local
  python validator_perfeito_v2.py ../public/codigp_v2.json --txt ../public/leioficial.txt

  # Com relatório HTML
  python validator_perfeito_v2.py lei.json --url "URL" --html relatorio.html

  # Com relatório JSON
  python validator_perfeito_v2.py lei.json --url "URL" --json relatorio.json
        """
    )
    parser.add_argument('json_path', help='Caminho para o arquivo JSON')
    parser.add_argument('--url', help='URL do Planalto para baixar HTML')
    parser.add_argument('--txt', help='Caminho para arquivo TXT local')
    parser.add_argument('--html', metavar='FILE', help='Gerar relatório HTML')
    parser.add_argument('--json', metavar='FILE', help='Gerar relatório JSON')
    parser.add_argument('--no-cache', action='store_true', help='Não usar cache do HTML')
    parser.add_argument('--quiet', '-q', action='store_true', help='Não mostrar saída no terminal')

    args = parser.parse_args()

    # Valida argumentos
    if not args.url and not args.txt:
        print("ERRO: Especifique --url ou --txt como fonte")
        sys.exit(1)

    if not Path(args.json_path).exists():
        print(f"ERRO: Arquivo JSON não encontrado: {args.json_path}")
        sys.exit(1)

    if args.txt and not Path(args.txt).exists():
        print(f"ERRO: Arquivo TXT não encontrado: {args.txt}")
        sys.exit(1)

    # Executa validação
    validador = ValidadorPerfeito(
        json_path=args.json_path,
        url=args.url,
        txt_path=args.txt
    )

    try:
        divergencias = validador.executar()
    except Exception as e:
        print(f"ERRO: {e}")
        sys.exit(1)

    # Relatórios
    if not args.quiet:
        gerar_relatorio_terminal(divergencias, validador.stats)

    if args.html:
        gerar_relatorio_html(divergencias, validador.stats, args.html)

    if args.json:
        gerar_relatorio_json(divergencias, validador.stats, args.json)

    # Exit code
    criticos = sum(1 for d in divergencias if d.severidade == 'CRITICO')
    print(f"\n{'='*60}")
    print(f"Total: {len(divergencias)} divergências ({criticos} críticas)")
    print(f"{'='*60}")

    sys.exit(1 if criticos > 0 else 0)


if __name__ == '__main__':
    main()
