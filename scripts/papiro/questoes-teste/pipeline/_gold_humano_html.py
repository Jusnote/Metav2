"""Gera um HTML amigável pro gold humano (DConst): questões formatadas + menu de nós.
Puxa enunciado+alternativas separados do banco (fallback: texto concatenado). THROWAWAY."""
import html as H
import json
from pathlib import Path
from urllib.parse import urlparse, unquote
import _tax_place_test as T

C = Path(r"D:\inventario-v2\_scale_probe")
dat = json.loads((C / "dconst.dat.json").read_text(encoding="utf-8"))
ids = dat["ids"]
mapping = json.loads((C / "_gold_humano_map.json").read_text(encoding="utf-8"))
sample = json.loads((C / "_tax_place_v2.json").read_text(encoding="utf-8"))["sample"]
qid_of = {n: ids[sample[j]] for n, j in mapping.items()}


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")


qdata = {}
try:
    p = urlparse(envval("DATABASE_URL"))
    import psycopg2
    conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                            password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                            sslmode="disable", connect_timeout=30)
    cur = conn.cursor()
    cur.execute("select id, enunciado, alternativas from public.questoes where id = any(%s)",
                (list(qid_of.values()),))
    for qid, enun, alts in cur.fetchall():
        qdata[qid] = (enun, list(alts) if isinstance(alts, (list, tuple)) else [])
    cur.close(); conn.close()
    print(f"[db] puxou {len(qdata)} questões formatadas")
except Exception as e:
    print(f"[db] indisponível ({e}) — usando texto concatenado")

opts = "".join(f'<option value="{s["id"]}">{s["id"]}. {H.escape(s["tema"])} › {H.escape(s["nome"])}</option>'
               for s in T.SUB)


def selects(n):
    base = f'<select class="sel">{("<option value=\"\">—</option>" + opts)}</select>'
    return (f'<div class="pick"><label>Principal:</label> {base}'
            f'<label>+2º:</label> {base}<label>+3º:</label> {base}'
            f'<label class="nn"><input type="checkbox" class="nenhum"> nenhum nó serve</label></div>')


cards = []
for n in sorted(mapping, key=int):
    qid = qid_of[n]
    if qid in qdata:
        enun, alts = qdata[qid]
        letras = "ABCDEFGH"
        alt_html = "".join(f'<li><b>{letras[k]})</b> {H.escape(a)}</li>' for k, a in enumerate(alts))
        body = f'<p class="enun">{H.escape(enun)}</p><ul class="alts">{alt_html}</ul>'
    else:
        body = f'<p class="enun">{H.escape(T.TXT[sample[mapping[n]]])}</p>'  # fallback: texto concatenado
    cards.append(f'<div class="q" data-n="{n}"><div class="qn">Questão {n} de {len(mapping)}</div>'
                 f'{body}{selects(n)}</div>')

html = f"""<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<title>Gold Humano — Direito Constitucional</title><style>
*{{box-sizing:border-box}} body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;
max-width:880px;margin:0 auto;padding:20px;background:#f4f5f7;color:#1a1a2e;line-height:1.55}}
h1{{font-size:22px}} .info{{background:#fff;border-left:4px solid #4f46e5;padding:12px 16px;border-radius:8px;margin-bottom:8px}}
.bar{{position:sticky;top:0;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;
z-index:9;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;box-shadow:0 2px 8px #0003}}
.bar button{{background:#fff;color:#4f46e5;border:0;padding:8px 16px;border-radius:6px;font-weight:700;cursor:pointer}}
.q{{background:#fff;border-radius:10px;padding:16px 18px;margin-bottom:16px;box-shadow:0 1px 4px #0001}}
.qn{{font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:8px}}
.enun{{font-weight:600;margin:0 0 10px}} .alts{{margin:0 0 14px;padding-left:18px;color:#374151}}
.alts li{{margin-bottom:4px}} .pick{{border-top:1px dashed #d1d5db;padding-top:12px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}}
.pick label{{font-size:13px;color:#4b5563}} .sel{{padding:5px;border:1px solid #cbd5e1;border-radius:6px;max-width:300px;font-size:13px}}
.nn{{margin-left:8px}} .done{{outline:2px solid #16a34a}} #out{{width:100%;height:90px;font-family:monospace;font-size:12px;margin-top:8px}}
</style></head><body>
<h1>📋 Gold Humano — Direito Constitucional</h1>
<div class="info">Pra cada questão, escolha no menu o <b>subtema certo</b> (Principal obrigatório; +2º/+3º se cobrar mais de um assunto, ou marque <b>nenhum nó serve</b>). Marque pela sua cabeça de jurista. São {len(mapping)} questões (~15-20 min).</div>
<div class="bar"><span id="prog">0/{len(mapping)} respondidas</span><button onclick="gerar()">✅ Gerar resultado</button></div>
{''.join(cards)}
<div class="bar"><span>Terminou? Clique →</span><button onclick="gerar()">✅ Gerar resultado</button></div>
<div class="info"><b>Resultado</b> (vai baixar <code>gold_resultado.json</code> e aparecer abaixo — me mande o conteúdo ou o arquivo):
<textarea id="out" readonly></textarea></div>
<script>
function upd(){{let d=0;document.querySelectorAll('.q').forEach(q=>{{
 let ok=q.querySelector('.nenhum').checked||[...q.querySelectorAll('.sel')].some(s=>s.value);
 if(ok){{d++;q.classList.add('done')}}else{{q.classList.remove('done')}}}});
 document.getElementById('prog').textContent=d+'/{len(mapping)} respondidas';}}
document.addEventListener('change',upd);
function gerar(){{let res={{}};document.querySelectorAll('.q').forEach(q=>{{let n=q.dataset.n;
 if(q.querySelector('.nenhum').checked){{res[n]=[];return}}
 res[n]=[...q.querySelectorAll('.sel')].map(s=>s.value).filter(v=>v).map(Number);}});
 let t=JSON.stringify(res);document.getElementById('out').value=t;
 let b=new Blob([t],{{type:'application/json'}});let a=document.createElement('a');
 a.href=URL.createObjectURL(b);a.download='gold_resultado.json';a.click();
 window.scrollTo(0,document.body.scrollHeight);}}
</script></body></html>"""

out = C / "GOLD_HUMANO.html"
out.write_text(html, encoding="utf-8")
print(f"HTML: {out}")
