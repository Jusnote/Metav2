import sys
import os
import json
import re
import math
import difflib
import subprocess
from datetime import datetime
from collections import defaultdict, Counter

# Rich Imports
from rich.console import Console
from rich.table import Table
from rich.layout import Layout
from rich.panel import Panel
from rich.text import Text
from rich import box
from rich.live import Live
from rich.prompt import Prompt, Confirm
from rich.markdown import Markdown
from rich.syntax import Syntax
from rich.align import Align
from rich.terminal_theme import MONOKAI

# Import core logic
try:
    import validate_fulltext as validator
except ImportError:
    print("❌ Critical Error: validate_fulltext.py not found in current directory.")
    sys.exit(1)

# Configuration
CONFIG_FILE = "validator_config.json"
CONSOLE = Console(record=True) # Enable recording for export

class ValidatorDashboard:
    def __init__(self, json_path, raw_path):
        self.json_path = json_path
        self.raw_path = raw_path
        self.config = self.load_config()
        self.data_loaded = False
        
        # Data storage
        self.json_arts = {}
        self.raw_arts = {}
        self.common_keys = []
        self.errors = {} # Map article_id -> list of issues
        self.clusters = [] # List of {'type': str, 'count': int, 'artiies': [], 'example': str}
        
        # Stats
        self.stats = {
            'perfect': 0,
            'warnings': 0,
            'critical': 0,
            'ignored': 0,
            'history': self.config.get('history', [])
        }

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {'ignore_rules': [], 'history': []}
        return {'ignore_rules': [], 'history': []}

    def save_config(self):
        # Keep only last 10 history points
        if len(self.config['history']) > 15:
            self.config['history'] = self.config['history'][-15:]
            
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)

    def load_data(self):
        with CONSOLE.status("[bold green]Loading and Analyzing Data...") as status:
            # Load Data using original validator logic
            # We need to suppress print output from validate_fulltext or capture it
            # For now, just call them, print will appear above TUI (not ideal but safe)
            json_arts, epigraphs, headers = validator.extract_json_data(self.json_path)
            
            with open(self.raw_path, 'r', encoding='utf-8') as f:
                raw_text = f.read()
            
            # parse_raw_optimized now returns (articles, context_map)
            raw_arts, context_map = validator.parse_raw_optimized(raw_text, epigraphs, headers)
            
            self.json_arts = json_arts
            self.raw_arts = raw_arts
            self.article_contexts = context_map
            
            # Load raw JSON data for Structural Validator
            try:
                with open(self.json_path, 'r', encoding='utf-8') as f:
                    self.json_data_raw = json.load(f)
            except:
                self.json_data_raw = {'artigos': []}
            
            # Normalize Keys
            self.common_keys = sorted(
                list(set(json_arts.keys()) & set(raw_arts.keys())), 
                key=lambda x: int(re.sub(r'\D','',x)) if re.sub(r'\D','',x) else 0
            )
            
            # Analyze
            self.analyze()
            self.data_loaded = True

    def is_ignored(self, issue_text):
        for rule in self.config.get('ignore_rules', []):
            if rule['type'] == 'exact' and rule['pattern'] in issue_text:
                return True
            if rule['type'] == 'regex' and re.search(rule['pattern'], issue_text):
                return True
        return False

    def analyze(self):
        self.errors = {}
        
        # Run Structural Check Preview
        struct_val = validator.StructuralValidator(self.json_data_raw, "") 
        struct_errors = 0
        with CONSOLE.status("[bold yellow]Realizando pré-análise estrutural...[/bold yellow]"):
            for art_id in self.common_keys:
                 # We need the TEXT BLOCK with NEWLINES for regex to work
                 # self.raw_arts[art_id] now has newlines thanks to parse_raw_optimized fix
                 text_block = self.raw_arts[art_id]
                 if struct_val.validate_counts(art_id, text_block):
                     struct_errors += 1

        self.stats['perfect'] = 0
        self.stats['warnings'] = 0
        self.stats['critical'] = 0
        self.stats['ignored'] = 0
        self.stats['structural'] = struct_errors
        
        # Diff Analysis
        cluster_map = defaultdict(lambda: {'count': 0, 'articles': [], 'example': ''})
        
        for k in self.common_keys:
            # Capture stdout from validator if needed, but here we just reuse logic
            # We need to reimplement compare_loop logic to get structured data
            # compare_streams returns strings. Ideally we'd refactor validate_fulltext to return dicts.
            # parsing the string strings output from compare_streams is easier for now (Time constraints)
            
            issues = validator.compare_streams(k, self.json_arts[k], self.raw_arts[k])
            
            active_issues = []
            for issue in issues:
                if self.is_ignored(issue):
                    self.stats['ignored'] += 1
                    continue
                active_issues.append(issue)
                
                # Clustering Logic
                clean_msg = issue.replace("❌ [ERRO]", "").replace("ℹ️  [INFO]", "").strip()
                
                # Heuristics for clustering
                cluster_key = "Outros"
                if "Pontuação Extra" in clean_msg:
                    char = clean_msg.split("'")[-2] if "'" in clean_msg else "?"
                    cluster_key = f"Pontuação Extra: {char}"
                elif "Expansão Numérica" in clean_msg:
                    cluster_key = "Expansão Numérica (Ex: 1 vs um)"
                elif "Texto Diferente" in clean_msg:
                    cluster_key = "Divergência de Conteúdo"
                elif "Sobrando no Local" in clean_msg:
                    cluster_key = "Sobrando no JSON (Texto Extra)"
                elif "Faltando no Local" in clean_msg:
                    cluster_key = "Faltando no JSON (Texto Faltante)"
                
                c = cluster_map[cluster_key]
                c['count'] += 1
                c['articles'].append(k)
                if not c['example']: c['example'] = clean_msg

            if not active_issues:
                self.stats['perfect'] += 1
            else:
                self.errors[k] = active_issues
                if any("❌" in i for i in active_issues):
                    self.stats['critical'] += 1
                else:
                    self.stats['warnings'] += 1

        # Missing Articles Check
        only_json = set(self.json_arts.keys()) - set(self.raw_arts.keys())
        only_raw = set(self.raw_arts.keys()) - set(self.json_arts.keys())
        
        if only_json:
             k = "Missing in RAW"
             cluster_map[k] = {'count': len(only_json), 'articles': list(only_json), 'example': f"Artigos: {list(only_json)[:3]}..."}
             self.stats['critical'] += len(only_json)
        
        if only_raw:
             k = "Missing in JSON"
             cluster_map[k] = {'count': len(only_raw), 'articles': list(only_raw), 'example': f"Artigos: {list(only_raw)[:3]}..."}
             self.stats['critical'] += len(only_raw)
             
        # Flatten clusters
        self.clusters = []
        for k, v in cluster_map.items():
            # Remove duplicates in article list
            v['articles'] = sorted(list(set(v['articles'])), key=lambda x: int(re.sub(r'\D','',str(x))) if re.sub(r'\D','',str(x)) else 0)
            self.clusters.append({'type': k, **v})
            
        # Sort by count (descending)
        self.clusters.sort(key=lambda x: x['count'], reverse=True)
        
        # Update History
        current_score = self.stats['critical'] + self.stats['warnings']
        self.config['history'].append({
            'timestamp': datetime.now().isoformat(),
            'score': current_score,
            'perfect': self.stats['perfect']
        })
        self.save_config()

    def get_sparkline(self):
        """Generates a simple text sparkline of errors"""
        history = [h['score'] for h in self.config.get('history', [])]
        if not history: return ""
        
        # Simple mapping to block characters if reliable, or just numbers
        # 123 -> 100 -> 50
        return " 📉 ".join(map(str, history))

    def render_summary(self):
        CONSOLE.clear()
        
        # Header
        table = Table(title=f"🛡️  VALIDATOR DASHBOARD | Score: {self.get_sparkline()}", box=box.ROUNDED)
        table.add_column("Cluster (Tipo de Erro)", style="cyan", no_wrap=True)
        table.add_column("Qtd", justify="right", style="magenta")
        table.add_column("Artigos Afetados", style="green")
        table.add_column("Exemplo", style="dim white")
        
        for i, c in enumerate(self.clusters):
            # Truncate article list
            arts = ", ".join(map(str, c['articles']))
            if len(arts) > 50: arts = arts[:47] + "..."
            
            # Truncate example
            ex = c['example']
            if len(ex) > 60: ex = ex[:57] + "..."
            
            table.add_row(
                f"{i+1}. {c['type']}", 
                str(c['count']), 
                arts, 
                ex
            )
            
        # Totals Panel
        stats_panel = Panel(
            f"[bold green]✅ Perfeitos: {self.stats['perfect']}   [bold yellow]⚠️  Avisos: {self.stats['warnings']}   [bold red]❌ Críticos: {self.stats['critical']}   [bold magenta]🏗️  Erro Estrutural: {self.stats.get('structural', 0)}[/bold magenta]   [bold grey]🙈 Ignorados: {self.stats['ignored']}",
            title="Status Geral", border_style="blue"
        )
        
        CONSOLE.print(table)
        CONSOLE.print("\n[bold white]Menu:[/bold white] [cyan][#][/cyan] Ver Detalhes Cluster | [cyan][A]rtigo[/cyan] Ver Dif Artigo | [cyan][R]egras[/cyan] Gerenciar Ignore | [cyan][H]tml[/cyan] Exportar Relatório | [cyan][S]tructure[/cyan] Auditoria | [cyan][M]atrix[/cyan] Mapa de Calor | [cyan][Q]uit[/cyan] Sair")

    def build_diff_grid(self, article_id):
        if article_id not in self.json_arts or article_id not in self.raw_arts:
            return Panel(f"[red]Artigo {article_id} não encontrado[/red]")

        json_text = self.json_arts[article_id]
        raw_text = self.raw_arts[article_id]
        
        # --- COLORED DIFF LOGIC ---
        tokens_j = validator.tokenize_stream(json_text)
        tokens_r = validator.tokenize_stream(raw_text)
        
        matcher = difflib.SequenceMatcher(None, tokens_j, tokens_r)
        
        text_j = Text()
        text_r = Text()
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            seg_j = " ".join(tokens_j[i1:i2])
            seg_r = " ".join(tokens_r[j1:j2])
            
            if tag == 'equal':
                text_j.append(seg_j + " ")
                text_r.append(seg_r + " ")
            elif tag == 'replace':
                text_j.append(seg_j + " ", style="bold red on black")
                text_r.append(seg_r + " ", style="bold green on black")
            elif tag == 'delete': 
                text_j.append(seg_j + " ", style="bold red on black")
            elif tag == 'insert': 
                text_r.append(seg_r + " ", style="bold green on black")

        grid = Table.grid(expand=True, padding=1)
        grid.add_column("JSON (Local)", ratio=1)
        grid.add_column("OFICIAL (Raw)", ratio=1)
        
        grid.add_row(
            Panel(text_j, title=f"Art {article_id} - Local JSON", border_style="blue"),
            Panel(text_r, title=f"Art {article_id} - Oficial TXT", border_style="green")
        )
        return grid

    def render_diff_view(self, article_id):
        CONSOLE.clear()
        CONSOLE.print(f"[bold]Analisando Artigo {article_id}[/bold]", justify="center")
        
        # Use extracted method
        grid = self.build_diff_grid(article_id)
        CONSOLE.print(grid)
        
        # Show specific errors below
        if article_id in self.errors:
            CONSOLE.print("\n[bold red]Erros Identificados:[/bold red]")
            for err in self.errors[article_id]:
                CONSOLE.print(f" - {err}")
        else:
             CONSOLE.print("\n[bold green]✅ Artigo validado sem erros![/bold green]")
        
        CONSOLE.print("\n[bold white]Ações:[/bold white] [cyan][E]dit[/cyan] Abrir no VS Code | [cyan][I]gnore[/cyan] Ignorar Erro | [cyan][B]ack[/cyan] Voltar")
        
        while True:
            cmd = Prompt.ask("Opção").lower()
            if cmd == 'b': break
            if cmd == 'e':
                self.open_vscode(article_id)
            if cmd == 'i':
                self.add_ignore_rule()
                break # Reload analysis

    def open_vscode(self, article_id):
        # Scan JSON file for line number of this article (Basic grep)
        try:
            # Simple grep to find line number of '"numero": "X"' or similar
            # Since we have the ID, we look for it.
            # Warning: ID might be formatted differently, but usually safe.
            target = f'"{article_id}"' # Try to find ID
            
            line_num = 0
            with open(self.json_path, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f):
                    if target in line:
                        line_num = i + 1
                        break
            
            if line_num > 0:
                # Code path: code -g file:line
                subprocess.call(['code', '-g', f"{self.json_path}:{line_num}"], shell=True)
                CONSOLE.print(f"[green]Abrindo VS Code na linha {line_num}...[/green]")
            else:
                CONSOLE.print("[yellow]Não achei a linha exata, abrindo arquivo...[/yellow]")
                subprocess.call(['code', self.json_path], shell=True)
                
        except Exception as e:
            CONSOLE.print(f"[red]Erro ao abrir editor: {e}[/red]")

    def add_ignore_rule(self):
        text = Prompt.ask("Texto do erro para ignorar (substr ou regex)")
        if not text: return
        
        is_regex = Confirm.ask("É Regex?")
        rule = {
            'type': 'regex' if is_regex else 'exact',
            'pattern': text,
            'created_at': datetime.now().isoformat()
        }
        self.config['ignore_rules'].append(rule)
        self.save_config()
        self.analyze() # Re-analyze
        CONSOLE.print("[green]Regra adicionada![/green]")

    def manage_rules(self):
        CONSOLE.clear()
        table = Table(title="Regras de Ignorar (Ignore Rules)", box=box.ROUNDED)
        table.add_column("ID", style="cyan", width=4)
        table.add_column("Tipo", style="magenta", width=8)
        table.add_column("Padrão", style="white")
        table.add_column("Data", style="dim")
        
        for i, rule in enumerate(self.config['ignore_rules']):
            table.add_row(str(i+1), rule['type'], rule['pattern'], rule['created_at'][:10])
            
        CONSOLE.print(table)
        CONSOLE.print("\n[bold white]Ações:[/bold white] [cyan][D]elete[/cyan] ID | [cyan][B]ack[/cyan] Voltar")
        
        while True:
            cmd = Prompt.ask("Opção").lower()
            if cmd == 'b': break
            if cmd.startswith('d '):
                try:
                    idx = int(cmd.split()[1]) - 1
                    if 0 <= idx < len(self.config['ignore_rules']):
                        removed = self.config['ignore_rules'].pop(idx)
                        self.save_config()
                        self.analyze()
                        CONSOLE.print(f"[green]Regra '{removed['pattern']}' removida![/green]")
                        break
                except:
                    CONSOLE.print("[red]ID inválido[/red]")

    def export_html(self):
        filename = f"validator_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        CONSOLE.print(f"[yellow]Gerando exportação HTML detalhada ({filename})...[/yellow]")
        
        # Create a separate console just for capturing the export
        export_console = Console(record=True, width=120)
        
        # 1. Title & Stats
        export_console.print(Panel(f"[bold]Relatório de Validação[/bold]\nScore: {self.get_sparkline()}", style="cyan"))
        
        stats_panel = Panel(
            f"[bold green]✅ Perfeitos: {self.stats['perfect']}   [bold yellow]⚠️  Avisos: {self.stats['warnings']}   [bold red]❌ Críticos: {self.stats['critical']}   [bold grey]🙈 Ignorados: {self.stats['ignored']}",
            title="Status Geral", border_style="blue"
        )
        export_console.print(stats_panel)
        export_console.print(Markdown("---"))

        # 2. Clusters Detail
        for i, cluster in enumerate(self.clusters):
            c_type = cluster['type']
            count = cluster['count']
            articles = cluster['articles']
            
            # Header del Cluster
            export_console.print(Markdown(f"## {i+1}. {c_type} ({count} ocorrências)"))
            export_console.print(f"Artigos afetados: {', '.join(map(str, articles))}", style="dim")
            
            # Show Detailed Diffs (Limit to first 5 to avoid huge file, unless it's critical content divergence)
            limit = 5
            if "Divergência de Conteúdo" in c_type or "Faltando" in c_type or "Sobrando" in c_type:
                limit = 10 # Show more for critical errors
            
            for art_id in articles[:limit]:
                export_console.print(f"\n[bold]🔹 Artigo {art_id}[/bold]")
                try:
                    grid = self.build_diff_grid(art_id)
                    export_console.print(grid)
                except Exception as e:
                    export_console.print(f"[red]Erro ao renderizar diff: {e}[/red]")
            
            if len(articles) > limit:
                export_console.print(f"\n[italic]... e mais {len(articles)-limit} artigos (ocultos por brevidade)[/italic]")
                
            export_console.print(Markdown("---"))
        
        # Save
        export_console.save_html(filename, theme=MONOKAI)
        CONSOLE.print(f"[bold green]Exportado com sucesso: {filename}[/bold green]")
        
        if os.name == 'nt':
             try:
                 os.startfile(filename)
             except: pass
        Prompt.ask("Pressione Enter para continuar")

    def render_structure_view(self):
        CONSOLE.clear()
        CONSOLE.print("[bold cyan]🕵️  AUDITORIA ESTRUTURAL PROFUNDA (PENTE-FINO)[/bold cyan]", justify="center")
        
        struct_val = validator.StructuralValidator(self.json_data_raw, "") 
        
        table = Table(title="Divergências de Contagem (Incisos/Alíneas/Itens/Parágrafos)", box=box.SIMPLE)
        table.add_column("Artigo", style="cyan")
        table.add_column("Erro Estrutural", style="red")
        
        issues_count = 0
        
        with CONSOLE.status("[bold yellow]Auditando estrutura...[/bold yellow]"):
            for art_id in self.common_keys:
                # Get block text
                text_block = self.raw_arts[art_id]
                
                # Check Counts
                issues = struct_val.validate_counts(art_id, text_block)
                
                if issues:
                    for i in issues:
                        table.add_row(art_id, i)
                        issues_count += 1
                        
        if issues_count == 0:
             CONSOLE.print("\n[bold green]✅ Nenhuma divergência estrutural encontrada! Hierarquia interna perfeita.[/bold green]")
        else:
             CONSOLE.print(table)
             CONSOLE.print(f"\n[bold red]Total de Divergências: {issues_count}[/bold red]")
             
        Prompt.ask("Pressione Enter para voltar")

    def render_matrix_view(self):
        
        # Helper for sort
        def natural_keys(text):
            clean = re.sub(r'[^a-zA-Z0-9]', '', text)
            parts = re.split(r'(\d+)', clean)
            parts = [p for p in parts if p]
            result = []
            for p in parts:
                if p.isdigit(): result.append(int(p))
                else: result.append(p)
            match = re.match(r'^(\d+)', text)
            if match:
                num = int(match.group(1))
                suffix = text[len(str(num)):]
                clean_suffix = re.sub(r'[^a-zA-Z0-9]', '', suffix).upper()
                if 'º' in suffix or '°' in suffix:
                    return (num, "") 
                return (num, clean_suffix)
            return (0, text)

        active_filter = "ALL" # ALL, ERROR, MISSING, GAP
        
        while True:
            CONSOLE.clear()
            CONSOLE.print("[bold cyan]🗺️  MATRIX VIEW (MAPA DE CALOR)[/bold cyan]", justify="center")
            
            # 1. Base Keys
            base_keys = set(self.json_arts.keys()) | set(self.raw_arts.keys())
            
            # 2. Gap Detection
            max_art = 0
            existing_ints = set()
            for k in base_keys:
                m = re.match(r'^(\d+)', k)
                if m:
                    val = int(m.group(1))
                    if val > max_art: max_art = val
                    existing_ints.add(val)
            
            gaps = []
            if max_art > 0:
                for i in range(1, max_art + 1):
                    if i not in existing_ints:
                        gaps.append(str(i))
            
            # 3. Compile Master List with Status
            master_list = []
            
            # Add existing
            for k in base_keys:
                status = "UNKNOWN"
                if k not in self.json_arts: status = "GHOST" # Missing JSON
                elif k not in self.raw_arts: status = "REVOKED" # Missing Raw
                elif k in self.errors:
                     if any("❌" in i for i in self.errors[k]): status = "ERROR"
                     else: status = "WARNING"
                else: status = "PERFECT"
                master_list.append({'id': k, 'status': status})
                
            # Add gaps
            for g in gaps:
                master_list.append({'id': g, 'status': 'GAP'})
                
            # Sort
            master_list.sort(key=lambda x: natural_keys(x['id']))
            
            # 4. Stats Calculation
            counts = Counter([x['status'] for x in master_list])
            
            # Render Stats Header
            stats_text = (
                f"[green]✅ {counts['PERFECT']}[/green] | "
                f"[yellow]⚠️  {counts['WARNING']}[/yellow] | "
                f"[bold red]❌  {counts['ERROR']}[/bold red] | "
                f"[blue]👻 {counts['GHOST']}[/blue] | "
                f"[dim]🚫 {counts['REVOKED']}[/dim] | "
                f"[dim white]❓ {counts['GAP']}[/dim white]"
            )
            CONSOLE.print(Panel(stats_text, title="Resumo da Matriz", style="cyan"))
            CONSOLE.print(f"Filtro Atual: [bold underline]{active_filter}[/bold underline]\n")

            # 5. Apply Filter
            filtered_list = []
            for item in master_list:
                s = item['status']
                if active_filter == "ALL": filtered_list.append(item)
                elif active_filter == "ERROR" and (s == "ERROR" or s == "WARNING"): filtered_list.append(item)
                elif active_filter == "MISSING" and (s == "GHOST" or s == "REVOKED" or s == "GAP"): filtered_list.append(item)
            
            # 6. Render Grid
            cols = 8 # Less columns for ID [Status]
            grid = Table(box=None, show_header=False, padding=(0,1))
            for _ in range(cols): grid.add_column(justify="center")
            
            current_row = []
            
            status_icons = {
                'PERFECT': '✅',
                'WARNING': '⚠️ ',
                'ERROR': '❌',
                'GHOST': '👻',
                'REVOKED': '🚫',
                'GAP': '❓'
            }
            
            style_map = {
                'PERFECT': 'green',
                'WARNING': 'yellow',
                'ERROR': 'bold red',
                'GHOST': 'blue dim',
                'REVOKED': 'white dim',
                'GAP': 'dim'
            }
            
            for item in filtered_list:
                art_id = item['id']
                status = item['status']
                icon = status_icons.get(status, '?')
                style = style_map.get(status, 'white')
                
                label = f"{art_id} [{icon}]"
                current_row.append(Text(label, style=style, justify="center"))
                
                if len(current_row) == cols:
                    grid.add_row(*current_row)
                    current_row = []
                    
            if current_row:
                 while len(current_row) < cols: current_row.append(Text(""))
                 grid.add_row(*current_row)
                 
            CONSOLE.print(grid)
            
            # Actions
            CONSOLE.print("\n[bold white]Ações:[/bold white] Digite Artigo | [cyan][F]iltro[/cyan] | [cyan][C]ompare Mode[/cyan] | [cyan][B]ack[/cyan] Voltar")
            cmd = Prompt.ask("Comando").lower()
            
            if cmd == 'b': break
            elif cmd == 'c':
                self.render_structured_list_view()
            elif cmd == 'f':
                # Cycle filters
                if active_filter == "ALL": active_filter = "ERROR"
                elif active_filter == "ERROR": active_filter = "MISSING"
                else: active_filter = "ALL"
            elif cmd:
                 # Try to find article in master list (even if hidden)
                 target = validator.get_canonical_id(cmd)
                 # Check if it exists in ALL keys (including gaps? Gaps don't have diffs)
                 found = next((x for x in master_list if x['id'] == target), None)
                 
                 if found:
                     if found['status'] == 'GAP':
                         CONSOLE.print(f"[yellow]Artigo {target} é um GAP (não existe em lugar nenhum).[/yellow]")
                         Prompt.ask("Enter")
                     else:
                         self.render_diff_view(target)
                 else:
                     CONSOLE.print(f"[red]Artigo {target} não encontrado.[/red]")
                     Prompt.ask("Enter")

    def render_structured_list_view(self):
        """
        Renders articles in a list grouped by Hierarchy (Titles/Chapters).
        Shows detailed counts (Inc/Par) comparison.
        """
        
        # Helper for sort
        def natural_keys(text):
            clean = re.sub(r'[^a-zA-Z0-9]', '', text)
            parts = re.split(r'(\d+)', clean)
            parts = [p for p in parts if p]
            result = []
            for p in parts:
                if p.isdigit(): result.append(int(p))
                else: result.append(p)
            match = re.match(r'^(\d+)', text)
            if match:
                num = int(match.group(1))
                clean_suffix = re.sub(r'[^a-zA-Z0-9]', '', text[len(str(num)):]).upper()
                if 'º' in text or '°' in text: return (num, "") 
                return (num, clean_suffix)
            return (0, text)
            
        validator_inst = validator.StructuralValidator(self.json_data_raw, "")
        
        while True:
            CONSOLE.clear()
            CONSOLE.print("[bold cyan]🔥 STRUCTURED COMPARE LIST (RAIO-X)[/bold cyan]", justify="center")
            
            all_keys = sorted(
                list(set(self.json_arts.keys()) | set(self.raw_arts.keys())),
                key=natural_keys
            )
            
            # Context Tracker
            last_context_str = ""
            
            # Use Pager logic? List might be huge.
            # We'll stick to printing all for now, relying on terminal scroll or user filtering?
            # User wants it simple first.
            
            table = Table(box=box.SIMPLE, show_header=True, header_style="bold magenta")
            table.add_column("Artigo", width=10)
            table.add_column("Status", width=6, justify="center")
            table.add_column("Estrutura (JSON vs RAW)", ratio=1)
            
            # Pre-calculate to handle filtering if needed. For now, show ALL.
            
            current_group_rows = []
            
            for art_id in all_keys:
                # 1. Check Hierarchy Context
                ctx = self.article_contexts.get(art_id, [])
                ctx_str = " > ".join(ctx) if ctx else "Sem Hierarquia (Raiz)"
                
                if ctx_str != last_context_str:
                    # Flush table if needed? No, rich table handles rows.
                    # Print a Section Header Row
                    friendly_ctx = f"[bold cyan]=== {ctx_str} ===[/bold cyan]" if ctx else "[dim]=== Raiz ===[/dim]"
                    table.add_row(friendly_ctx, "", "", end_section=True)
                    last_context_str = ctx_str
                
                # 2. Status
                status = "❓"
                if art_id not in self.json_arts: status = "👻"
                elif art_id not in self.raw_arts: status = "🚫"
                elif art_id in self.errors: 
                    if any("❌" in e for e in self.errors[art_id]): status = "❌"
                    else: status = "⚠️ "
                else: status = "✅"
                
                # 3. Counts
                counts_str = ""
                if art_id in self.raw_arts and art_id in self.json_arts:
                    # Perform check
                    text_block = self.raw_arts[art_id]
                    real = validator_inst.count_items_in_text(text_block)
                    
                    # Need JSON object
                    # Find in self.json_data_raw['artigos']
                    # Optimize: pre-map
                    # Do it on the fly, slow but fine for rendering text
                    art_obj = next((a for a in self.json_data_raw.get('artigos',[]) if validator.get_canonical_id(a.get('numero','')) == art_id), {})
                    json_c = validator_inst.recursive_json_count(art_obj)
                    
                    # Format: P:2/2 I:10/10
                    # Red if mismatch
                    
                    def fmt(lbl, j_val, r_val):
                        s = f"{lbl}:{j_val}/{r_val}"
                        if j_val != r_val: return f"[bold red]{s}[/bold red]"
                        return f"[dim]{s}[/dim]"
                        
                    p_str = fmt("P", len(art_obj.get('paragrafos', [])), real['paragrafos'])
                    i_str = fmt("I", json_c['incisos'], real['incisos'])
                    
                    counts_str = f"{p_str}  {i_str}"
                elif status == "👻":
                    counts_str = "[blue]Missing in JSON[/blue]"
                elif status == "🚫":
                    counts_str = "[dim]Missing in RAW[/dim]"
                
                table.add_row(art_id, status, counts_str)
                
            CONSOLE.print(table)
            
            CONSOLE.print("\n[bold white]Ações:[/bold white] Digite Artigo para Diff | [cyan][B]ack[/cyan] Voltar")
            cmd = Prompt.ask("Comando").lower()
            
            if cmd == 'b': break
            elif cmd and validator.get_canonical_id(cmd) in all_keys:
                 self.render_diff_view(validator.get_canonical_id(cmd))

    def run(self):
        self.load_data()
        
        while True:
            self.render_summary()
            cmd = Prompt.ask("Comando").lower()
            
            if cmd == 'q':
                break
            elif cmd == 'h':
                self.export_html()
            elif cmd == 'r':
                self.manage_rules()
            elif cmd == 's':
                self.render_structure_view()
            elif cmd == 'm':
                self.render_matrix_view()
            elif cmd.startswith('a '):
                # Diff specific article
                art_id = validator.get_canonical_id(cmd.split()[1]) # Normalize inputs
                self.render_diff_view(art_id)
            elif cmd.isdigit():
                # Cluster Drill-down
                idx = int(cmd) - 1
                if 0 <= idx < len(self.clusters):
                    cluster = self.clusters[idx]
                    # Show list of articles in this cluster
                    CONSOLE.print(f"\n[bold cyan]Cluster: {cluster['type']}[/bold cyan]")
                    CONSOLE.print(f"Artigos: {', '.join(map(str, cluster['articles']))}")
                    
                    sub_cmd = Prompt.ask("Digite o ID de um artigo para ver diff ou [B]ack").lower()
                    if sub_cmd != 'b' and sub_cmd:
                         self.render_diff_view(validator.get_canonical_id(sub_cmd))
            elif re.match(r'^\d+$', cmd): # Allows typing just '50' if it conflicts with cluster index? No, priority to Cluster index
                pass


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python validator_dashboard.py <json_path> <raw_path>")
    else:
        app = ValidatorDashboard(sys.argv[1], sys.argv[2])
        app.run()
