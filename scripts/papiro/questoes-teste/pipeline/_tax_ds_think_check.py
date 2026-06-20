"""DeepSeek V4 Flash com thinking ON vs OFF no Português (mesmo gold do Opus).
Decide se o DeepSeek fecha o 83→~90 mais barato que o Qwen. THROWAWAY."""
import io, json, re, sys, time
from pathlib import Path
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
TAX = Path(r"D:\inventario-v2\_scale_probe\tax")
OR_URL = "https://openrouter.ai/api/v1/chat/completions"
MATERIA, PIN, POUT = "Língua Portuguesa", 0.098, 0.196


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")


KEY = envval("OPENROUTER_API_KEY")
TXT = json.loads((TAX / "portugues.dat.json").read_text(encoding="utf-8"))["txt"]
tree = json.loads((TAX / "portugues.tree.json").read_text(encoding="utf-8"))
SUB = []
for t in tree["temas"]:
    for s in t["subtemas"]:
        SUB.append({"id": len(SUB) + 1, "tema": t["nome"], "nome": s["nome"], "oqc": s.get("o_que_cai", "")})
SUBS_STR = "\n".join(f'{s["id"]}. {s["tema"]} › {s["nome"]} — {s["oqc"][:85]}' for s in SUB)
saved = json.loads((TAX / "portugues.place_eval.json").read_text(encoding="utf-8"))
sample = saved["sample"]
gold = {int(k): v for k, v in saved["gold"].items()}
N, BATCH = len(sample), 20
batches = [[(j, sample[j]) for j in range(k, min(k + BATCH, N))] for k in range(0, N, BATCH)]


def make_prompt(batch):
    qs = "\n\n".join(f"[{j}] {TXT[i]}" for j, i in batch)
    return (f"Você classifica questões de «{MATERIA}» na taxonomia abaixo. Leia CADA questão inteira "
            "e escolha de 1 a 3 subtemas (o PRINCIPAL primeiro). Use SÓ os números. "
            "Responda APENAS o JSON {\"<j>\":[ids]}.\n\n"
            f"SUBTEMAS:\n{SUBS_STR}\n\n=== {len(batch)} QUESTÕES ===\n{qs}")


def parse_into(text, preds):
    t = re.sub(r"```(json)?", "", text)
    a, b = t.find("{"), t.rfind("}")
    try:
        for k, v in json.loads(t[a:b + 1]).items():
            preds[int(k)] = [int(x) for x in v if str(x).isdigit()]
    except Exception:
        pass


def run(think_off):
    preds, tin, tout, t0 = {}, 0, 0, time.time()
    for b in batches:
        body = {"model": "deepseek/deepseek-v4-flash", "messages": [{"role": "user", "content": make_prompt(b)}],
                "temperature": 0, "max_tokens": 8000}
        if think_off:
            body["thinking"] = {"type": "disabled"}
        r = requests.post(OR_URL, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                          json=body, timeout=600)
        if r.status_code != 200:
            print("  HTTP", r.status_code, r.text[:120]); continue
        d = r.json()
        parse_into(d["choices"][0]["message"]["content"], preds)
        u = d.get("usage", {}); tin += u.get("prompt_tokens", 0); tout += u.get("completion_tokens", 0)
    ok = n = 0
    for j in range(N):
        g = gold.get(j, [])
        if not g:
            continue
        n += 1
        p = preds.get(j, [])
        if p and p[0] in g:
            ok += 1
    cost = tin / 1e6 * PIN + tout / 1e6 * POUT
    return ok, n, tout, cost, time.time() - t0


for label, off in [("thinking OFF", True), ("thinking ON", False)]:
    ok, n, tout, cost, dt = run(off)
    print(f"DeepSeek {label:13} (Port): {ok}/{n} = {100*ok/max(1,n):.0f}% | out {tout:>6} tok | {dt:.0f}s | "
          f"${cost:.4f} | proj 1,07M ${cost/max(1,n)*1_073_363:,.0f}")
print("ref: Qwen reasoning ON 90% ($156) · DeepSeek thinking OFF foi 83% no eval anterior")
