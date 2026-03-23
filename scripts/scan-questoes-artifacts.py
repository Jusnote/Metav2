"""
Scanner de artefatos em questões de concurso.
SOMENTE LEITURA — não altera nenhum arquivo.

Varre todos os JSON de questões e detecta qualquer padrão
que não seja HTML/texto puro (LaTeX, RTF, Markdown, PDF artifacts, etc.)

Gera relatório HTML com contagem e exemplos de cada padrão encontrado.
"""

import json
import re
import os
import sys
import html
from collections import defaultdict
from pathlib import Path
from datetime import datetime

# ─── Configuração ───
BASE_DIR = r"C:\Users\Home\Desktop\tec_scraper\filtros"
REPORT_PATH = os.path.join(os.path.dirname(__file__), "relatorio_artefatos_questoes.html")

# ─── Padrões a detectar ───
# Cada padrão: (nome, regex compilado, descrição)
PATTERNS = [
    # === LaTeX ===
    ("latex_bullet", re.compile(r'\\bullet\b'), r"\bullet"),
    ("latex_item", re.compile(r'\\item\b'), r"\item"),
    ("latex_textbf", re.compile(r'\\textbf\s*\{'), r"\textbf{...}"),
    ("latex_textit", re.compile(r'\\textit\s*\{'), r"\textit{...}"),
    ("latex_textsc", re.compile(r'\\textsc\s*\{'), r"\textsc{...}"),
    ("latex_texttt", re.compile(r'\\texttt\s*\{'), r"\texttt{...}"),
    ("latex_underline", re.compile(r'\\underline\s*\{'), r"\underline{...}"),
    ("latex_emph", re.compile(r'\\emph\s*\{'), r"\emph{...}"),
    ("latex_cite", re.compile(r'\\cite\s*\{'), r"\cite{...}"),
    ("latex_ref", re.compile(r'\\ref\s*\{'), r"\ref{...}"),
    ("latex_footnote", re.compile(r'\\footnote\s*\{'), r"\footnote{...}"),
    ("latex_section", re.compile(r'\\(?:sub)*section\s*\{'), r"\section{...}"),
    ("latex_begin_end", re.compile(r'\\(?:begin|end)\s*\{'), r"\begin{...} / \end{...}"),
    ("latex_par", re.compile(r'\\par\b'), r"\par"),
    ("latex_newline", re.compile(r'\\newline\b'), r"\newline"),
    ("latex_noindent", re.compile(r'\\noindent\b'), r"\noindent"),
    ("latex_hspace_vspace", re.compile(r'\\[hv]space\s*\{'), r"\hspace / \vspace"),
    ("latex_linebreak", re.compile(r'\\\\(?![a-zA-Z])'), r"\\\\ (line break)"),
    ("latex_math_inline", re.compile(r'(?<![\\])\$[^$]+\$'), r"$...$ (inline math)"),
    ("latex_math_display", re.compile(r'\$\$[^$]+\$\$'), r"$$...$$ (display math)"),
    ("latex_frac", re.compile(r'\\frac\s*\{'), r"\frac{...}"),
    ("latex_sqrt", re.compile(r'\\sqrt\s*[\{\[]'), r"\sqrt{...}"),
    ("latex_sum_int", re.compile(r'\\(?:sum|int|prod|lim)\b'), r"\sum / \int / \prod / \lim"),
    ("latex_greek", re.compile(r'\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi|rho|tau|eta|xi|zeta|nu|kappa|iota|chi|upsilon)\b'), r"Greek letters (\alpha, etc.)"),
    ("latex_misc_cmd", re.compile(r'\\(?:centering|raggedright|raggedleft|small|large|tiny|huge|normalsize|footnotesize|scriptsize|bigskip|medskip|smallskip|quad|qquad|hfill|vfill|clearpage|pagebreak|newpage|maketitle|tableofcontents)\b'), r"Misc LaTeX commands"),
    ("latex_environment", re.compile(r'\\begin\{(?:itemize|enumerate|description|quote|quotation|verse|center|flushleft|flushright|figure|table|tabular|array|equation|align|gather|multline|cases|matrix|pmatrix|bmatrix|tikzpicture|minipage|abstract)\}'), r"LaTeX environments"),

    # === RTF ===
    ("rtf_par", re.compile(r'\\pard?\b'), r"\par / \pard (RTF)"),
    ("rtf_bold_italic", re.compile(r'\\[bi]0?\b'), r"\b / \i (RTF bold/italic)"),
    ("rtf_font_size", re.compile(r'\\fs\d+'), r"\fs24 (RTF font size)"),
    ("rtf_font_family", re.compile(r'\\f\d+\b'), r"\f0 (RTF font)"),
    ("rtf_color", re.compile(r'\\cf\d+'), r"\cf1 (RTF color)"),
    ("rtf_header", re.compile(r'\{\\rtf'), r"RTF header"),
    ("rtf_unicode", re.compile(r"\\u\d{3,5}"), r"\u1234 (RTF unicode)"),

    # === Markdown ===
    ("md_bold", re.compile(r'(?<!\*)\*\*[^*]+\*\*(?!\*)'), r"**bold** (Markdown)"),
    ("md_italic", re.compile(r'(?<![*_])(?:\*[^*\s][^*]*\*|_[^_\s][^_]*_)(?![*_])'), r"*italic* (Markdown)"),
    ("md_heading", re.compile(r'^#{1,6}\s+', re.MULTILINE), r"# Heading (Markdown)"),
    ("md_list", re.compile(r'^\s*[-*+]\s+', re.MULTILINE), r"- list (Markdown)"),
    ("md_numbered_list", re.compile(r'^\s*\d+\.\s+', re.MULTILINE), r"1. numbered list (Markdown)"),
    ("md_link", re.compile(r'\[([^\]]+)\]\(([^)]+)\)'), r"[text](url) (Markdown)"),
    ("md_code_block", re.compile(r'```'), r"``` code block (Markdown)"),
    ("md_inline_code", re.compile(r'(?<!`)`[^`]+`(?!`)'), r"`code` (Markdown)"),

    # === PDF extraction artifacts ===
    ("pdf_hyphenation", re.compile(r'[a-záàâãéèêíïóôõúüç]-\s*\n\s*[a-záàâãéèêíïóôõúüç]', re.IGNORECASE), r"pala-\nvra (PDF hyphenation)"),
    ("pdf_double_space", re.compile(r'[a-zA-Z]  +[a-zA-Z]'), r"double  spaces (PDF)"),
    ("pdf_page_number", re.compile(r'\n\s*\d{1,3}\s*\n'), r"Isolated page numbers"),
    ("pdf_formfeed", re.compile(r'\f'), r"Form feed (\\f)"),
    ("pdf_ligature", re.compile(r'[ﬀﬁﬂﬃﬄ]'), r"Ligatures (fi, fl, etc.)"),

    # === HTML artifacts ===
    ("html_double_entity", re.compile(r'&amp;(?:amp|lt|gt|quot|nbsp|apos);'), r"&amp;amp; (double-escaped entity)"),
    ("html_unclosed_tag", re.compile(r'<(p|div|span)\b[^>]*>[^<]{200,}$', re.MULTILINE), r"Very long unclosed HTML tags"),
    ("html_font_tag", re.compile(r'<font\b'), r"<font> (legacy HTML)"),
    ("html_center_tag", re.compile(r'<center\b'), r"<center> (legacy HTML)"),
    ("html_style_mso", re.compile(r'mso-[a-z-]+\s*:', re.IGNORECASE), r"mso-* styles (MS Office)"),
    ("html_class_mso", re.compile(r'class\s*=\s*["\']Mso\w+', re.IGNORECASE), r"class=MsoNormal (MS Office)"),
    ("html_conditional_comment", re.compile(r'<!--\[if\s'), r"<!--[if]> (IE conditional)"),
    ("html_xml_namespace", re.compile(r'<o:p>|<w:'), r"<o:p> / <w: (MS Word XML)"),

    # === Unicode / encoding issues ===
    ("unicode_replacement", re.compile(r'\ufffd'), r"Replacement char (U+FFFD)"),
    ("unicode_bom", re.compile(r'\ufeff'), r"BOM (U+FEFF)"),
    ("unicode_control", re.compile(r'[\x00-\x08\x0b\x0e-\x1f\x7f]'), r"Control characters"),
    ("unicode_private_use", re.compile(r'[\ue000-\uf8ff]'), r"Private use area chars"),
    ("encoding_mojibake", re.compile(r'[Ã¡Ã©Ã­Ã³ÃºÃ§Ã£Ãµ]'), r"Mojibake (encoding issue)"),

    # === Escaped characters in plain text ===
    ("escaped_newline_literal", re.compile(r'(?<!\\)\\n(?![a-zA-Z])'), r"\\n literal (not newline)"),
    ("escaped_tab_literal", re.compile(r'(?<!\\)\\t(?![a-zA-Z])'), r"\\t literal (not tab)"),
    ("escaped_quote", re.compile(r"\\['\"]"), r"\\' or \\\" escaped quotes"),

    # === Other ===
    ("null_text", re.compile(r'\bnull\b', re.IGNORECASE), r"null as text"),
    ("undefined_text", re.compile(r'\bundefined\b', re.IGNORECASE), r"undefined as text"),
    ("nan_text", re.compile(r'\bNaN\b'), r"NaN as text"),
    ("empty_tags", re.compile(r'<(p|div|span|li|td|h[1-6])\b[^>]*>\s*</\1>'), r"Empty HTML tags"),
    ("excessive_nbsp", re.compile(r'(?:&nbsp;\s*){4,}'), r"4+ consecutive &nbsp;"),
    ("tab_char", re.compile(r'\t{2,}'), r"Multiple tab characters"),
]

# ─── Stats ───
stats = {
    "total_files": 0,
    "total_questions": 0,
    "files_with_errors": 0,
    "patterns": defaultdict(lambda: {"count": 0, "questions": 0, "examples": []}),
}

MAX_EXAMPLES = 5  # Examples per pattern to keep in report

def extract_text_fields(questao: dict) -> list[tuple[str, str]]:
    """Extract all text fields from a question that should be scanned."""
    fields = []

    # Enunciado
    if questao.get("enunciado"):
        fields.append(("enunciado", str(questao["enunciado"])))

    # Alternativas (list of strings)
    alts = questao.get("alternativas", [])
    if isinstance(alts, list):
        for i, alt in enumerate(alts):
            if alt:
                fields.append((f"alternativa[{i}]", str(alt)))

    # Gabarito comentado / comentário (if exists)
    for key in ("gabaritoComentado", "comentario", "comentarioTexto", "resolucao", "textoComentario"):
        if questao.get(key):
            fields.append((key, str(questao[key])))

    return fields


def scan_text(text: str, questao_id, field_name: str, materia: str):
    """Scan a single text field for all patterns."""
    for name, pattern, desc in PATTERNS:
        matches = pattern.findall(text)
        if matches:
            stats["patterns"][name]["count"] += len(matches)
            stats["patterns"][name]["questions"] += 1
            stats["patterns"][name]["desc"] = desc

            if len(stats["patterns"][name]["examples"]) < MAX_EXAMPLES:
                # Get context around first match
                m = pattern.search(text)
                if m:
                    start = max(0, m.start() - 60)
                    end = min(len(text), m.end() + 60)
                    context = text[start:end].replace('\n', '\\n').replace('\r', '\\r')
                    stats["patterns"][name]["examples"].append({
                        "questao_id": questao_id,
                        "field": field_name,
                        "materia": materia,
                        "context": context,
                        "match": m.group()[:80],
                    })


def process_question(questao: dict, materia: str):
    """Process a single question."""
    stats["total_questions"] += 1
    qid = questao.get("idQuestao", questao.get("id", "?"))

    for field_name, text in extract_text_fields(questao):
        scan_text(text, qid, field_name, materia)


def process_json_file(filepath: str, materia: str):
    """Process a JSON file (array or single question)."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            data = json.load(f)

        stats["total_files"] += 1

        if isinstance(data, list):
            for q in data:
                if isinstance(q, dict) and ("enunciado" in q or "alternativas" in q):
                    process_question(q, materia)
        elif isinstance(data, dict) and ("enunciado" in data or "alternativas" in data):
            process_question(data, materia)
    except (json.JSONDecodeError, UnicodeDecodeError, PermissionError) as e:
        stats["files_with_errors"] += 1


def scan_all():
    """Walk through all filtros directories and scan questions."""
    base = Path(BASE_DIR)

    if not base.exists():
        print(f"ERRO: Diretório não encontrado: {BASE_DIR}")
        sys.exit(1)

    # Collect all JSON files to process
    json_files = []

    for materia_dir in sorted(base.iterdir()):
        if not materia_dir.is_dir():
            continue

        materia = materia_dir.name

        # Look for questoes_v3.json files (bulk)
        for json_file in materia_dir.rglob("questoes_v3.json"):
            json_files.append((str(json_file), materia))

        # Look for individual question files in questoes_completas/
        for json_file in materia_dir.rglob("questoes_completas/*.json"):
            json_files.append((str(json_file), materia))

    total = len(json_files)
    print(f"Encontrados {total} arquivos JSON para escanear...")
    print(f"Diretório: {BASE_DIR}")
    print()

    for i, (filepath, materia) in enumerate(json_files):
        if i % 500 == 0:
            print(f"  Progresso: {i}/{total} ({i*100//max(total,1)}%) — {stats['total_questions']} questões escaneadas", flush=True)
        process_json_file(filepath, materia)

    print(f"  Progresso: {total}/{total} (100%) — {stats['total_questions']} questões escaneadas")
    print()


def generate_report():
    """Generate HTML report."""
    # Sort patterns by count (most frequent first)
    sorted_patterns = sorted(
        stats["patterns"].items(),
        key=lambda x: x[1]["count"],
        reverse=True
    )

    found = [(name, data) for name, data in sorted_patterns if data["count"] > 0]
    not_found = [(name, desc) for name, _, desc in PATTERNS if name not in stats["patterns"] or stats["patterns"][name]["count"] == 0]

    rows_html = ""
    for name, data in found:
        examples_html = ""
        for ex in data["examples"]:
            ctx = html.escape(ex["context"])
            match_esc = html.escape(ex["match"])
            examples_html += f"""
            <div class="example">
              <span class="meta">ID {ex['questao_id']} | {html.escape(ex['field'])} | {html.escape(ex['materia'])}</span>
              <code>...{ctx}...</code>
              <span class="match">Match: <b>{match_esc}</b></span>
            </div>"""

        severity = "critical" if data["count"] > 1000 else "warning" if data["count"] > 100 else "info"

        rows_html += f"""
        <tr class="{severity}">
          <td><code>{html.escape(name)}</code></td>
          <td>{html.escape(data.get('desc', ''))}</td>
          <td class="num">{data['count']:,}</td>
          <td class="num">{data['questions']:,}</td>
          <td>{examples_html}</td>
        </tr>"""

    report_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório de Artefatos — Questões de Concurso</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e4e4e7; padding: 24px; }}
  h1 {{ font-size: 22px; margin-bottom: 8px; color: #f4f4f5; }}
  .subtitle {{ color: #71717a; font-size: 14px; margin-bottom: 24px; }}
  .stats {{ display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }}
  .stat {{ background: #1c1c24; border: 1px solid #27272a; border-radius: 8px; padding: 16px 20px; min-width: 180px; }}
  .stat .label {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin-bottom: 4px; }}
  .stat .value {{ font-size: 24px; font-weight: 700; color: #f4f4f5; }}
  .stat .value.green {{ color: #4ade80; }}
  .stat .value.red {{ color: #f87171; }}
  .stat .value.yellow {{ color: #fbbf24; }}
  table {{ width: 100%; border-collapse: collapse; background: #1c1c24; border-radius: 8px; overflow: hidden; }}
  th {{ background: #27272a; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; }}
  td {{ padding: 10px 12px; border-top: 1px solid #27272a; vertical-align: top; font-size: 13px; }}
  td.num {{ text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }}
  tr.critical td {{ border-left: 3px solid #f87171; }}
  tr.warning td {{ border-left: 3px solid #fbbf24; }}
  tr.info td {{ border-left: 3px solid #60a5fa; }}
  .example {{ background: #0f1117; border-radius: 4px; padding: 8px; margin: 4px 0; font-size: 11px; }}
  .example .meta {{ display: block; color: #71717a; margin-bottom: 2px; }}
  .example code {{ display: block; white-space: pre-wrap; word-break: break-all; color: #a1a1aa; font-size: 11px; }}
  .example .match {{ display: block; margin-top: 2px; color: #fbbf24; font-size: 10px; }}
  .section {{ margin-top: 32px; margin-bottom: 12px; font-size: 16px; font-weight: 600; color: #f4f4f5; }}
  .clean {{ color: #4ade80; font-size: 13px; padding: 4px 0; }}
  .timestamp {{ color: #52525b; font-size: 11px; margin-top: 24px; }}
</style>
</head>
<body>
  <h1>Relatório de Artefatos — Questões de Concurso</h1>
  <p class="subtitle">Scan somente-leitura de todos os arquivos JSON em {html.escape(BASE_DIR)}</p>

  <div class="stats">
    <div class="stat">
      <div class="label">Arquivos JSON</div>
      <div class="value">{stats['total_files']:,}</div>
    </div>
    <div class="stat">
      <div class="label">Questões escaneadas</div>
      <div class="value">{stats['total_questions']:,}</div>
    </div>
    <div class="stat">
      <div class="label">Padrões detectados</div>
      <div class="value {'red' if len(found) > 10 else 'yellow' if len(found) > 0 else 'green'}">{len(found)}</div>
    </div>
    <div class="stat">
      <div class="label">Ocorrências totais</div>
      <div class="value {'red' if sum(d['count'] for _,d in found) > 1000 else 'yellow'}">{sum(d['count'] for _,d in found):,}</div>
    </div>
    <div class="stat">
      <div class="label">Erros de leitura</div>
      <div class="value {'red' if stats['files_with_errors'] > 0 else 'green'}">{stats['files_with_errors']:,}</div>
    </div>
  </div>

  <div class="section">Artefatos Encontrados</div>
  {'<p class="clean">Nenhum artefato encontrado!</p>' if not found else ''}

  {f'''<table>
    <thead>
      <tr>
        <th>Padrão</th>
        <th>Descrição</th>
        <th>Ocorrências</th>
        <th>Questões afetadas</th>
        <th>Exemplos (até {MAX_EXAMPLES})</th>
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>''' if found else ''}

  <div class="section">Padrões Limpos (não encontrados)</div>
  <p style="color: #71717a; font-size: 12px; line-height: 1.8;">
    {' &middot; '.join(html.escape(desc) for _, desc in not_found) if not_found else 'Todos os padrões foram encontrados.'}
  </p>

  <p class="timestamp">Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} — somente leitura, nenhum arquivo foi modificado.</p>
</body>
</html>"""

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report_html)

    print(f"Relatório salvo em: {REPORT_PATH}")


if __name__ == "__main__":
    print("=" * 60)
    print("  SCANNER DE ARTEFATOS — QUESTÕES DE CONCURSO")
    print("  Modo: SOMENTE LEITURA (nenhum arquivo será alterado)")
    print("=" * 60)
    print()

    scan_all()

    print(f"Resumo rápido:")
    print(f"  Arquivos: {stats['total_files']:,}")
    print(f"  Questões: {stats['total_questions']:,}")
    print(f"  Padrões encontrados: {sum(1 for v in stats['patterns'].values() if v['count'] > 0)}")
    print(f"  Ocorrências totais:  {sum(v['count'] for v in stats['patterns'].values()):,}")
    print()

    generate_report()
    print("Concluído!")
