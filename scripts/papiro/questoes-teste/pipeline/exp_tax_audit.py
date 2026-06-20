"""Auditoria LLM independente: classifica 300 questoes nos 9 temas (sonnet via claude -p),
compara com a colocacao do embedding. Concordancia = pureza estimada.
Escreve _tax_audit_result.json."""
from __future__ import annotations
import json, sys, re, shutil, subprocess
from pathlib import Path
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

C = Path(r"D:\inventario-v2\_scale_probe")
A = json.loads((C / "_tax_audit_input.json").read_text(encoding="utf-8"))
temas = A["temas"]; qs = A["questoes"]
EXE = shutil.which("claude.cmd") or shutil.which("claude")

tema_list = "\n".join(f"{i+1}. {t['nome']} — {t['desc'][:90]}" for i, t in enumerate(temas))
SYS = (
    "Você é examinador de Direito Constitucional. Classifique CADA questão em UM dos 9 temas abaixo "
    "(o que MELHOR a representa). Responda SOMENTE JSON puro, sem ```.\n\nTEMAS:\n" + tema_list +
    '\n\nFormato: {"results":[{"i":<i da questao>,"t":<numero 1-9>}]}'
)


def parse(t):
    t = re.sub(r"```(json)?", "", t)
    i, j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j+1])


def chunk_call(chunk):
    body = "\n\n".join(f"[i={q['i']}] {q['text']}" for q in chunk)
    prompt = SYS + f"\n\n=== {len(chunk)} QUESTÕES ===\n" + body
    for at in range(3):
        try:
            r = subprocess.run(f'"{EXE}" -p --model sonnet --output-format text',
                               input=prompt, capture_output=True, text=True, shell=True,
                               timeout=300, encoding="utf-8", errors="replace")
            d = parse(r.stdout)
            return {x["i"]: int(x["t"]) for x in d.get("results", [])}
        except Exception:
            if at == 2:
                return {}


chunks = [qs[i:i+50] for i in range(0, len(qs), 50)]
verd = {}
with ThreadPoolExecutor(max_workers=6) as ex:
    for r in ex.map(chunk_call, chunks):
        verd.update(r)

tnome = [t["nome"] for t in temas]
ok = miss = 0
confus = Counter()
per_tema = defaultdict(lambda: [0, 0])  # tema_atribuido -> [ok, total]
for q in qs:
    if q["i"] not in verd:
        continue
    llm = tnome[verd[q["i"]] - 1]
    atr = q["tema_atribuido"]
    per_tema[atr][1] += 1
    if llm == atr:
        ok += 1; per_tema[atr][0] += 1
    else:
        miss += 1; confus[(atr, llm)] += 1

tot = ok + miss
res = {
    "auditadas": tot,
    "concordancia_pct": round(100 * ok / max(1, tot), 1),
    "discordancia_pct": round(100 * miss / max(1, tot), 1),
    "por_tema": {k: f"{v[0]}/{v[1]} ({100*v[0]//max(1,v[1])}%)" for k, v in sorted(per_tema.items())},
    "top_confusoes": [f"{a}  ->  {b}: {n}" for (a, b), n in confus.most_common(8)],
}
(C / "_tax_audit_result.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(res, ensure_ascii=False, indent=1))
