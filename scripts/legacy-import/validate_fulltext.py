import json
import difflib
import sys
import re
import unicodedata

def normalize_token(text):
    """
    Normaliza um token individual para comparação semântica estrita.
    Remove pontuação interna irrelevante p/ match exato de palavras.
    """
    text = unicodedata.normalize('NFC', text).lower()
    return text

def get_canonical_id(raw_id):
    """
    Robust normalization for Brazilian legislative IDs.
    Examples:
    '1º' -> '1'
    '1.º' -> '1'
    '1-A' -> '1-A'
    '121a' -> '121-A'
    '2.037' -> '2037'
    """
    if not raw_id: return ""
    
    # 1. Clean ordinal garbage and dots used for thousands (2.037)
    # We keep letters and numbers and hyphens.
    clean = str(raw_id).replace('º', '').replace('°', '').replace('ª', '').replace('.', '')
    
    # 2. Standardize suffixes (Art. 121-A, 121A, 121 A)
    # Pattern: Digit(s) followed by optional hyphen and Letter(s)
    match = re.match(r'^(\d+)(?:\s*-\s*|\s+)?([A-Z]+)?$', clean, re.IGNORECASE)
    if match:
        num = match.group(1)
        suffix = match.group(2)
        if suffix:
            return f"{num}-{suffix.upper()}"
        return num
        
    return clean.upper().strip()

def tokenize_stream(text):
    """
    Converte texto em fluxo de tokens (palavras e pontuações relevantes).
    Preserva '( ) , .' como tokens separados.
    """
    # Adiciona espaços ao redor de pontuação para splitar fácil
    text = re.sub(r'([(),.:;])', r' \1 ', text)
    # Split por whitespace (quebra de linha, espaço, tab)
    tokens = text.split()
    return [t for t in tokens if t.strip()]

def get_equivalence(token_local, token_official):
    """
    Verifica equivalência semântica entre dois tokens que são textualmente diferentes.
    Retorna (True/False, Tipo)
    """
    t1, t2 = normalize_token(token_local), normalize_token(token_official)
    
    if t1 == t2: return True, "EXACT"
    
    # Regra Numérica: 1º == 1o == 1.
    if t1.replace('º','o').replace('.','') == t2.replace('º','o').replace('.',''): return True, "FORMAT"
    
    # Regra Aspas
    if t1 in ['"', '“', '”'] and t2 in ['"', '“', '”']: return True, "FORMAT"
    
    # Regra Traço vs Parentese em Alíneas (a - vs a))
    # O tokenizer separa pontuação. Então se um é '-' e o outro é ')', pode ser só estática de lista.
    if t1 in ['-', '–', '—', ')'] and t2 in ['-', '–', '—', ')']: return True, "FORMAT"
    
    # Regra Termos Legislativos Comuns
    termos_legislativos = {
        'redação': 'incluído',
        'incluído': 'redação',
        'vide': 'ver',
        'ver': 'vide'
    }
    if termos_legislativos.get(t1) == t2: return True, "LEGAL_TERM"
    
    return False, "DIFF"

def check_numeric_expansion(local_stream, official_stream, i_local, i_official):
    """
    Detecta padrão '2 (dois)' no Local vs 'dois' ou '2' no Oficial.
    Retorna (Match?, avanço_local, avanço_official)
    """
    # Verifica se Local tem sequencia Num + ( + Extenso + )
    # Ex: tokens[i] = '2', tokens[i+1] = '(', ...
    try:
        # Padrão: Num ( Extenso )
        if (local_stream[i_local].isdigit() and 
            local_stream[i_local+1] == '(' and 
            local_stream[i_local+3] == ')'):
            
            num_local = local_stream[i_local]
            extenso_local = local_stream[i_local+2]
            
            target = official_stream[i_official]
            
            # Caso 1: Oficial tem só o extenso 'dois'
            if normalize_token(extenso_local) == normalize_token(target):
                return True, 4, 1 # Pula 4 tokens no local ('2','(','dois',')'), 1 no oficial
                
            # Caso 2: Oficial tem só o número '2'
            if normalize_token(num_local) == normalize_token(target):
                return True, 4, 1
                
    except IndexError:
        pass
        
    return False, 0, 0

def extract_json_data(json_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f: data = json.load(f)
    except: return {}, set(), set()

    articles = {}
    epigraphs = set()
    headers = set()  # Headers "conhecidos" (Títulos, Caps) vindos do path
    
    for art in data.get('artigos', []):
        # Epígrafes para ignorar no raw
        if art.get('epigrafe'): 
            epigraphs.add(art['epigrafe'].strip().lower())

        # Headers para ignorar no raw
        if 'path' in art:
             for val in art['path'].values():
                 if val: headers.add(val.strip().lower())

        # Monta texto do artigo
        num = str(art.get('numero', ''))
        # Robust Canonical ID Mapping
        key = get_canonical_id(num)
        
        parts = []
        # Label Artigo - REMOVIDO PARA EVITAR DUPLICIDADE/ERRO NA COMPARAÇÃO
        # O parser RAW já separa o Artigo N e pega o CONTEÚDO.
        # Se adicionarmos "Art. N" aqui, vai quebrar se o RAW não tiver exato.
        # parts.append(f"Art. {num}") 
        
        # Conteúdo
        full_text_blocks = []
        for block in art.get('plate_content', []):
            if 'children' in block:
                # Pula epígrafe repetida no corpo
                txt_block = "".join([c.get('text','') for c in block['children']])
                if art.get('epigrafe') and txt_block.strip() == art['epigrafe'].strip():
                    continue
                full_text_blocks.append(txt_block)
        
        # Junta tudo e limpa o prefixo do Artigo, igual fazemos no RAW
        combined_text = " ".join(full_text_blocks)
        clean_text = re.sub(r'^\s*(?:Art\.|Artigo)\s*\d+(?:\.\d+)?(?:-[A-Z]+|[A-Z])?[º°ª]?\s*[-–.]?\s*', '', combined_text, flags=re.IGNORECASE)
        
        articles[key] = clean_text
        
    return articles, epigraphs, headers

def parse_raw_optimized(raw_text, known_epigraphs, known_headers):
    """
    Parser robusto que só extrai o que parece texto de artigo,
    ignorando linhas que batem com headers conhecidos.
    """
    articles = {}
    article_contexts = {} # New: Map art_id -> list of headers
    curr_key = None
    curr_tokens = []
    
    # Hierarchy State
    hierarchy = {
        'LIVRO': None, 'PARTE': None, 'TÍTULO': None, 'CAPÍTULO': None, 'SEÇÃO': None, 'SUBSEÇÃO': None
    }
    # Hierarchy Order for clearing lower levels
    levels = ['LIVRO', 'PARTE', 'TÍTULO', 'CAPÍTULO', 'SEÇÃO', 'SUBSEÇÃO']
    
    # Regex Artigo: "Art. 1", "Art. 1º", "Art. 1-A", "Art 1A", "Art. 2.037"
    # Captura grupo 1: "1", "1º", "1-A", "1A"
    re_art = re.compile(r'^\s*(?:Art\.|Artigo)\s*(\d+(?:\.\d+)?(?:-[A-Z]+|[A-Z])?[º°ª]?)', re.IGNORECASE)
    
    for line in raw_text.splitlines():
        clean = line.strip()
        if not clean: continue
        
        # 1. Filtro de Headers/Epígrafes (Match difuso ou exato)
        # Se a linha for exatamente um Header conhecido, ignora
        is_known_garbage = False
        if clean.lower() in known_headers: is_known_garbage = True
        if clean.lower() in known_epigraphs: is_known_garbage = True
        
        # Filtro de Cabeçalhos Genéricos (DAS PENAS, DO CRIME)
        # Instead of skipping, we try to CAPTURE them if they look like structure
        detected_level = None
        upper_clean = clean.upper()
        
        for lvl in levels:
             if upper_clean.startswith(lvl + " ") or upper_clean == lvl:
                 detected_level = lvl
                 break
                 
        if detected_level:
             # Found a header! ex: "TÍTULO I"
             # 1. Clear lower levels
             idx = levels.index(detected_level)
             for i in range(idx + 1, len(levels)):
                 hierarchy[levels[i]] = None
             
             # 2. Set current level
             hierarchy[detected_level] = clean
             
             # Don't treat as garbage context, but DO skip adding to Article Text?
             # Yes, headers shouldn't be inside article text.
             continue
        
        if is_known_garbage: continue

        # Header detection "DO CRIME", "DA PENA" (sem Título/Capítulo antes)
        # Often these are subtitles associated with the current lowest level.
        # For simplicity, we ignore capturing them as distinct levels for now, 
        # or we could append to the current active level's text.
        if re.match(r'^(DO\s|DA\s|DOS\s|DAS\s)', clean, re.IGNORECASE):
             if not clean.endswith('.') and not clean.endswith(':'):
                 continue
        
        # 2. Detecção de Artigo
        match = re_art.match(clean)
        if match:
            # Salva anterior
            if curr_key: articles[curr_key] = "\n".join(curr_tokens)
            
            # Canonical key for mapping
            curr_key = get_canonical_id(match.group(1))
            
            # Save Context Snapshot for this new article
            # Build list of active headers in order
            active_ctx = [hierarchy[lvl] for lvl in levels if hierarchy[lvl]]
            article_contexts[curr_key] = active_ctx
            
            # O próprio match line geralmente é "Art. 1 - Conteúdo..."
            # Precisamos extrair o conteúdo DEPOIS do "Art. 1"
            # Removemos o prefixo "Art. X" da linha para pegar só o texto
            line_content = re.sub(r'^\s*(?:Art\.|Artigo)\s*\d+(?:\.\d+)?(?:-[A-Z]+|[A-Z])?[º°ª]?\s*[-–.]?\s*', '', clean, flags=re.IGNORECASE)
            
            if line_content:
                curr_tokens = [line_content]
            else:
                curr_tokens = []
        else:
            if curr_key: curr_tokens.append(clean)
            
    if curr_key: articles[curr_key] = "\n".join(curr_tokens)
    return articles, article_contexts

class StructuralValidator:
    def __init__(self, json_data, raw_text):
        self.json_data = json_data
        self.raw_text = raw_text
        self.articles_json = {get_canonical_id(a.get('numero', '')): a for a in json_data.get('artigos', [])}

    def check_hierarchy(self):
        """
        Reconstructs hierarchy from raw text and compares with JSON lineage.
        Returns list of errors.
        """
        errors = []
        # TODO: Implement full context stack logic
        # For now, placeholder
        return errors

    def check_counts(self, article_id):
        """
        Compares counts of sub-items (Incisos, Alíneas, Itens, Parágrafos)
        between JSON Object and Raw Text Regex.
        
        Using STRICT regex for "Pente-Fino".
        """
        if article_id not in self.articles_json: return []
        
        art_obj = self.articles_json[article_id]
        
        # We need the RAW text for this specific article. 
        # Ideally passed in, or we assume the caller extracted it.
        # Check expects a text_block string.
        return []

    def count_items_in_text(self, text_block):
        """
        Performs regex counting on a text block with Revoked detection.
        Returns detailed counts: {'paragrafos': {'total': X, 'revoked': Y}, ...}
        """
        totals = {}
        
        # Helper to count matches and how many are revoked
        def count_with_revoked(pattern, text):
            matches = list(re.finditer(pattern, text, re.MULTILINE))
            total = len(matches)
            revoked = 0
            for m in matches:
                # Check if the line (or immediate context) contains (Revogado) or (Vetado)
                # We assume the match group captures the structural start.
                # We look at the full line where the match occurred.
                line_start = text.rfind('\n', 0, m.start()) + 1
                line_end = text.find('\n', m.end())
                if line_end == -1: line_end = len(text)
                full_line = text[line_start:line_end]
                
                # Update: Allow content inside parentheses e.g. (Revogado pela Lei...)
                if re.search(r'\((?:Revogado|Vetado).*?\)', full_line, re.IGNORECASE):
                    revoked += 1
            return {'total': total, 'revoked': revoked, 'active': total - revoked}

        # Incisos: "I - Texto..." (Can be lowercase)
        # Matches Start of Line + Roman + [Hyphenated Suffix] + Separator
        # Strict Suffix: (?:-[A-Za-z0-9]+)? to avoid matching words like 'Despreza-se' (D + espreza)
        totals['incisos'] = count_with_revoked(r'^\s*[IVXLCDM]+(?:-[A-Za-z0-9]+)?\s*[-–—]', text_block)
        
        # Alíneas: "a) Texto" or "a-1) Texto"
        # Matches Start of Line + Letter + [Hyphenated Suffix] + Parenthesis
        # Strict Suffix: (?:-[A-Za-z0-9]+)? to avoid matching words like 'amor)' (a + mor)
        totals['alineas'] = count_with_revoked(r'^\s*[a-z](?:-[A-Za-z0-9]+)?\s*[\)-]', text_block)
        
        # Itens: "1. Texto" or "1-A. Texto"
        totals['itens'] = count_with_revoked(r'^\s*\d+(?:-[A-Za-z0-9]+)?\.', text_block)
        
        # Parágrafos: "§ 1º Texto"
        # Danger: "§ 1º do artigo..." (Reference starting a line)
        # Fix: Negative Lookahead for common reference connectors (do, da, no, na, dos, das, de)
        # IMPORTANT: Case Sensitive check! 'Na' (Head) is valid, 'na' (Ref) is invalid.
        # We REMOVE re.IGNORECASE for this specific findall.
        # UPDATE: Support 'o' and 'O' as ordinal markers.
        # UPDATE: Support Alpha Suffixes (e.g. § 2º-A, § 1o-B). 
        # For paragraphs, stricter suffix isn't as critical due to § symbol, but consistent.
        # BUT some suffixes might not have hyphen? § 2ºA? Let's allow [-A-Za-z0-9]* for paragraphs as § is unique.
        # Actually, let's keep it robust.
        totals['paragrafos'] = count_with_revoked(r'^\s*§\s*\d+[º°ªoO]?[-A-Za-z0-9]*\s*[-–.]?\s+(?!do\b|da\b|no\b|na\b|dos\b|das\b|de\b)', text_block)
        
        # Parágrafo Unico (Case insensitive for type search, but revoked check same)
        # Note: count_with_revoked uses the pattern finditer.
        # For Para Unico, pattern needs IGNORECASE. Use explicit logic or pass flag?
        # Let's handle manually or update helper.
        # Simpler:
        match_unico = list(re.finditer(r'^\s*Parágrafo\s*único', text_block, re.IGNORECASE | re.MULTILINE))
        u_revoked = 0
        for m in match_unico:
            line_start = text_block.rfind('\n', 0, m.start()) + 1
            line_end = text_block.find('\n', m.end())
            if line_end == -1: line_end = len(text_block)
            full_line = text_block[line_start:line_end]
            if re.search(r'\((?:Revogado|Vetado).*?\)', full_line, re.IGNORECASE):
                u_revoked += 1
        
        totals['paragrafo_unico'] = {'total': len(match_unico), 'revoked': u_revoked, 'active': len(match_unico) - u_revoked}
        
        return totals

    def get_key_type(self, key):
        if key.startswith('inciso-'): return 'incisos'
        if key.startswith('alinea-'): return 'alineas'
        if key.startswith('item-'): return 'itens'
        if key.startswith('paragrafo-unico'): return 'paragrafo_unico'
        if key.startswith('paragrafo-'): return 'paragrafos'
        return None # Should not happen for valid keys

    def recursive_json_count(self, art_json):
        # Helper to extract text from a node recursively
        def get_node_text(node):
            text = ""
            if 'text' in node: text += node['text']
            if 'children' in node:
                for child in node['children']:
                    text += " " + get_node_text(child)
            return text

        counts = {
            'incisos': {'total': set(), 'revoked_candidates': set(), 'active_discoveries': set()},
            'alineas': {'total': set(), 'revoked_candidates': set(), 'active_discoveries': set()},
            'itens': {'total': set(), 'revoked_candidates': set(), 'active_discoveries': set()},
            'paragrafos': {'total': set(), 'revoked_candidates': set(), 'active_discoveries': set()},
            'paragrafo_unico': {'total': set(), 'revoked_candidates': set(), 'active_discoveries': set()}
        }
        
        def walk(node):
            if isinstance(node, dict):
                if 'slug' in node:
                    s = node['slug']
                    parts = s.split('.')
                    if parts:
                        leaf = parts[-1]
                        # Refined structural regex to exclude metadata suffixes like -epigraph, -redacao, etc.
                        valid_part_regex = r'^(artigo-\d+(?:-(?!(?:epigraph|redacao|incluido|alterado|historico|penalty|tag|search|text|label|content|plate))\w+)*|paragrafo-\d+(?:-(?!(?:epigraph|redacao|incluido|alterado|historico|penalty|tag|search|text|label|content|plate))\w+)*|paragrafo-unico|inciso-[IVXLCDM\d]+(?:-(?!(?:epigraph|redacao|incluido|alterado|historico|penalty|tag|search|text|label|content|plate))\w+)*|alinea-[a-z]+(?:-(?!(?:epigraph|redacao|incluido|alterado|historico|penalty|tag|search|text|label|content|plate))\w+)*|item-\d+(?:-(?!(?:epigraph|redacao|incluido|alterado|historico|penalty|tag|search|text|label|content|plate))\w+)*)$'
                        
                        if re.match(valid_part_regex, leaf):
                            target_key = leaf
                            k_type = self.get_key_type(target_key)
                            if k_type and k_type in counts:
                                # Use FULL SLUG (s) to ensure uniqueness
                                counts[k_type]['total'].add(s)
                                
                                # Check Revoked (Support gender like Revogada/Revogadas)
                                node_text = get_node_text(node)
                                if re.search(r'\((?:Revogad[oa]s?|Vetado).*?\)', node_text, re.IGNORECASE):
                                    counts[k_type]['revoked_candidates'].add(s)
                                else:
                                    counts[k_type]['active_discoveries'].add(s)
                
                if 'children' in node:
                    for child in node['children']:
                        walk(child)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        if 'plate_content' in art_json:
            walk(art_json['plate_content'])
            
        final = {}
        for k, v in counts.items():
            t = len(v['total'])
            # A slug is only truly revoked if we haven't found an active version of it (priority to active status)
            final_revoked = v['revoked_candidates'] - v['active_discoveries']
            r = len(final_revoked)
            final[k] = {'total': t, 'revoked': r, 'active': t - r}
        return final

    def validate_counts(self, article_id, text_block):
        issues = []
        if article_id not in self.articles_json: return []
        
        art_json = self.articles_json[article_id]
        
        # 1. Count entities in Raw Text (Detailed)
        real_counts = self.count_items_in_text(text_block)
        
        # 2. Count entities in JSON (Detailed with Revoked check)
        json_counts = self.recursive_json_count(art_json)
        
        # Helper to Compare
        def check_mismatch(label, key):
            # JSON Stats
            j_active = json_counts[key]['active']
            j_revoked = json_counts[key]['revoked']
            j_total = json_counts[key]['total']
            
            # Real Stats
            r_active = real_counts[key]['active']
            r_revoked = real_counts[key]['revoked']
            r_total = real_counts[key]['total']
            
            # Compare Active vs Active (Primary Check)
            if j_active != r_active:
                if r_revoked > 0 or j_revoked > 0:
                     issues.append(f"❌ [COUNT] {label}: JSON Ativo ({j_active}) vs Real Ativo ({r_active}) [JSON Total {j_total}, Real Total {r_total}]")
                else:
                     issues.append(f"❌ [COUNT] {label}: JSON ({j_active}) vs Real ({r_total})")
            elif r_revoked > 0 and j_revoked == 0:
                # Warning: Real has revoked, JSON kept them as active? Or JSON removed them?
                # If j_active == r_active (e.g. 7 vs 7), and r_revoked > 0.
                # If JSON also had them, J_active would be matching R_active.
                # This logic is fine.
                issues.append(f"⚠️ [INFO] {label}: JSON bate com Real Ativo ({j_active}). ({r_revoked} Revogados no Texto)")
            elif j_revoked > 0:
                # Info: JSON successfully detected revoked items
                 issues.append(f"⚠️ [INFO] {label}: JSON detectou {j_revoked} itens Revogados/Vetados.")

        # 3. Smart check for "Type Swaps"
        p_json_active = json_counts['paragrafos']['active']
        p_real_active = real_counts['paragrafos']['active']
        
        u_json_active = json_counts['paragrafo_unico']['active']
        u_real_active = real_counts['paragrafo_unico']['active']

        swap_detected = False
        # Logic: If one side has SOME active paragraphs and ZERO active unique, 
        # and other side has ZERO active paragraphs and SOME active unique.
        if p_json_active > 0 and u_real_active > 0 and p_real_active == 0 and u_json_active == 0:
             issues.append(f"⚠️ [TYPE MISMATCH] Possível troca: JSON tem 'Parágrafos' ({p_json_active}) mas Texto tem 'Parágrafo Único'.")
             swap_detected = True
        elif u_json_active > 0 and p_real_active > 0 and u_real_active == 0 and p_json_active == 0:
             issues.append(f"⚠️ [TYPE MISMATCH] Possível troca: JSON tem 'Parágrafo Único' mas Texto tem 'Parágrafos' ({p_real_active}).")
             swap_detected = True

        if not swap_detected:
            check_mismatch('Incisos', 'incisos')
            check_mismatch('Alíneas', 'alineas')
            check_mismatch('Itens', 'itens')
            check_mismatch('Parágrafos', 'paragrafos')
            check_mismatch('Parágrafo Único', 'paragrafo_unico')
        else:
             # Even if swap detected, check others (Incisos etc)
            check_mismatch('Incisos', 'incisos')
            check_mismatch('Alíneas', 'alineas')
            check_mismatch('Itens', 'itens')
        return issues



def compare_streams(id_art, text_local, text_official):
    """
    Compara dois textos via token stream.
    Retorna lista de divergências classificadas.
    """
    output = []
    
    tokens_l = tokenize_stream(text_local)
    tokens_o = tokenize_stream(text_official)
    
    matcher = difflib.SequenceMatcher(None, tokens_l, tokens_o)
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal': continue
        
        seg_l = tokens_l[i1:i2]
        seg_o = tokens_o[j1:j2]
        
        # Tenta resolver diferenças "virtuais"
        if tag == 'replace':
            # Check Numeral Expansion
            # Implementação simples: se um lado tem numero e outro extenso
            # Devido a complexidade do loop, vamos simplificar:
            # Se for replace de 1 token vs 1 token:
            if len(seg_l) == 1 and len(seg_o) == 1:
                equiv, tipo = get_equivalence(seg_l[0], seg_o[0])
                if input:
                     # Se são equivalentes, ignora
                     if equiv: continue
            
            # Se Local tem "2 (dois)" (3 tokens: 2, (, dois, ) - 4 tokens na vdd)
            # e Official tem "dois" (1 token)
            text_l_seg = " ".join(seg_l)
            text_o_seg = " ".join(seg_o)
            
            # Check expansion simples via string
            if re.search(r'\d+\s*\([^)]+\)', text_l_seg):
                 # Se o oficial está contido no local (ex: "dois" in "2 (dois)")
                 if text_o_seg in text_l_seg:
                     output.append(f"ℹ️  [INFO] Expansão Numérica: Local '{text_l_seg}' vs Oficial '{text_o_seg}'")
                     continue

        # Se chegou aqui, é diferença real ou formatação não tratada
        # Classifica por gravidade
        
        if tag == 'replace':
             output.append(f"❌ [ERRO] Texto Diferente: Local '{' '.join(seg_l)}' vs Oficial '{' '.join(seg_o)}'")
        elif tag == 'delete':
             # Tenta ver se é pontuação
             txt = "".join(seg_l)
             if txt in "().,-:": 
                 output.append(f"ℹ️  [INFO] Pontuação Extra Local: '{txt}'")
             else:
                 output.append(f"❌ [ERRO] Sobrando no Local: '{' '.join(seg_l)}'")
        elif tag == 'insert':
             txt = "".join(seg_o)
             if txt in "().,-:": 
                 output.append(f"ℹ️  [INFO] Pontuação Extra Oficial: '{txt}'")
             else:
                 output.append(f"❌ [ERRO] Faltando no Local: '{' '.join(seg_o)}'")

    return output

def main():
    if len(sys.argv) < 3: return
    json_path, raw_path = sys.argv[1], sys.argv[2]
    
    print("🚀 Iniciando Validação TOKEN STREAM...")
    json_arts, epigraphs, headers = extract_json_data(json_path)
    raw_arts = parse_raw_optimized(open(raw_path, encoding='utf-8').read(), epigraphs, headers)
    
    print(f"Stats: JSON {len(json_arts)} arts | OFICIAL {len(raw_arts)} arts")
    
    report_lines = []
    
    # Interseção de chaves
    common_keys = sorted(list(set(json_arts.keys()) & set(raw_arts.keys())), key=lambda x: int(re.sub(r'\D','',x)) if re.sub(r'\D','',x) else 0)
    
    perfect = 0
    warnings = 0
    errors = 0
    
    for k in common_keys:
        issues = compare_streams(k, json_arts[k], raw_arts[k])
        if not issues:
            perfect += 1
        else:
            # Check se tem erro real
            has_error = any("❌" in i for i in issues)
            if has_error: errors += 1
            else: warnings += 1
            
            report_lines.append(f"\n🔹 Art. {k}")
            for i in issues:
                report_lines.append("   " + i)

    # Missing
    only_json = set(json_arts.keys()) - set(raw_arts.keys())
    only_raw = set(raw_arts.keys()) - set(json_arts.keys())
    
    if only_json:
        errors += len(only_json)
        report_lines.append(f"\n❌ [CRÍTICO] Artigos sobrando no JSON: {list(only_json)}")
    if only_raw:
        errors += len(only_raw)
        report_lines.append(f"\n❌ [CRÍTICO] Artigos sobrando no OFICIAL: {list(only_raw)}")

    print(f"\n✅ Perfeitos: {perfect}")
    print(f"ℹ️  Com Avisos: {warnings}")
    print(f"❌ Com Erros : {errors}")
    
    with open('diff_token_report.txt', 'w', encoding='utf-8') as f:
        f.write("\n".join(report_lines))
    print("📄 Relatório: diff_token_report.txt")

if __name__ == "__main__":
    main()
