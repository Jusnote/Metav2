"""Compara modelos baratos na COLOCAÇÃO via OpenRouter, contra o MESMO gold do Fable
(DConst n=50, multi-rótulo). Reusa o gold salvo. Chave: OPENROUTER_API_KEY no .env.
Imprime tabela acurácia × preço × tempo + projeção pra 1,07M. THROWAWAY.
"""
import io, json, sys, time
from pathlib import Path
import requests
import _tax_place_test as T   # SUB, NAME, TXT, classify_prompt, parse_json (já reconfigura stdout p/ utf-8)

SUBSET = 1_073_363  # bloco do 1º lançamento (Direitos+Legisl+Port+Contab+RLM)


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")


KEY = envval("OPENROUTER_API_KEY")
C = Path(r"D:\inventario-v2\_scale_probe")
saved = json.loads((C / "_tax_place_test.json").read_text(encoding="utf-8"))
sample = saved["sample"]
gold = {int(k): [int(x) for x in v] for k, v in saved["gold"].items()}
PROMPT = T.classify_prompt(sample)

# (slug, $in/M, $out/M, desligar_thinking)
MODELS = [
    ("deepseek/deepseek-v4-flash", 0.098, 0.196, True),
    ("google/gemini-2.5-flash-lite", 0.10, 0.40, False),
    ("openai/gpt-4.1-nano", 0.10, 0.40, False),
    ("qwen/qwen3.5-flash-02-23", 0.065, 0.26, False),
    ("qwen/qwen3-next-80b-a3b-instruct:free", 0.0, 0.0, False),
    ("anthropic/claude-haiku-4.5", 1.0, 5.0, False),
]


def run(slug, pin, pout, think_off):
    body = {"model": slug, "messages": [{"role": "user", "content": PROMPT}],
            "temperature": 0, "max_tokens": 8000}
    if think_off:
        body["thinking"] = {"type": "disabled"}
    t0 = time.time()
    try:
        r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                          headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                          json=body, timeout=600)
    except Exception as e:
        return {"err": f"rede: {e}"}
    dt = time.time() - t0
    if r.status_code != 200:
        return {"err": f"HTTP {r.status_code}: {r.text[:140]}", "dt": dt}
    d = r.json()
    try:
        text = d["choices"][0]["message"]["content"]
        res = T.parse_json(text)
        pred = {int(k): [int(x) for x in v if str(x).isdigit()] for k, v in res.items()}
    except Exception as e:
        return {"err": f"parse: {e}", "dt": dt}
    u = d.get("usage", {})
    ok, n, jacc = 0, 0, []
    for j in range(len(sample)):
        g = gold.get(j, [])
        if not g:
            continue
        n += 1
        p = pred.get(j, [])
        if p and p[0] in g:
            ok += 1
        if p:
            jacc.append(len(set(p) & set(g)) / len(set(p) | set(g)))
    cost = u.get("prompt_tokens", 0) / 1e6 * pin + u.get("completion_tokens", 0) / 1e6 * pout
    return {"acc": 100 * ok / max(1, n), "jac": 100 * sum(jacc) / max(1, len(jacc)),
            "n": n, "dt": dt, "in": u.get("prompt_tokens", 0), "out": u.get("completion_tokens", 0),
            "cost": cost, "proj": (cost / max(1, n) * SUBSET) if cost else 0.0}


print(f"Testando {len(MODELS)} modelos no gold do Fable (DConst n=50)…\n")
rows = []
for slug, pin, pout, th in MODELS:
    print(f"  → {slug} …", flush=True)
    res = run(slug, pin, pout, th)
    rows.append((slug, res))
    if "err" in res:
        print(f"      ✗ {res['err']}")
    else:
        print(f"      ✓ acc {res['acc']:.0f}% | {res['dt']:.0f}s | ${res['cost']:.4f}")

print("\n" + "=" * 92)
print(f"{'modelo':<40}|{'acc':>5}|{'multi':>6}|{'tempo':>6}|{'$ teste':>9}|{'proj 1,07M':>11}")
print("-" * 92)
for slug, res in rows:
    if "err" in res:
        print(f"{slug:<40}|  ERRO: {res['err'][:40]}")
        continue
    proj = f"${res['proj']:,.0f}" if res['proj'] else "grátis"
    print(f"{slug:<40}|{res['acc']:>4.0f}%|{res['jac']:>5.0f}%|{res['dt']:>5.0f}s|${res['cost']:>8.4f}|{proj:>11}")
print("-" * 92)
print("referência (mesmo gold): Haiku 92% (Max) · KMeans embedding 62%")
print("proj 1,07M = custo estimado pra colocar o bloco do 1º lançamento a esse custo/token")
