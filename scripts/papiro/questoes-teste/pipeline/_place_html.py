"""HTML de revisão EM CONTEXTO (3 níveis): tema → subtema → ponto, cada folha com amostra
das questões que caíram nela + balde 'não encaixa'. Uso: python _place_html.py <slug> "<mat>" [tree]"""
import html as H
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

SLUG = sys.argv[1]
MATERIA = sys.argv[2] if len(sys.argv) > 2 else SLUG
TREEF = sys.argv[3] if len(sys.argv) > 3 else f"{SLUG}.tree_v3.json"
CACHE = Path(r"D:\inventario-v2\_scale_probe\tax")
PER = 10

tree = json.loads((CACHE / TREEF).read_text(encoding="utf-8"))
allq = json.loads((CACHE / f"{SLUG}.all.json").read_text(encoding="utf-8"))
txt_of = {qid: t for qid, t in zip(allq["ids"], allq["txt"])}
plc = json.loads((CACHE / f"{SLUG}.placement.json").read_text(encoding="utf-8"))["placement"]

# folhas na MESMA ordem do _place_all (pontos ou subtema-folha)
leaves = []
for t in tree["temas"]:
    for s in t["subtemas"]:
        pts = s.get("pontos", [])
        if pts:
            for p in pts:
                leaves.append({"id": len(leaves) + 1, "tema": t["nome"], "sub": s["nome"], "ponto": p["nome"]})
        else:
            leaves.append({"id": len(leaves) + 1, "tema": t["nome"], "sub": s["nome"], "ponto": None})

by_leaf = defaultdict(list)
naofit = []
for qid, v in plc.items():
    ns = v.get("n", [])
    (by_leaf[ns[0]].append(qid) if ns and ns[0] > 0 else naofit.append(qid))

rng = random.Random(1)
def esc(x): return H.escape(str(x or ""))
def qs_html(qids):
    return "".join(f"<li>{esc(txt_of.get(int(q), '')[:230])}</li>" for q in rng.sample(qids, min(PER, len(qids))))

# agrupa folhas por (tema, sub)
secs = []
for t in tree["temas"]:
    sub_html = []
    for s in t["subtemas"]:
        leaf_ids = [lf for lf in leaves if lf["tema"] == t["nome"] and lf["sub"] == s["nome"]]
        sub_total = sum(len(by_leaf.get(lf["id"], [])) for lf in leaf_ids)
        if any(lf["ponto"] for lf in leaf_ids):  # tem pontos
            pts_html = []
            for lf in leaf_ids:
                qids = by_leaf.get(lf["id"], [])
                pts_html.append(f'<details><summary>{esc(lf["ponto"])} <span class=c>{len(qids):,}</span></summary>'
                                f'<ol>{qs_html(qids)}</ol></details>')
            sub_html.append(f'<div class=sub><div class=sh>{esc(s["nome"])} <span class=c>· {sub_total:,}q</span></div>{"".join(pts_html)}</div>')
        else:
            qids = by_leaf.get(leaf_ids[0]["id"], []) if leaf_ids else []
            sub_html.append(f'<div class=sub><details><summary class=sh>{esc(s["nome"])} <span class=c>{len(qids):,}</span></summary><ol>{qs_html(qids)}</ol></details></div>')
    secs.append(f"<section><h2>{esc(t['nome'])}</h2>{''.join(sub_html)}</section>")

nf = "".join(f"<li>{esc(txt_of.get(int(q), '')[:230])}</li>" for q in rng.sample(naofit, min(20, len(naofit))))
total = len(plc)
npt = sum(1 for lf in leaves if lf["ponto"])
html = f"""<!doctype html><html lang=pt-br><head><meta charset=utf-8><title>Revisão — {esc(MATERIA)}</title><style>
*{{box-sizing:border-box}}body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:1000px;margin:0 auto;padding:24px;background:#f4f5f7;color:#1a1a2e;line-height:1.45}}
h1{{font-size:23px}}.meta{{color:#6b7280;margin-bottom:18px}}section{{background:#fff;border-radius:12px;padding:16px 20px;margin-bottom:14px;box-shadow:0 1px 5px #0001}}
h2{{font-size:17px;color:#4f46e5;margin:0 0 8px}}.sub{{margin:10px 0 10px 4px}}.sh{{font-weight:700;font-size:14px;color:#1f2937}}
details{{margin:4px 0 4px 12px;border-left:2px solid #e0e7ff;padding-left:10px}}summary{{cursor:pointer;font-size:13px}}
.c{{color:#9ca3af;font-weight:400;font-size:11px}}ol{{font-size:12px;color:#374151;margin:5px 0;padding-left:20px}}ol li{{margin-bottom:5px}}
.nf{{background:#fff7ed;border-left:4px solid #f59e0b}}</style></head><body>
<h1>🔍 Revisão — {esc(MATERIA)}</h1>
<div class=meta>{total:,} questões · {len(tree['temas'])} temas → {sum(len(t['subtemas']) for t in tree['temas'])} subtemas → {npt} pontos atômicos · {len(naofit):,} não-encaixa</div>
{''.join(secs)}
<section class=nf><h2>⚠️ Não encaixou ({len(naofit):,} · {100*len(naofit)/max(1,total):.1f}%)</h2><ol>{nf}</ol></section>
</body></html>"""
out = CACHE / f"{SLUG}.revisao.html"
out.write_text(html, encoding="utf-8")
print(f"HTML revisão 3-níveis: {out}")
