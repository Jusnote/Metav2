#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VALIDADOR PERFEITO - Lei Seca JSON vs TXT Oficial
Detecta TODAS as divergências: estrutura, parágrafos, alíneas, incisos, itens, epígrafes, capítulos.

Uso:
    python validator_perfeito.py <json_path> <txt_path> [--html report.html] [--json report.json]

Exemplo:
    python validator_perfeito.py ../public/codigp_v2.json ../public/leioficial.txt --html relatorio.html
"""

import json
import re
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Set
from difflib import SequenceMatcher, unified_diff
from collections import defaultdict
from datetime import datetime

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
    print("[AVISO] Rich não instalado. Saída será em texto simples.")
    print("        Instale com: pip install rich")

console = Console() if RICH_AVAILABLE else None


# =============================================================================
# TIPOS E ESTRUTURAS
# =============================================================================

@dataclass
class Divergencia:
    """Representa uma divergência encontrada"""
    tipo: str  # 'FALTANDO_JSON', 'FALTANDO_TXT', 'TEXTO_DIFERENTE', 'ESTRUTURA', 'EPIGRAFE', etc
    severidade: str  # 'CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'INFO'
    artigo: str
    campo: str  # 'caput', 'paragrafo-1', 'inciso-I', 'alinea-a', 'epigrafe', etc
    esperado: str  # valor no TXT (fonte da verdade)
    encontrado: str  # valor no JSON
    linha_txt: int = 0  # linha no arquivo TXT
    posicao_json: str = ""  # caminho no JSON (ex: artigos[0].plate_content[1])
    detalhes: str = ""

@dataclass
class ArtigoTXT:
    """Artigo extraído do TXT"""
    numero: str
    numero_canonico: str  # normalizado (ex: "1-A" -> "1A")
    linha_inicio: int
    linha_fim: int
    caput: str = ""
    epigrafe: str = ""
    paragrafos: Dict[str, str] = field(default_factory=dict)  # "1" -> texto, "unico" -> texto
    incisos: Dict[str, str] = field(default_factory=dict)  # "I" -> texto
    alineas: Dict[str, Dict[str, str]] = field(default_factory=dict)  # "I" -> {"a": texto}
    itens: Dict[str, str] = field(default_factory=dict)
    revogado: bool = False
    vetado: bool = False
    contexto: str = ""  # Título/Capítulo atual

@dataclass
class ArtigoJSON:
    """Artigo extraído do JSON"""
    numero: str
    numero_canonico: str
    id: str
    slug: str
    epigrafe: str = ""
    caput: str = ""
    texto_plano: str = ""
    paragrafos: Dict[str, str] = field(default_factory=dict)
    incisos: Dict[str, str] = field(default_factory=dict)
    alineas: Dict[str, Dict[str, str]] = field(default_factory=dict)
    itens: Dict[str, str] = field(default_factory=dict)
    vigente: bool = True
    contexto: str = ""
    path: dict = field(default_factory=dict)

@dataclass
class EstruturaTXT:
    """Estrutura hierárquica do TXT"""
    partes: List[Tuple[str, int]] = field(default_factory=list)  # (nome, linha)
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
    """Normaliza número do artigo para comparação
    Ex: "1º", "1°", "1 ", "1-A" -> "1", "1A"
    """
    if not num:
        return ""
    # Remove º, °, ª, espaços
    result = re.sub(r'[º°ª\s]', '', str(num))
    # Remove traço antes de letra (1-A -> 1A)
    result = re.sub(r'-([A-Za-z])', r'\1', result)
    return result.upper().strip()

def normalizar_texto(texto: str) -> str:
    """Normaliza texto para comparação"""
    if not texto:
        return ""
    # Remove múltiplos espaços
    result = re.sub(r'\s+', ' ', texto)
    # Remove espaços antes de pontuação
    result = re.sub(r'\s+([.,;:!?)])', r'\1', result)
    # Normaliza aspas
    result = result.replace('"', '"').replace('"', '"').replace(''', "'").replace(''', "'")
    # Normaliza traços
    result = result.replace('–', '-').replace('—', '-')
    # Remove prefixo Art. X (com ou sem traço/ponto)
    result = re.sub(r'^Art\.?\s*\d+[º°ª]?(?:-[A-Z]+|[A-Z])?\s*[-–—.]?\s*', '', result)
    # Remove prefixo de inciso romano no início
    result = re.sub(r'^[IVXLCDM]+\s*[-–—]\s*', '', result)
    # Remove prefixo de alínea no início
    result = re.sub(r'^[a-z]\s*[)\-–—]\s*', '', result)
    return result.strip()

def normalizar_paragrafo(texto: str) -> str:
    """Normaliza texto de parágrafo"""
    result = normalizar_texto(texto)
    # Remove prefixo § X -/.
    result = re.sub(r'^§\s*\d+[º°ª]?\s*[-–—.]\s*', '', result)
    result = re.sub(r'^Parágrafo\s+único\s*[-–—.]\s*', '', result, flags=re.IGNORECASE)
    return result.strip()

def normalizar_inciso(texto: str) -> str:
    """Normaliza texto de inciso"""
    result = normalizar_texto(texto)
    # Remove prefixo romano
    result = re.sub(r'^[IVXLCDM]+(?:-[A-Za-z0-9]+)?\s*[-–—.]\s*', '', result)
    return result.strip()

def normalizar_alinea(texto: str) -> str:
    """Normaliza texto de alínea"""
    result = normalizar_texto(texto)
    # Remove prefixo letra
    result = re.sub(r'^[a-z](?:-[A-Za-z0-9]+)?\s*[)\-–—.]\s*', '', result)
    return result.strip()


# =============================================================================
# PARSER DO TXT
# =============================================================================

class ParserTXT:
    """Parser completo do arquivo TXT oficial"""

    # Regex patterns
    RE_ARTIGO = re.compile(r'^\s*Art\.?\s*(\d+(?:-[A-Z]+|[A-Z])?)[º°ª]?\s*[-–—.]?\s*(.*)$', re.IGNORECASE)
    RE_PARAGRAFO = re.compile(r'^\s*§\s*(\d+)[º°ª]?\s*[-–—.]?\s*(.*)$')
    RE_PARAGRAFO_UNICO = re.compile(r'^\s*Parágrafo\s+único\s*[-–—.]?\s*(.*)$', re.IGNORECASE)
    RE_INCISO = re.compile(r'^\s*([IVXLCDM]+(?:-[A-Za-z0-9]+)?)\s*[-–—]\s*(.*)$')
    RE_ALINEA = re.compile(r'^\s*([a-z](?:-[A-Za-z0-9]+)?)\s*[)\-–—]\s*(.*)$')
    RE_ITEM = re.compile(r'^\s*(\d+)\s*[)\-.]\s*(.*)$')

    RE_PARTE = re.compile(r'^\s*PARTE\s+(GERAL|ESPECIAL|[IVX]+)', re.IGNORECASE)
    RE_LIVRO = re.compile(r'^\s*LIVRO\s+([IVX]+)', re.IGNORECASE)
    RE_TITULO = re.compile(r'^\s*T[ÍI]TULO\s+([IVX]+)', re.IGNORECASE)
    RE_CAPITULO = re.compile(r'^\s*CAP[ÍI]TULO\s+([IVX]+(?:-[A-Z]+)?)', re.IGNORECASE)
    RE_SECAO = re.compile(r'^\s*SE[ÇC][ÃA]O\s+([IVX]+)', re.IGNORECASE)

    RE_REVOGADO = re.compile(r'\((?:Revogad[oa]|Suprimid[oa])', re.IGNORECASE)
    RE_VETADO = re.compile(r'\(VETAD[OA]\)', re.IGNORECASE)

    def __init__(self, conteudo: str):
        self.linhas = conteudo.split('\n')
        self.artigos: Dict[str, ArtigoTXT] = {}
        self.estrutura = EstruturaTXT()
        self.contexto_atual = ""

    def parse(self) -> Tuple[Dict[str, ArtigoTXT], EstruturaTXT]:
        """Executa o parse completo"""
        artigo_atual: Optional[ArtigoTXT] = None
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
                texto = match_art.group(2).strip()

                artigo_atual = ArtigoTXT(
                    numero=numero,
                    numero_canonico=canonizar_numero(numero),
                    linha_inicio=num_linha,
                    linha_fim=num_linha,
                    caput=texto,
                    contexto=self.contexto_atual,
                    revogado=bool(self.RE_REVOGADO.search(texto)),
                    vetado=bool(self.RE_VETADO.search(texto))
                )
                inciso_atual = None
                paragrafo_atual = None
                continue

            if not artigo_atual:
                # Pode ser epígrafe antes do artigo
                continue

            # Detecta parágrafo único
            match_pu = self.RE_PARAGRAFO_UNICO.match(linha_stripped)
            if match_pu:
                texto = match_pu.group(1).strip()
                artigo_atual.paragrafos['unico'] = texto
                paragrafo_atual = 'unico'
                inciso_atual = None
                continue

            # Detecta parágrafo numerado
            match_par = self.RE_PARAGRAFO.match(linha_stripped)
            if match_par:
                num_par = match_par.group(1)
                texto = match_par.group(2).strip()
                artigo_atual.paragrafos[num_par] = texto
                paragrafo_atual = num_par
                inciso_atual = None
                continue

            # Detecta inciso
            match_inc = self.RE_INCISO.match(linha_stripped)
            if match_inc:
                num_inc = match_inc.group(1)
                texto = match_inc.group(2).strip()
                artigo_atual.incisos[num_inc] = texto
                inciso_atual = num_inc
                # Inicializa dict de alíneas para este inciso
                if num_inc not in artigo_atual.alineas:
                    artigo_atual.alineas[num_inc] = {}
                continue

            # Detecta alínea
            match_ali = self.RE_ALINEA.match(linha_stripped)
            if match_ali and inciso_atual:
                letra = match_ali.group(1)
                texto = match_ali.group(2).strip()
                if inciso_atual not in artigo_atual.alineas:
                    artigo_atual.alineas[inciso_atual] = {}
                artigo_atual.alineas[inciso_atual][letra] = texto
                continue

            # Detecta item
            match_item = self.RE_ITEM.match(linha_stripped)
            if match_item:
                num_item = match_item.group(1)
                texto = match_item.group(2).strip()
                artigo_atual.itens[num_item] = texto
                continue

            # Linha de continuação ou epígrafe
            if artigo_atual.caput == "" and not linha_stripped.startswith(('Pena', '§', 'I ', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X')):
                # Provavelmente epígrafe (linha antes do caput)
                artigo_atual.epigrafe = linha_stripped
            elif inciso_atual and inciso_atual in artigo_atual.incisos:
                # Continuação do inciso
                artigo_atual.incisos[inciso_atual] += " " + linha_stripped
            elif paragrafo_atual and paragrafo_atual in artigo_atual.paragrafos:
                # Continuação do parágrafo
                artigo_atual.paragrafos[paragrafo_atual] += " " + linha_stripped
            elif artigo_atual.caput:
                # Continuação do caput
                artigo_atual.caput += " " + linha_stripped

        # Salva último artigo
        if artigo_atual:
            artigo_atual.linha_fim = len(self.linhas)
            self.artigos[artigo_atual.numero_canonico] = artigo_atual

        return self.artigos, self.estrutura

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
        self.estrutura = {
            'partes': [],
            'livros': [],
            'titulos': [],
            'capitulos': [],
            'secoes': []
        }

    def parse(self) -> Dict[str, ArtigoJSON]:
        """Executa o parse completo"""
        # Extrai estrutura da lei
        lei_info = self.data.get('lei', {})
        estrutura = lei_info.get('estrutura', {})
        self.estrutura['partes'] = estrutura.get('partes', [])
        self.estrutura['livros'] = estrutura.get('livros', [])
        self.estrutura['titulos'] = estrutura.get('titulos', [])
        self.estrutura['capitulos'] = estrutura.get('capitulos', [])
        self.estrutura['secoes'] = estrutura.get('secoes', [])

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
                path=art_data.get('path', {})
            )

            # Extrai estrutura do plate_content
            self._extrair_estrutura_plate(art_data.get('plate_content', []), artigo)

            self.artigos[numero_canonico] = artigo

        return self.artigos

    def _extrair_estrutura_plate(self, plate_content: list, artigo: ArtigoJSON):
        """Extrai TUDO do plate_content: parágrafos, incisos, alíneas, penas, epígrafes"""
        inciso_atual = None
        paragrafo_atual = None

        for block in plate_content:
            slug = block.get('slug', '')
            search_text = block.get('search_text', '')

            if not slug or not search_text:
                continue

            # =================================================================
            # ORDEM: do mais específico ao menos específico
            # =================================================================

            # 1. CAPUT (slug exato)
            if slug == 'caput':
                artigo.caput = search_text
                continue

            # 2. ALÍNEA (pode estar em inciso ou parágrafo)
            if 'alinea-' in slug:
                match_alinea = re.search(r'alinea-([a-z])', slug, re.IGNORECASE)
                if match_alinea:
                    letra = match_alinea.group(1).lower()
                    # Verifica se está dentro de um inciso
                    match_inciso = re.search(r'inciso-(\d+)', slug)
                    if match_inciso:
                        inciso_num = arabico_para_romano(int(match_inciso.group(1)))
                        if inciso_num not in artigo.alineas:
                            artigo.alineas[inciso_num] = {}
                        artigo.alineas[inciso_num][letra] = search_text
                    elif inciso_atual:
                        if inciso_atual not in artigo.alineas:
                            artigo.alineas[inciso_atual] = {}
                        artigo.alineas[inciso_atual][letra] = search_text
                    else:
                        # Alínea direta (sem inciso) - usa parágrafo ou "DIRETO"
                        chave = f"PAR_{paragrafo_atual}" if paragrafo_atual else 'DIRETO'
                        if chave not in artigo.alineas:
                            artigo.alineas[chave] = {}
                        artigo.alineas[chave][letra] = search_text
                continue

            # 3. INCISO
            if 'inciso-' in slug and 'alinea-' not in slug:
                match_inciso = re.search(r'inciso-(\d+)', slug)
                if match_inciso:
                    num_arabico = int(match_inciso.group(1))
                    num_romano = arabico_para_romano(num_arabico)
                    artigo.incisos[num_romano] = search_text
                    inciso_atual = num_romano
                    if num_romano not in artigo.alineas:
                        artigo.alineas[num_romano] = {}
                continue

            # 4. PARÁGRAFO (só se não tiver inciso/alínea no slug)
            if 'paragrafo-' in slug and 'inciso-' not in slug and 'alinea-' not in slug:
                # Ignora epígrafes de parágrafo (serão tratadas separadamente)
                if '-epigraph' in slug:
                    continue
                match_par = re.search(r'paragrafo-(\d+(?:-[a-z])?|unico)', slug, re.IGNORECASE)
                if match_par:
                    num = match_par.group(1).lower()
                    artigo.paragrafos[num] = search_text
                    paragrafo_atual = num
                    inciso_atual = None  # Reset ao mudar de parágrafo
                continue

            # 5. PENA (adiciona ao caput ou parágrafo correspondente)
            if '.penalty' in slug:
                # Verifica se é pena de parágrafo
                match_par = re.search(r'paragrafo-(\d+(?:-[a-z])?)', slug)
                if match_par:
                    num = match_par.group(1).lower()
                    if num in artigo.paragrafos:
                        artigo.paragrafos[num] += " " + search_text
                else:
                    # Pena do caput
                    if artigo.caput:
                        artigo.caput += " " + search_text
                continue

            # 6. EPÍGRAFE DO ARTIGO (com underscore)
            if '_epigrafe' in slug:
                artigo.epigrafe = search_text
                continue


# =============================================================================
# VALIDADOR
# =============================================================================

class ValidadorPerfeito:
    """Validador completo JSON vs TXT"""

    def __init__(self, artigos_txt: Dict[str, ArtigoTXT], artigos_json: Dict[str, ArtigoJSON],
                 estrutura_txt: EstruturaTXT, estrutura_json: dict):
        self.artigos_txt = artigos_txt
        self.artigos_json = artigos_json
        self.estrutura_txt = estrutura_txt
        self.estrutura_json = estrutura_json
        self.divergencias: List[Divergencia] = []

    def validar_tudo(self) -> List[Divergencia]:
        """Executa todas as validações"""
        self._validar_artigos_presentes()
        self._validar_conteudo_artigos()
        self._validar_estrutura_hierarquica()
        return self.divergencias

    def _validar_artigos_presentes(self):
        """Valida se todos os artigos estão presentes em ambos"""
        nums_txt = set(self.artigos_txt.keys())
        nums_json = set(self.artigos_json.keys())

        # Artigos faltando no JSON
        faltando_json = nums_txt - nums_json
        for num in sorted(faltando_json, key=lambda x: (len(x), x)):
            art_txt = self.artigos_txt[num]
            # Se é revogado, é INFO; senão é CRÍTICO
            if art_txt.revogado or art_txt.vetado:
                severidade = 'INFO'
                detalhes = f"Artigo revogado/vetado corretamente omitido"
            else:
                severidade = 'CRITICO'
                detalhes = f"Artigo VIGENTE faltando no JSON!"

            self.divergencias.append(Divergencia(
                tipo='FALTANDO_JSON',
                severidade=severidade,
                artigo=f"Art. {art_txt.numero}",
                campo='artigo_completo',
                esperado=f"Presente (linha {art_txt.linha_inicio})",
                encontrado="AUSENTE",
                linha_txt=art_txt.linha_inicio,
                detalhes=detalhes
            ))

        # Artigos extras no JSON (não estão no TXT)
        extras_json = nums_json - nums_txt
        for num in sorted(extras_json, key=lambda x: (len(x), x)):
            art_json = self.artigos_json[num]
            self.divergencias.append(Divergencia(
                tipo='FALTANDO_TXT',
                severidade='CRITICO',
                artigo=f"Art. {art_json.numero}",
                campo='artigo_completo',
                esperado="AUSENTE",
                encontrado=f"Presente (id: {art_json.id})",
                posicao_json=f"artigos[id={art_json.id}]",
                detalhes="Artigo no JSON não existe no TXT oficial!"
            ))

    def _validar_conteudo_artigos(self):
        """Valida conteúdo de cada artigo em comum"""
        nums_comuns = set(self.artigos_txt.keys()) & set(self.artigos_json.keys())

        for num in sorted(nums_comuns, key=lambda x: (len(x), x)):
            art_txt = self.artigos_txt[num]
            art_json = self.artigos_json[num]

            # Valida epígrafe
            self._comparar_campo(art_txt, art_json, 'epigrafe')

            # Valida caput
            self._comparar_caput(art_txt, art_json)

            # Valida parágrafos
            self._comparar_paragrafos(art_txt, art_json)

            # Valida incisos
            self._comparar_incisos(art_txt, art_json)

            # Valida alíneas
            self._comparar_alineas(art_txt, art_json)

    def _comparar_campo(self, art_txt: ArtigoTXT, art_json: ArtigoJSON, campo: str):
        """Compara um campo específico"""
        valor_txt = normalizar_texto(getattr(art_txt, campo, ''))
        valor_json = normalizar_texto(getattr(art_json, campo, ''))

        if valor_txt and not valor_json:
            self.divergencias.append(Divergencia(
                tipo='EPIGRAFE_FALTANDO',
                severidade='MEDIO',
                artigo=f"Art. {art_txt.numero}",
                campo=campo,
                esperado=valor_txt[:100],
                encontrado="VAZIO",
                linha_txt=art_txt.linha_inicio,
                posicao_json=f"artigos[numero={art_json.numero}].{campo}"
            ))
        elif valor_txt != valor_json and valor_txt and valor_json:
            ratio = SequenceMatcher(None, valor_txt, valor_json).ratio()
            if ratio < 0.95:  # Só reporta se diferença > 5%
                self.divergencias.append(Divergencia(
                    tipo='EPIGRAFE_DIFERENTE',
                    severidade='BAIXO',
                    artigo=f"Art. {art_txt.numero}",
                    campo=campo,
                    esperado=valor_txt[:100],
                    encontrado=valor_json[:100],
                    linha_txt=art_txt.linha_inicio,
                    posicao_json=f"artigos[numero={art_json.numero}].{campo}",
                    detalhes=f"Similaridade: {ratio*100:.1f}%"
                ))

    def _comparar_caput(self, art_txt: ArtigoTXT, art_json: ArtigoJSON):
        """Compara o caput do artigo"""
        caput_txt = normalizar_texto(art_txt.caput)
        caput_json = normalizar_texto(art_json.caput)

        if not caput_txt and not caput_json:
            return

        if not caput_json and caput_txt:
            self.divergencias.append(Divergencia(
                tipo='CAPUT_FALTANDO',
                severidade='CRITICO',
                artigo=f"Art. {art_txt.numero}",
                campo='caput',
                esperado=caput_txt[:200],
                encontrado="VAZIO",
                linha_txt=art_txt.linha_inicio,
                posicao_json=f"artigos[numero={art_json.numero}].caput"
            ))
            return

        ratio = SequenceMatcher(None, caput_txt, caput_json).ratio()
        if ratio < 0.95:  # Tolerância de 5%
            # Encontra diferenças específicas
            diff = self._get_diff_words(caput_txt, caput_json)
            self.divergencias.append(Divergencia(
                tipo='CAPUT_DIFERENTE',
                severidade='ALTO' if ratio < 0.90 else 'MEDIO',
                artigo=f"Art. {art_txt.numero}",
                campo='caput',
                esperado=caput_txt[:300],
                encontrado=caput_json[:300],
                linha_txt=art_txt.linha_inicio,
                posicao_json=f"artigos[numero={art_json.numero}].caput",
                detalhes=f"Similaridade: {ratio*100:.1f}% | Diff: {diff}"
            ))

    def _comparar_paragrafos(self, art_txt: ArtigoTXT, art_json: ArtigoJSON):
        """Compara parágrafos"""
        pars_txt = set(art_txt.paragrafos.keys())
        pars_json = set(art_json.paragrafos.keys())

        # Parágrafos faltando
        for p in pars_txt - pars_json:
            self.divergencias.append(Divergencia(
                tipo='PARAGRAFO_FALTANDO',
                severidade='ALTO',
                artigo=f"Art. {art_txt.numero}",
                campo=f"§{p}" if p != 'unico' else "Parágrafo único",
                esperado=normalizar_paragrafo(art_txt.paragrafos[p])[:200],
                encontrado="AUSENTE",
                linha_txt=art_txt.linha_inicio
            ))

        # Parágrafos extras
        for p in pars_json - pars_txt:
            self.divergencias.append(Divergencia(
                tipo='PARAGRAFO_EXTRA',
                severidade='MEDIO',
                artigo=f"Art. {art_txt.numero}",
                campo=f"§{p}" if p != 'unico' else "Parágrafo único",
                esperado="AUSENTE",
                encontrado=normalizar_paragrafo(art_json.paragrafos[p])[:200],
                posicao_json=f"artigos[numero={art_json.numero}].paragrafos.{p}"
            ))

        # Compara conteúdo dos parágrafos em comum
        for p in pars_txt & pars_json:
            txt = normalizar_paragrafo(art_txt.paragrafos[p])
            json_txt = normalizar_paragrafo(art_json.paragrafos[p])
            ratio = SequenceMatcher(None, txt, json_txt).ratio()
            if ratio < 0.95:
                self.divergencias.append(Divergencia(
                    tipo='PARAGRAFO_DIFERENTE',
                    severidade='ALTO' if ratio < 0.90 else 'MEDIO',
                    artigo=f"Art. {art_txt.numero}",
                    campo=f"§{p}" if p != 'unico' else "Parágrafo único",
                    esperado=txt[:200],
                    encontrado=json_txt[:200],
                    linha_txt=art_txt.linha_inicio,
                    detalhes=f"Similaridade: {ratio*100:.1f}%"
                ))

    def _comparar_incisos(self, art_txt: ArtigoTXT, art_json: ArtigoJSON):
        """Compara incisos"""
        incs_txt = set(art_txt.incisos.keys())
        incs_json = set(art_json.incisos.keys())

        # Incisos faltando
        for i in incs_txt - incs_json:
            self.divergencias.append(Divergencia(
                tipo='INCISO_FALTANDO',
                severidade='ALTO',
                artigo=f"Art. {art_txt.numero}",
                campo=f"Inciso {i}",
                esperado=normalizar_inciso(art_txt.incisos[i])[:200],
                encontrado="AUSENTE",
                linha_txt=art_txt.linha_inicio
            ))

        # Incisos extras
        for i in incs_json - incs_txt:
            self.divergencias.append(Divergencia(
                tipo='INCISO_EXTRA',
                severidade='MEDIO',
                artigo=f"Art. {art_txt.numero}",
                campo=f"Inciso {i}",
                esperado="AUSENTE",
                encontrado=normalizar_inciso(art_json.incisos[i])[:200]
            ))

        # Compara conteúdo
        for i in incs_txt & incs_json:
            txt = normalizar_inciso(art_txt.incisos[i])
            json_txt = normalizar_inciso(art_json.incisos[i])
            ratio = SequenceMatcher(None, txt, json_txt).ratio()
            if ratio < 0.95:
                self.divergencias.append(Divergencia(
                    tipo='INCISO_DIFERENTE',
                    severidade='ALTO' if ratio < 0.90 else 'MEDIO',
                    artigo=f"Art. {art_txt.numero}",
                    campo=f"Inciso {i}",
                    esperado=txt[:200],
                    encontrado=json_txt[:200],
                    linha_txt=art_txt.linha_inicio,
                    detalhes=f"Similaridade: {ratio*100:.1f}%"
                ))

    def _comparar_alineas(self, art_txt: ArtigoTXT, art_json: ArtigoJSON):
        """Compara alíneas por inciso"""
        for inciso, alineas_txt in art_txt.alineas.items():
            alineas_json = art_json.alineas.get(inciso, {})

            als_txt = set(alineas_txt.keys())
            als_json = set(alineas_json.keys())

            # Alíneas faltando
            for a in als_txt - als_json:
                self.divergencias.append(Divergencia(
                    tipo='ALINEA_FALTANDO',
                    severidade='MEDIO',
                    artigo=f"Art. {art_txt.numero}",
                    campo=f"Inciso {inciso}, alínea {a})",
                    esperado=normalizar_alinea(alineas_txt[a])[:150],
                    encontrado="AUSENTE",
                    linha_txt=art_txt.linha_inicio
                ))

            # Compara conteúdo
            for a in als_txt & als_json:
                txt = normalizar_alinea(alineas_txt[a])
                json_txt = normalizar_alinea(alineas_json[a])
                ratio = SequenceMatcher(None, txt, json_txt).ratio()
                if ratio < 0.95:
                    self.divergencias.append(Divergencia(
                        tipo='ALINEA_DIFERENTE',
                        severidade='MEDIO' if ratio < 0.90 else 'BAIXO',
                        artigo=f"Art. {art_txt.numero}",
                        campo=f"Inciso {inciso}, alínea {a})",
                        esperado=txt[:150],
                        encontrado=json_txt[:150],
                        linha_txt=art_txt.linha_inicio,
                        detalhes=f"Similaridade: {ratio*100:.1f}%"
                    ))

    def _validar_estrutura_hierarquica(self):
        """Valida estrutura de títulos, capítulos, etc."""
        # Compara títulos
        titulos_txt = [t[0] for t in self.estrutura_txt.titulos]
        titulos_json = self.estrutura_json.get('titulos', [])

        if len(titulos_txt) != len(titulos_json):
            self.divergencias.append(Divergencia(
                tipo='ESTRUTURA_TITULOS',
                severidade='MEDIO',
                artigo='ESTRUTURA',
                campo='titulos',
                esperado=f"{len(titulos_txt)} títulos",
                encontrado=f"{len(titulos_json)} títulos",
                detalhes="Quantidade de títulos diverge"
            ))

        # Compara capítulos
        capitulos_txt = [c[0] for c in self.estrutura_txt.capitulos]
        capitulos_json = self.estrutura_json.get('capitulos', [])

        if len(capitulos_txt) != len(capitulos_json):
            self.divergencias.append(Divergencia(
                tipo='ESTRUTURA_CAPITULOS',
                severidade='MEDIO',
                artigo='ESTRUTURA',
                campo='capitulos',
                esperado=f"{len(capitulos_txt)} capítulos",
                encontrado=f"{len(capitulos_json)} capítulos",
                detalhes="Quantidade de capítulos diverge"
            ))

    def _get_diff_words(self, texto1: str, texto2: str) -> str:
        """Retorna palavras diferentes entre dois textos"""
        words1 = set(texto1.lower().split())
        words2 = set(texto2.lower().split())
        diff = (words1 - words2) | (words2 - words1)
        return ', '.join(list(diff)[:5]) if diff else 'formatação'


# =============================================================================
# RELATÓRIOS
# =============================================================================

def gerar_relatorio_rich(divergencias: List[Divergencia], stats: dict):
    """Gera relatório usando Rich (terminal)"""
    if not RICH_AVAILABLE:
        gerar_relatorio_texto(divergencias, stats)
        return

    console.print()
    console.print(Panel.fit(
        "[bold blue]VALIDADOR PERFEITO[/] - Relatório de Divergências",
        border_style="blue"
    ))

    # Estatísticas
    table_stats = Table(title="Estatísticas", box=box.ROUNDED)
    table_stats.add_column("Métrica", style="cyan")
    table_stats.add_column("TXT", style="green")
    table_stats.add_column("JSON", style="yellow")

    table_stats.add_row("Artigos", str(stats['artigos_txt']), str(stats['artigos_json']))
    table_stats.add_row("Em comum", str(stats['artigos_comuns']), str(stats['artigos_comuns']))
    table_stats.add_row("Divergências", str(len(divergencias)), "-")

    console.print(table_stats)
    console.print()

    # Contagem por severidade
    por_severidade = defaultdict(int)
    por_tipo = defaultdict(int)
    for d in divergencias:
        por_severidade[d.severidade] += 1
        por_tipo[d.tipo] += 1

    table_sev = Table(title="Por Severidade", box=box.ROUNDED)
    table_sev.add_column("Severidade", style="bold")
    table_sev.add_column("Quantidade")

    cores = {'CRITICO': 'red', 'ALTO': 'orange1', 'MEDIO': 'yellow', 'BAIXO': 'green', 'INFO': 'blue'}
    for sev in ['CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'INFO']:
        if por_severidade[sev]:
            table_sev.add_row(f"[{cores[sev]}]{sev}[/]", str(por_severidade[sev]))

    console.print(table_sev)
    console.print()

    # Lista de divergências
    if divergencias:
        table_div = Table(title="Divergências Encontradas", box=box.ROUNDED, show_lines=True)
        table_div.add_column("#", style="dim", width=4)
        table_div.add_column("Sev", width=8)
        table_div.add_column("Artigo", width=12)
        table_div.add_column("Campo", width=20)
        table_div.add_column("Tipo", width=20)
        table_div.add_column("Detalhes", width=50)

        for i, d in enumerate(divergencias[:100], 1):  # Limita a 100
            sev_cor = cores.get(d.severidade, 'white')
            table_div.add_row(
                str(i),
                f"[{sev_cor}]{d.severidade}[/]",
                d.artigo,
                d.campo,
                d.tipo,
                d.detalhes or f"TXT: {d.esperado[:30]}... | JSON: {d.encontrado[:30]}..."
            )

        console.print(table_div)

        if len(divergencias) > 100:
            console.print(f"\n[dim]... e mais {len(divergencias) - 100} divergências. Use --html para ver todas.[/]")
    else:
        console.print(Panel("[bold green]NENHUMA DIVERGÊNCIA ENCONTRADA![/]", border_style="green"))


def gerar_relatorio_texto(divergencias: List[Divergencia], stats: dict):
    """Gera relatório em texto simples"""
    print("\n" + "="*80)
    print("VALIDADOR PERFEITO - Relatório de Divergências")
    print("="*80)

    print(f"\nESTATÍSTICAS:")
    print(f"  Artigos no TXT: {stats['artigos_txt']}")
    print(f"  Artigos no JSON: {stats['artigos_json']}")
    print(f"  Artigos em comum: {stats['artigos_comuns']}")
    print(f"  Total de divergências: {len(divergencias)}")

    if divergencias:
        print("\nDIVERGÊNCIAS:")
        for i, d in enumerate(divergencias, 1):
            print(f"\n{i}. [{d.severidade}] {d.tipo}")
            print(f"   Artigo: {d.artigo} | Campo: {d.campo}")
            print(f"   Esperado (TXT): {d.esperado[:80]}...")
            print(f"   Encontrado (JSON): {d.encontrado[:80]}...")
            if d.linha_txt:
                print(f"   Linha TXT: {d.linha_txt}")
            if d.detalhes:
                print(f"   Detalhes: {d.detalhes}")
    else:
        print("\n✅ NENHUMA DIVERGÊNCIA ENCONTRADA!")


def gerar_relatorio_html(divergencias: List[Divergencia], stats: dict, output_path: str):
    """Gera relatório HTML completo"""
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Validador Perfeito - Relatório</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #1a1a2e; color: #eee;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ color: #00d4ff; border-bottom: 2px solid #00d4ff; padding-bottom: 10px; }}
        .stats {{
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px; margin: 20px 0;
        }}
        .stat-card {{
            background: #16213e; padding: 20px; border-radius: 10px;
            border-left: 4px solid #00d4ff;
        }}
        .stat-card h3 {{ margin: 0 0 10px 0; color: #888; font-size: 14px; }}
        .stat-card .value {{ font-size: 32px; font-weight: bold; color: #00d4ff; }}
        .filters {{
            background: #16213e; padding: 15px; border-radius: 10px; margin: 20px 0;
        }}
        .filters input, .filters select {{
            padding: 8px 12px; border: 1px solid #333; border-radius: 5px;
            background: #0f0f23; color: #eee; margin-right: 10px;
        }}
        table {{
            width: 100%; border-collapse: collapse; margin: 20px 0;
            background: #16213e; border-radius: 10px; overflow: hidden;
        }}
        th {{ background: #0f3460; color: #00d4ff; padding: 12px; text-align: left; }}
        td {{ padding: 10px 12px; border-bottom: 1px solid #333; }}
        tr:hover {{ background: #1f4068; }}
        .sev-CRITICO {{ color: #ff4757; font-weight: bold; }}
        .sev-ALTO {{ color: #ffa502; font-weight: bold; }}
        .sev-MEDIO {{ color: #ffda79; }}
        .sev-BAIXO {{ color: #7bed9f; }}
        .sev-INFO {{ color: #70a1ff; }}
        .diff {{ font-family: monospace; font-size: 12px; background: #0f0f23; padding: 5px; border-radius: 3px; }}
        .esperado {{ color: #ff6b6b; }}
        .encontrado {{ color: #4ecdc4; }}
        .success {{ background: #2ed573; color: #000; padding: 20px; border-radius: 10px; text-align: center; }}
        .badge {{
            display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px;
            margin-right: 5px;
        }}
        .badge-critico {{ background: #ff4757; }}
        .badge-alto {{ background: #ffa502; }}
        .badge-medio {{ background: #ffd32a; color: #000; }}
        .badge-baixo {{ background: #7bed9f; color: #000; }}
        .badge-info {{ background: #70a1ff; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Validador Perfeito - Relatório de Divergências</h1>
        <p>Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>

        <div class="stats">
            <div class="stat-card">
                <h3>Artigos no TXT</h3>
                <div class="value">{stats['artigos_txt']}</div>
            </div>
            <div class="stat-card">
                <h3>Artigos no JSON</h3>
                <div class="value">{stats['artigos_json']}</div>
            </div>
            <div class="stat-card">
                <h3>Em Comum</h3>
                <div class="value">{stats['artigos_comuns']}</div>
            </div>
            <div class="stat-card">
                <h3>Divergências</h3>
                <div class="value" style="color: {'#ff4757' if divergencias else '#2ed573'}">
                    {len(divergencias)}
                </div>
            </div>
        </div>
"""

    if divergencias:
        # Contagem por tipo
        por_tipo = defaultdict(int)
        por_sev = defaultdict(int)
        for d in divergencias:
            por_tipo[d.tipo] += 1
            por_sev[d.severidade] += 1

        html += """
        <div class="filters">
            <strong>Filtros:</strong>
            <input type="text" id="filtroArtigo" placeholder="Filtrar por artigo..." onkeyup="filtrar()">
            <select id="filtroSev" onchange="filtrar()">
                <option value="">Todas severidades</option>
                <option value="CRITICO">Crítico</option>
                <option value="ALTO">Alto</option>
                <option value="MEDIO">Médio</option>
                <option value="BAIXO">Baixo</option>
                <option value="INFO">Info</option>
            </select>
            <select id="filtroTipo" onchange="filtrar()">
                <option value="">Todos os tipos</option>
"""
        for tipo in sorted(por_tipo.keys()):
            html += f'                <option value="{tipo}">{tipo} ({por_tipo[tipo]})</option>\n'

        html += """
            </select>
        </div>

        <div style="margin: 10px 0;">
"""
        for sev, count in sorted(por_sev.items(), key=lambda x: ['CRITICO','ALTO','MEDIO','BAIXO','INFO'].index(x[0]) if x[0] in ['CRITICO','ALTO','MEDIO','BAIXO','INFO'] else 99):
            html += f'            <span class="badge badge-{sev.lower()}">{sev}: {count}</span>\n'

        html += """
        </div>

        <table id="tabelaDivergencias">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Severidade</th>
                    <th>Artigo</th>
                    <th>Campo</th>
                    <th>Tipo</th>
                    <th>Esperado (TXT)</th>
                    <th>Encontrado (JSON)</th>
                    <th>Linha TXT</th>
                </tr>
            </thead>
            <tbody>
"""
        for i, d in enumerate(divergencias, 1):
            html += f"""
                <tr data-artigo="{d.artigo}" data-sev="{d.severidade}" data-tipo="{d.tipo}">
                    <td>{i}</td>
                    <td class="sev-{d.severidade}">{d.severidade}</td>
                    <td><strong>{d.artigo}</strong></td>
                    <td>{d.campo}</td>
                    <td>{d.tipo}</td>
                    <td><div class="diff esperado">{d.esperado[:150]}{'...' if len(d.esperado) > 150 else ''}</div></td>
                    <td><div class="diff encontrado">{d.encontrado[:150]}{'...' if len(d.encontrado) > 150 else ''}</div></td>
                    <td>{d.linha_txt or '-'}</td>
                </tr>
"""

        html += """
            </tbody>
        </table>

        <script>
        function filtrar() {
            const artigo = document.getElementById('filtroArtigo').value.toLowerCase();
            const sev = document.getElementById('filtroSev').value;
            const tipo = document.getElementById('filtroTipo').value;

            document.querySelectorAll('#tabelaDivergencias tbody tr').forEach(row => {
                const matchArtigo = !artigo || row.dataset.artigo.toLowerCase().includes(artigo);
                const matchSev = !sev || row.dataset.sev === sev;
                const matchTipo = !tipo || row.dataset.tipo === tipo;
                row.style.display = (matchArtigo && matchSev && matchTipo) ? '' : 'none';
            });
        }
        </script>
"""
    else:
        html += """
        <div class="success">
            <h2>✅ NENHUMA DIVERGÊNCIA ENCONTRADA!</h2>
            <p>O JSON está 100% fiel ao TXT oficial.</p>
        </div>
"""

    html += """
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
        'divergencias': [
            {
                'tipo': d.tipo,
                'severidade': d.severidade,
                'artigo': d.artigo,
                'campo': d.campo,
                'esperado': d.esperado,
                'encontrado': d.encontrado,
                'linha_txt': d.linha_txt,
                'posicao_json': d.posicao_json,
                'detalhes': d.detalhes
            }
            for d in divergencias
        ]
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Relatório JSON salvo em: {output_path}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Validador Perfeito - Compara JSON de lei com TXT oficial',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python validator_perfeito.py ../public/codigp_v2.json ../public/leioficial.txt
  python validator_perfeito.py lei.json lei.txt --html relatorio.html
  python validator_perfeito.py lei.json lei.txt --json relatorio.json --html relatorio.html
        """
    )
    parser.add_argument('json_path', help='Caminho para o arquivo JSON')
    parser.add_argument('txt_path', help='Caminho para o arquivo TXT oficial')
    parser.add_argument('--html', metavar='FILE', help='Gerar relatório HTML')
    parser.add_argument('--json', metavar='FILE', help='Gerar relatório JSON')
    parser.add_argument('--quiet', '-q', action='store_true', help='Não mostrar saída no terminal')

    args = parser.parse_args()

    # Valida arquivos
    json_path = Path(args.json_path)
    txt_path = Path(args.txt_path)

    if not json_path.exists():
        print(f"ERRO: Arquivo JSON não encontrado: {json_path}")
        sys.exit(1)

    if not txt_path.exists():
        print(f"ERRO: Arquivo TXT não encontrado: {txt_path}")
        sys.exit(1)

    # Carrega arquivos
    print("Carregando arquivos...")

    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)

    with open(txt_path, 'r', encoding='utf-8') as f:
        txt_content = f.read()

    # Parse
    print("Parseando TXT...")
    parser_txt = ParserTXT(txt_content)
    artigos_txt, estrutura_txt = parser_txt.parse()

    print("Parseando JSON...")
    parser_json = ParserJSON(json_data)
    artigos_json = parser_json.parse()

    # Estatísticas
    stats = {
        'artigos_txt': len(artigos_txt),
        'artigos_json': len(artigos_json),
        'artigos_comuns': len(set(artigos_txt.keys()) & set(artigos_json.keys()))
    }

    # Validação
    print("Validando...")
    validador = ValidadorPerfeito(artigos_txt, artigos_json, estrutura_txt, parser_json.estrutura)
    divergencias = validador.validar_tudo()

    # Ordena por severidade
    ordem_sev = {'CRITICO': 0, 'ALTO': 1, 'MEDIO': 2, 'BAIXO': 3, 'INFO': 4}
    divergencias.sort(key=lambda d: (ordem_sev.get(d.severidade, 99), d.artigo))

    # Relatórios
    if not args.quiet:
        gerar_relatorio_rich(divergencias, stats)

    if args.html:
        gerar_relatorio_html(divergencias, stats, args.html)

    if args.json:
        gerar_relatorio_json(divergencias, stats, args.json)

    # Exit code
    criticos = sum(1 for d in divergencias if d.severidade == 'CRITICO')
    sys.exit(1 if criticos > 0 else 0)


if __name__ == '__main__':
    main()
