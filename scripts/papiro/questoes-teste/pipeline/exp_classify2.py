"""Iteracao 2: classificacao com PROMPT MELHORADO (guia de decisao p/ regras vizinhas)
+ veredito (correta/errada/fora). Modelo configuravel (default sonnet).
Uso: python exp_classify2.py [sonnet|haiku] [lote_ini] [lote_fim]
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
MODEL = sys.argv[1] if len(sys.argv) > 1 else "sonnet"
LINI = int(sys.argv[2]) if len(sys.argv) > 2 else 4
LFIM = int(sys.argv[3]) if len(sys.argv) > 3 else 11
BATCH = 25
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    def tk(s): return len(enc.encode(s))
except Exception:
    def tk(s): return int(len(s) / 3.7)

idx = json.loads((ECON / "INVENTARIO-indice.json").read_text(encoding="utf-8"))
rules = idx.get("ranking", [])
CAT = "\n".join(f"{i+1}. {r.get('ponto','?')[:95]}" for i, r in enumerate(rules))
NR = len(rules)

qs = []
for f in sorted(glob.glob(str(FOLHA / "lote-*.json"))):
    ln = int(Path(f).stem.split("-")[1])
    if LINI <= ln <= LFIM:
        qs += json.loads(Path(f).read_text(encoding="utf-8"))
print(f"[classify2/{MODEL}] {len(qs)} questoes (lotes {LINI}-{LFIM}) | {NR} regras")

SYS = (
    "Você CLASSIFICA alternativas de questões de colocação pronominal contra um CATÁLOGO FIXO de regras.\n\n"
    f"CATÁLOGO:\n{CAT}\n\n"
    "GUIA DE DECISÃO (siga NESTA ordem para escolher a regra de CADA alternativa):\n"
    "1. Há FATOR ATRATIVO antes do verbo? (negação: não/nunca/jamais/nem · relativo: que/quem/onde/cujo/o qual · "
    "conjunção subordinativa: que/se/quando/porque/embora/conforme · advérbio anteposto sem vírgula: já/sempre/ainda/talvez/só · "
    "indefinido/interrogativo: tudo/alguém/quem?) → a regra é a **PRÓCLISE OBRIGATÓRIA daquele atrativo específico** "
    "(relativo, negação, conjunção, advérbio, indefinido). ⚠️ NUNCA classifique como 'facultatividade' quando há atrativo.\n"
    "2. Verbo inicia a oração/período (nada antes)? → regra de ÊNCLISE OBRIGATÓRIA (átono não inicia).\n"
    "3. Futuro do presente/pretérito SEM atrativo? → regra de MESÓCLISE.\n"
    "4. Locução verbal (auxiliar + particípio/gerúndio/infinitivo)? → regra de LOCUÇÃO correspondente.\n"
    "5. SÓ se NÃO houver atrativo, nem início, nem futuro → regra de ÊNCLISE PADRÃO/FACULTATIVIDADE.\n"
    "6. Troca o/a (OD) × lhe (OI) por transitividade → regra de EMPREGO. Forma lo/la/no/na/mo → regra de FORMA.\n\n"
    "Para CADA alternativa dê: veredito ('correta' se segue a norma, 'errada' se viola, 'fora' se NÃO é questão de "
    "colocação — ex.: regência/morfologia), a regra (número do catálogo; 0 só se veredito='fora'), e instancia (1 frase).\n"
    'SOMENTE JSON: {"results":[{"id":<int>,"alts":[{"alt":<idx>,"veredito":"correta|errada|fora","regra":<num>,"instancia":"..."}]}]}'
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
        bl.append(f"id={q['id']}: {(q.get('enunciado') or '')[:450]}\n" + "\n".join(ls))
    return "\n\n".join(bl)


def run_batch(batch):
    prompt = SYS + f"\n\n=== {len(batch)} QUESTOES ===\n" + build(batch)
    for at in range(3):
        try:
            r = subprocess.run(f'"{EXE}" -p --model {MODEL} --dangerously-skip-permissions',
                               input=prompt, capture_output=True, text=True, shell=True,
                               timeout=500, encoding="utf-8", errors="replace")
            d = parse(r.stdout)
            return d.get("results", []), tk(prompt), tk(r.stdout)
        except Exception:
            if at == 2:
                return [], tk(prompt), 0
            time.sleep(3)


batches = [qs[i:i+BATCH] for i in range(0, len(qs), BATCH)]
allres, tin, tout = [], 0, 0
t0 = time.time()
with ThreadPoolExecutor(max_workers=4) as ex:
    for res, ti, to in ex.map(run_batch, batches):
        allres += res; tin += ti; tout += to

(ECON / f"classificacao2_{MODEL}.json").write_text(json.dumps(allres, ensure_ascii=False, indent=1), encoding="utf-8")
nalts = sum(len(r.get("alts", [])) for r in allres)
fora = sum(1 for r in allres for a in r.get("alts", []) if a.get("veredito") == "fora")
pi, po = {"haiku": (1, 5), "sonnet": (3, 15)}[MODEL]
cq = (tin * pi + tout * po) / 1e6 / max(1, len(allres))
print(f"[classify2] {len(allres)} q, {nalts} alts, {time.time()-t0:.0f}s | 'fora'={fora} ({100*fora//max(1,nalts)}%)")
print(f"[classify2] ${cq:.5f}/q | 79K: ${cq*79000:,.0f} (Batch ${cq*79000/2:,.0f}) | salvo classificacao2_{MODEL}.json")
