"""Roda Sonnet no passe 2 (se faltar) e renderiza Opus + Sonnet em markdown legivel
(questao + alternativa + comentario), pra comparacao lado a lado."""
from __future__ import annotations
import json, sys, re, shutil, subprocess, time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

FOLHA = Path(r"D:\inventario-v2\lingua-portuguesa-portugues\colocacao-pronominal")
OUT = FOLHA / "_pilot2"
EXE = shutil.which("claude.cmd") or shutil.which("claude")
N = 12
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    def tk(s): return len(enc.encode(s))
except Exception:
    def tk(s): return int(len(s) / 3.7)

qs = json.loads((FOLHA / "lote-001.json").read_text(encoding="utf-8"))[:N]
qmap = {q["id"]: q for q in qs}

SYS = (
    "Você é PROFESSOR de Português corrigindo questões de concurso. Para CADA questão, escreva o "
    "GABARITO COMENTADO: para CADA alternativa, 1-2 frases dizendo por que está CERTA ou ERRADA, "
    "citando a REGRA exata. Depois, um 'macete' de 1 linha. Tom direto, técnico. SOMENTE JSON puro:\n"
    '{"results":[{"id":<int>,"comentarios":[{"alt":<indice>,"veredito":"certa|errada","texto":"..."}],"macete":"..."}]}'
)


def parse(t):
    t = re.sub(r"```(json)?", "", t); i, j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j+1])


def build_body():
    bl = []
    for q in qs:
        alts = q.get("alternativas") or []
        gab = q.get("numeroAlternativaCorreta")
        ls = [f"  [{i}] {(a or '')[:300]}{'  <<< GABARITO' if i == gab else ''}" for i, a in enumerate(alts)]
        bl.append(f"QUESTAO id={q['id']} (tipo {q.get('tipoQuestao')}):\n{(q.get('enunciado') or '')[:900]}\nALTERNATIVAS:\n" + "\n".join(ls))
    return "\n\n".join(bl)


def run_sonnet():
    f = OUT / "_comentado_sonnet.json"
    if f.exists():
        print("[sonnet] cache"); return
    prompt = SYS + f"\n\n=== {len(qs)} QUESTOES ===\n" + build_body()
    t0 = time.time()
    try:
        r = subprocess.run(f'"{EXE}" -p --model sonnet --dangerously-skip-permissions',
                           input=prompt, capture_output=True, text=True, shell=True,
                           timeout=600, encoding="utf-8", errors="replace")
        d = parse(r.stdout)
        f.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        tin, tout = tk(prompt), tk(r.stdout)
        cq = (tin * 3 + tout * 15) / 1e6 / len(qs)
        print(f"[sonnet] {time.time()-t0:.0f}s in={tin} out={tout} | ${cq:.4f}/q | 79K: ${cq*79000:,.0f} (Batch ${cq*79000/2:,.0f})")
    except Exception as e:
        print(f"[sonnet] FALHOU: {str(e)[:150]}")


def render(model_tag, title):
    src = OUT / f"_comentado_{model_tag}.json"
    if not src.exists():
        print(f"[render] {src.name} ausente"); return None
    d = json.loads(src.read_text(encoding="utf-8"))
    out = [f"# Gabarito Comentado — {title}", f"_{len(d.get('results',[]))} questões de Colocação Pronominal_\n"]
    letras = "ABCDEFGH"
    for r in d.get("results", []):
        q = qmap.get(r["id"], {})
        alts = q.get("alternativas") or []
        gab = q.get("numeroAlternativaCorreta")
        out.append(f"\n## Questão {r['id']} ({q.get('tipoQuestao','?')})")
        en = (q.get("enunciado") or "").strip()
        out.append(f"> {en[:400]}\n" if en else "")
        for c in r.get("comentarios", []):
            i = c.get("alt", -1)
            alt_txt = (alts[i][:160] if 0 <= i < len(alts) else "?")
            mark = " ✓GAB" if i == gab else ""
            v = "✅" if c.get("veredito") == "certa" else "❌"
            out.append(f"- {v} **[{letras[i] if 0<=i<len(letras) else i}]**{mark} {alt_txt}")
            out.append(f"   ↳ {c.get('texto','')}")
        if r.get("macete"):
            out.append(f"\n💡 **Macete:** {r['macete']}")
    p = OUT / f"COMENTADO-{model_tag}.md"
    p.write_text("\n".join(out), encoding="utf-8")
    print(f"[render] {p}")
    return p


run_sonnet()
render("opus-4-8", "OPUS 4.8")
render("sonnet", "SONNET")
