"""TESTE do 'passe 2': gabarito comentado por alternativa + macete, por questao.
Roda em Sonnet E Opus 4.8 (lado a lado) num sample. Mede custo e salva os dois.
NAO toca no resumo (passe separado)."""
from __future__ import annotations
import json, sys, re, shutil, subprocess, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

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
blocks = []
for q in qs:
    alts = q.get("alternativas") or []
    gab = q.get("numeroAlternativaCorreta")
    linhas = [f"  [{i}] {(a or '')[:300]}{'  <<< GABARITO' if i == gab else ''}" for i, a in enumerate(alts)]
    blocks.append(f"QUESTAO id={q['id']} (tipo {q.get('tipoQuestao')}):\n{(q.get('enunciado') or '')[:900]}\nALTERNATIVAS:\n" + "\n".join(linhas))
BODY = "\n\n".join(blocks)

SYS = (
    "Você é PROFESSOR de Português corrigindo questões de concurso. Para CADA questão, escreva o "
    "GABARITO COMENTADO: para CADA alternativa, 1-2 frases dizendo por que está CERTA ou ERRADA, "
    "citando a REGRA exata (ex.: 'pronome relativo que atrai próclise'). Depois, um 'macete' de 1 linha. "
    "Tom direto, técnico, sem enrolação. Responda SOMENTE JSON puro (sem ```):\n"
    '{"results":[{"id":<int>,"comentarios":[{"alt":<indice>,"veredito":"certa|errada","texto":"..."}],"macete":"..."}]}'
)


def parse(t):
    t = re.sub(r"```(json)?", "", t); i, j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j+1])


def run(model):
    prompt = SYS + f"\n\n=== {len(qs)} QUESTOES ===\n" + BODY
    t0 = time.time()
    try:
        r = subprocess.run(f'"{EXE}" -p --model {model} --dangerously-skip-permissions',
                           input=prompt, capture_output=True, text=True, shell=True,
                           timeout=600, encoding="utf-8", errors="replace")
    except subprocess.TimeoutExpired:
        return model, None, "TIMEOUT 600s", 0
    try:
        d = parse(r.stdout)
    except Exception as e:
        return model, None, f"parse fail: {e} | rc={r.returncode} | {(r.stdout or r.stderr or '')[:200]}", 0
    tin = tk(prompt); tout = tk(r.stdout)
    return model, d, f"{time.time()-t0:.0f}s in={tin} out={tout}", (tin, tout)


PRICE = {"sonnet": (3, 15), "claude-opus-4-8": (15, 75)}
for model in ["claude-opus-4-8", "sonnet"]:  # Opus primeiro (a barra de qualidade)
    try:
        m, d, info, toks = run(model)
    except Exception as e:
        print(f"[{model}] EXCEPT: {str(e)[:150]}", flush=True); continue
    if d:
        (OUT / f"_comentado_{model.replace('claude-','')}.json").write_text(
            json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        tin, tout = toks
        pi, po = PRICE[model]
        cq = (tin * pi + tout * po) / 1e6 / len(qs)
        print(f"[{model}] {info} | ${cq:.4f}/questao | extrap 79K: ${cq*79000:,.0f} (Batch ${cq*79000/2:,.0f})", flush=True)
    else:
        print(f"[{model}] FALHOU: {info}", flush=True)
print("salvos em", OUT)
