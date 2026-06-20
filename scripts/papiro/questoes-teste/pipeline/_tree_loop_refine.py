"""Refino iterative-fit (Opus via OpenRouter — sem Max). Lê amostra REAL de questões por nó
(de cycle1) + os 'não encaixa', redesenha a árvore com definicao+exemplos+desempate e
conserta misfits (dividir/fundir/criar). tax/<slug>.{tree,cycle1}.json → tree_v2.json.

Uso: python _tree_loop_refine.py <slug> "<materia>"
"""
import io, json, re, sys
from collections import defaultdict
from pathlib import Path
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
CACHE = Path(r"D:\inventario-v2\_scale_probe\tax")
OR_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-opus-4.8"
SLUG = sys.argv[1] if len(sys.argv) > 1 else "portugues"
MATERIA = sys.argv[2] if len(sys.argv) > 2 else "Língua Portuguesa"


def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v:
                val = v
    return val


KEY = envval("OPENROUTER_API_KEY")
TXT = json.loads((CACHE / f"{SLUG}.dat.json").read_text(encoding="utf-8"))["txt"]
tree = json.loads((CACHE / f"{SLUG}.tree.json").read_text(encoding="utf-8"))
cyc = json.loads((CACHE / f"{SLUG}.cycle1.json").read_text(encoding="utf-8"))
sample, preds = cyc["sample"], {int(k): v for k, v in cyc["preds"].items()}

SUB = []
for t in tree["temas"]:
    for s in t["subtemas"]:
        SUB.append({"id": len(SUB) + 1, "tema": t["nome"], "nome": s["nome"], "oqc": s.get("o_que_cai", "")})

by_node = defaultdict(list)
naofit = []
for j in range(len(sample)):
    p = preds.get(j) or {}
    ns = p.get("n", [])
    if not ns or ns[0] == 0:
        naofit.append(j); continue
    if len(by_node[ns[0]]) < 7:
        by_node[ns[0]].append(j)

blocos = []
for s in SUB:
    n = sum(1 for j in range(len(sample)) if (preds.get(j, {}).get("n", [0]) or [0])[0] == s["id"])
    qs = "\n".join(f"      - {TXT[sample[j]][:160]}" for j in by_node.get(s["id"], []))
    blocos.append(f"[{s['id']}] {s['tema']} › {s['nome']} ({n}q)\n   o_que_cai: {s['oqc']}\n   amostra:\n{qs}")
nf = "\n".join(f"   - {TXT[sample[j]][:160]}" for j in naofit[:6]) or "   (nenhuma)"
DADOS = "ÁRVORE ATUAL + QUESTÕES REAIS POR NÓ:\n\n" + "\n\n".join(blocos) + f"\n\n=== NÃO ENCAIXOU ===\n{nf}"


def call_opus(system, user):
    body = {"model": MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0, "max_tokens": 16000, "reasoning": {"enabled": False}}
    for _ in range(3):
        r = requests.post(OR_URL, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                          json=body, timeout=600)
        if r.status_code == 200:
            c = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content")
            if c:
                return c
        print(f"   retry HTTP {r.status_code}: {r.text[:80]}")
    return None


SYSTEM = (f"Você é o Editor-Chefe de Taxonomia do PAPIRO refinando a árvore de «{MATERIA}» com base nas "
          "QUESTÕES REAIS que caíram em cada nó. Objetivo: árvore impecável, nenhuma questão estranha ao nó.")
USER = (
    "Refine a árvore lendo as questões reais de cada nó:\n"
    f"{DADOS}\n\n"
    "REGRAS:\n"
    "- Para cada nó, julgue pelas questões: coerente? tem questão claramente misturada? largo demais "
    "(2 temas grudados → DIVIDIR)? fino/redundante (→ FUNDIR)? As 'não encaixou' revelam nó FALTANDO (→ CRIAR)?\n"
    "- Mantenha o que está bom; conserte o que as questões mostraram.\n"
    "- CADA subtema da árvore refinada DEVE ter: nome, definicao (crisp: o que é/não é), exemplos (1-2 do que "
    "pertence), desempate (regra vs o nó vizinho confuso), ref (opcional).\n\n"
    "Responda SOMENTE o JSON da árvore refinada: {\"materia\",\"temas\":[{\"nome\",\"subtemas\":"
    "[{\"nome\",\"definicao\",\"exemplos\",\"desempate\",\"ref\"}]}]}. Sem texto fora.")

print(f"Opus (OpenRouter) refinando {MATERIA} com as questões reais…")
txt = call_opus(SYSTEM, USER)
if not txt:
    print("✗ Opus não respondeu"); raise SystemExit
t = re.sub(r"```(json)?", "", txt)
a, b = t.find("{"), t.rfind("}")
try:
    v2 = json.loads(t[a:b + 1])
except Exception as e:
    print("✗ JSON inválido:", e); print(txt[:600]); raise SystemExit
(CACHE / f"{SLUG}.tree_v2.json").write_text(json.dumps(v2, ensure_ascii=False, indent=1), encoding="utf-8")
n2 = sum(len(t.get("subtemas", [])) for t in v2.get("temas", []))
print(f"✓ tree_v2: {len(v2['temas'])} temas · {n2} subtemas (antes: {len(SUB)} nós). → {SLUG}.tree_v2.json")
