"""COLOCAÇÃO — avaliação genérica por matéria. Questão INTEIRA, gold=Opus 4.8/Max,
candidatos DeepSeek/Qwen/Haiku via OpenRouter, n=120. Lê tax/<slug>.dat.json +
tax/<slug>.tree.json. Confirma se o vencedor se mantém em OUTROS tipos de questão.

Uso:  python _tax_place_eval.py <slug> "<materia>"
"""
import asyncio, io, json, random, re, sys, time
from pathlib import Path
import requests
from pipeline import ClaudeCliDispatcher

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
SLUG = sys.argv[1]
MATERIA = sys.argv[2] if len(sys.argv) > 2 else SLUG
TAX = Path(r"D:\inventario-v2\_scale_probe\tax")
OR_URL = "https://openrouter.ai/api/v1/chat/completions"
N_TEST, BATCH = 120, 20


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")


KEY = envval("OPENROUTER_API_KEY")
TXT = json.loads((TAX / f"{SLUG}.dat.json").read_text(encoding="utf-8"))["txt"]
tree = json.loads((TAX / f"{SLUG}.tree.json").read_text(encoding="utf-8"))
SUB = []
for t in tree["temas"]:
    for s in t["subtemas"]:
        SUB.append({"id": len(SUB) + 1, "tema": t["nome"], "nome": s["nome"], "oqc": s.get("o_que_cai", "")})
NAME = {s["id"]: f'{s["tema"]} › {s["nome"]}' for s in SUB}
SUBS_STR = "\n".join(f'{s["id"]}. {s["tema"]} › {s["nome"]} — {s["oqc"][:85]}' for s in SUB)
rng = random.Random(99)
sample = rng.sample(range(len(TXT)), N_TEST)
batches = [[(j, sample[j]) for j in range(k, min(k + BATCH, N_TEST))] for k in range(0, N_TEST, BATCH)]


def make_prompt(batch):
    qs = "\n\n".join(f"[{j}] {TXT[i]}" for j, i in batch)
    return (f"Você classifica questões de «{MATERIA}» na taxonomia abaixo. Leia CADA questão inteira "
            "e escolha de 1 a 3 subtemas que ela cobra (o PRINCIPAL primeiro). Use SÓ os números. "
            "Responda APENAS o JSON {\"<j>\":[ids]}, nada além.\n\n"
            f"SUBTEMAS:\n{SUBS_STR}\n\n=== {len(batch)} QUESTÕES ===\n{qs}")


def parse_into(text, preds):
    t = re.sub(r"```(json)?", "", text)
    a, b = t.find("{"), t.rfind("}")
    try:
        for k, v in json.loads(t[a:b + 1]).items():
            preds[int(k)] = [int(x) for x in v if str(x).isdigit()]
    except Exception as e:
        print("   parse parcial:", e)


async def opus_gold():
    disp = ClaudeCliDispatcher(model="claude-opus-4-8", max_concurrent=1, timeout=1800)
    gold = {}
    for n, b in enumerate(batches, 1):
        print(f"   gold lote {n}/{len(batches)}…", flush=True)
        parse_into(await disp.run(make_prompt(b), stage="gold"), gold)
    return gold


def or_classify(slug, think_off, pin, pout):
    preds, tin, tout, t0 = {}, 0, 0, time.time()
    for b in batches:
        body = {"model": slug, "messages": [{"role": "user", "content": make_prompt(b)}],
                "temperature": 0, "max_tokens": 6000}
        if think_off:
            body["thinking"] = {"type": "disabled"}
        r = requests.post(OR_URL, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                          json=body, timeout=600)
        if r.status_code != 200:
            print(f"   {slug} HTTP {r.status_code}: {r.text[:100]}"); continue
        d = r.json()
        parse_into(d["choices"][0]["message"]["content"], preds)
        u = d.get("usage", {}); tin += u.get("prompt_tokens", 0); tout += u.get("completion_tokens", 0)
    return preds, tin / 1e6 * pin + tout / 1e6 * pout, time.time() - t0


def score(preds, gold):
    ok = n = 0; jacc = []
    for j in range(N_TEST):
        g = gold.get(j, [])
        if not g:
            continue
        n += 1
        p = preds.get(j, [])
        if p and p[0] in g:
            ok += 1
        if p:
            jacc.append(len(set(p) & set(g)) / len(set(p) | set(g)))
    return ok, n, 100 * sum(jacc) / max(1, len(jacc))


print(f"=== COLOCAÇÃO — {MATERIA} | questão INTEIRA, gold=Opus 4.8/Max, n={N_TEST}, {len(SUB)} subtemas ===\n1) Gold do Opus…")
gold = asyncio.run(opus_gold())
print(f"   gold: {len(gold)}/{N_TEST}\n2) Candidatos:")
MODELS = [("deepseek/deepseek-v4-flash", True, 0.098, 0.196),
          ("qwen/qwen3.5-flash-02-23", False, 0.065, 0.26),
          ("anthropic/claude-haiku-4.5", False, 1.0, 5.0)]
out = {"slug": SLUG, "sample": sample, "gold": gold, "preds": {}}
rows = []
for slug, th, pin, pout in MODELS:
    preds, cost, dt = or_classify(slug, th, pin, pout)
    out["preds"][slug] = preds
    ok, n, jac = score(preds, gold)
    rows.append((slug, ok, n, jac, dt))
    print(f"   {slug:34} {ok}/{n} = {100*ok/max(1,n):.0f}% (multi {jac:.0f}%, {dt:.0f}s)")

(TAX / f"{SLUG}.place_eval.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print("\n" + "=" * 70)
print(f"{'modelo':<34}|{'acc':>6}|{'multi':>7}|{'n':>4}")
print("-" * 70)
for slug, ok, n, jac, dt in rows:
    print(f"{slug:<34}|{100*ok/max(1,n):>5.0f}%|{jac:>6.0f}%|{n:>4}")
print("-" * 70)
print(f"gold = Opus 4.8 (Max). DConst (ref): DeepSeek 93 · Qwen 92 · Haiku 88.")
