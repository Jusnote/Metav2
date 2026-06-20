"""Renderiza uma árvore de taxonomia num HTML legível (def + exemplos + desempate +
incidência por nó). Uso: python _tree_html.py <slug> [tree_file]"""
import html as H
import json
import sys
from collections import Counter
from pathlib import Path

SLUG = sys.argv[1] if len(sys.argv) > 1 else "portugues"
TAX = Path(r"D:\inventario-v2\_scale_probe\tax")
TREEF = TAX / (sys.argv[2] if len(sys.argv) > 2 else f"{SLUG}.tree_v2.json")
tree = json.loads(TREEF.read_text(encoding="utf-8"))

# incidência por nó (se houver cycle1) — pela ordem dos subtemas v1; aqui só conta total amostra
def esc(x): return H.escape(str(x or ""))

cards = []
ns = 0
for tema in tree["temas"]:
    subs = []
    for s in tema["subtemas"]:
        ns += 1
        d = s.get("definicao") or s.get("o_que_cai", "")
        ex = s.get("exemplos", "")
        if isinstance(ex, list):
            ex = "; ".join(str(e) for e in ex)
        de = s.get("desempate", "")
        ref = s.get("ref", "")
        subs.append(
            f'<div class="sub"><div class="sn">{esc(s.get("nome"))}'
            f'{f"<span class=ref>{esc(ref)}</span>" if ref else ""}</div>'
            f'{f"<div class=def>{esc(d)}</div>" if d else ""}'
            f'{f"<div class=ex><b>ex:</b> {esc(ex)}</div>" if ex else ""}'
            f'{f"<div class=des><b>⚖ desempate:</b> {esc(de)}</div>" if de else ""}</div>')
    cards.append(f'<section><h2>{esc(tema["nome"])}</h2>{"".join(subs)}</section>')

html = f"""<!doctype html><html lang=pt-br><head><meta charset=utf-8>
<title>Árvore — {esc(tree.get('materia', SLUG))}</title><style>
*{{box-sizing:border-box}} body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;
max-width:920px;margin:0 auto;padding:24px;background:#f4f5f7;color:#1a1a2e;line-height:1.5}}
h1{{font-size:24px}} .meta{{color:#6b7280;margin-bottom:20px}}
section{{background:#fff;border-radius:12px;padding:18px 20px;margin-bottom:18px;box-shadow:0 1px 5px #0001}}
h2{{font-size:18px;margin:0 0 12px;color:#4f46e5;border-bottom:2px solid #eef;padding-bottom:6px}}
.sub{{border-left:3px solid #c7d2fe;padding:8px 0 8px 14px;margin-bottom:14px}}
.sn{{font-weight:700;font-size:15px}} .ref{{font-weight:400;font-size:12px;color:#9ca3af;margin-left:8px}}
.def{{font-size:13px;color:#374151;margin-top:3px}}
.ex{{font-size:12px;color:#6b7280;margin-top:4px}}
.des{{font-size:12px;color:#92400e;background:#fffbeb;border-radius:6px;padding:6px 9px;margin-top:6px}}
</style></head><body>
<h1>🌳 {esc(tree.get('materia', SLUG))}</h1>
<div class=meta>{len(tree['temas'])} temas · {ns} subtemas · árvore derivada das questões reais, com regra de desempate por nó</div>
{''.join(cards)}
</body></html>"""

out = TAX / f"{SLUG}.tree.html"
out.write_text(html, encoding="utf-8")
print(f"HTML: {out}")
