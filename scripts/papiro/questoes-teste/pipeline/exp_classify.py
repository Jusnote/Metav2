"""Passo de CLASSIFICACAO barata: taggeia as questoes dos lotes 'bulk' contra o
catalogo de regras (descoberto no deep dos lotes 1-3). Resiste a confabular porque
escolhe de uma LISTA fixa; flag 'nova' escala o que nao casar. Modelo barato.

Uso: python exp_classify.py [haiku|sonnet] [lote_ini] [lote_fim]
"""
from __future__ import annotations
import json, sys, re, shutil, subprocess, time, glob
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

FOLHA = Path(r"D:\inventario-v2\lingua-portuguesa-portugues\colocacao-pronominal")
ECON = FOLHA / "_pilot2_econ"
EXE = shutil.which("claude.cmd") or shutil.which("claude")
MODEL = sys.argv[1] if len(sys.argv) > 1 else "haiku"
LINI = int(sys.argv[2]) if len(sys.argv) > 2 else 4
LFIM = int(sys.argv[3]) if len(sys.argv) > 3 else 11
BATCH = 25
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    def tk(s): return len(enc.encode(s))
except Exception:
    def tk(s): return int(len(s) / 3.7)

# catalogo de regras (do deep 1-3)
idx = json.loads((ECON / "INVENTARIO-indice.json").read_text(encoding="utf-8"))
rules = idx.get("ranking", [])
CAT = "\n".join(f"{i+1}. {r.get('ponto','?')[:90]}" for i, r in enumerate(rules))
NR = len(rules)

# questoes bulk (lotes LINI..LFIM)
qs = []
for f in sorted(glob.glob(str(FOLHA / "lote-*.json"))):
    ln = int(Path(f).stem.split("-")[1])
    if LINI <= ln <= LFIM:
        qs += json.loads(Path(f).read_text(encoding="utf-8"))
print(f"[classify] {len(qs)} questoes (lotes {LINI}-{LFIM}) | {NR} regras no catalogo | modelo {MODEL}")

SYS = (
    "Você CLASSIFICA questões de colocação pronominal contra um CATÁLOGO FIXO de regras. "
    "NÃO invente regra nova. Para cada questão, para CADA alternativa, escolha o NÚMERO da regra "
    "do catálogo que ela testa/viola + uma frase curta (instância específica). Se NENHUMA regra do "
    "catálogo se aplicar, use regra=0 e marque nova=true (será escalada). SOMENTE JSON puro.\n\n"
    f"CATÁLOGO DE REGRAS:\n{CAT}\n\n"
    'Formato: {"results":[{"id":<int>,"alts":[{"alt":<idx>,"regra":<num>,"instancia":"...","nova":false}]}]}'
)


def parse(t):
    t = re.sub(r"```(json)?", "", t); i, j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j+1])


def build(batch):
    bl = []
    for q in batch:
        alts = q.get("alternativas") or []
        gab = q.get("numeroAlternativaCorreta")
        ls = [f"  [{i}] {(a or '')[:200]}{'  <<<GAB' if i == gab else ''}" for i, a in enumerate(alts)]
        bl.append(f"id={q['id']}: {(q.get('enunciado') or '')[:500]}\n" + "\n".join(ls))
    return "\n\n".join(bl)


def run_batch(batch):
    prompt = SYS + f"\n\n=== {len(batch)} QUESTOES ===\n" + build(batch)
    for at in range(3):
        try:
            r = subprocess.run(f'"{EXE}" -p --model {MODEL} --dangerously-skip-permissions',
                               input=prompt, capture_output=True, text=True, shell=True,
                               timeout=400, encoding="utf-8", errors="replace")
            d = parse(r.stdout)
            return d.get("results", []), tk(prompt), tk(r.stdout)
        except Exception:
            if at == 2:
                return [], tk(prompt), 0
            time.sleep(3)


batches = [qs[i:i+BATCH] for i in range(0, len(qs), BATCH)]
allres, tin, tout = [], 0, 0
t0 = time.time()
with ThreadPoolExecutor(max_workers=5) as ex:
    for res, ti, to in ex.map(run_batch, batches):
        allres += res; tin += ti; tout += to

# stats
nq = len(allres)
nalts = sum(len(r.get("alts", [])) for r in allres)
novas = sum(1 for r in allres for a in r.get("alts", []) if a.get("nova"))
from collections import Counter
rc = Counter(a.get("regra") for r in allres for a in r.get("alts", []))
(ECON / f"classificacao_{MODEL}.json").write_text(json.dumps(allres, ensure_ascii=False, indent=1), encoding="utf-8")

pi, po = {"haiku": (1, 5), "sonnet": (3, 15)}[MODEL]
cq = (tin * pi + tout * po) / 1e6 / max(1, nq)
print(f"[classify] {nq} questoes, {nalts} alternativas | {time.time()-t0:.0f}s")
print(f"[classify] regra=NOVA (nao casou catalogo): {novas} alternativas ({100*novas//max(1,nalts)}%)")
print(f"[classify] custo: ${cq:.5f}/questao | 79K: ${cq*79000:,.0f} (Batch ${cq*79000/2:,.0f})")
print(f"[classify] top regras usadas: {rc.most_common(6)}")
print(f"[classify] salvo em {ECON / f'classificacao_{MODEL}.json'}")
