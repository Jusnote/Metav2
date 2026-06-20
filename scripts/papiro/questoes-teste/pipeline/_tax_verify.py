"""VERIFICAÇÃO do screen de colocação: re-roda os modelos do topo salvando resposta crua
+ palpite por questão, e mostra lado a lado com o gabarito do Fable. Diagnostica o nano.
Reusa o mesmo gold (n=50). THROWAWAY."""
import io, json, sys, time
from pathlib import Path
import requests
import _tax_place_test as T

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

MODELS = [("qwen/qwen3.5-flash-02-23", False), ("deepseek/deepseek-v4-flash", True),
          ("openai/gpt-4.1-nano", False), ("anthropic/claude-haiku-4.5", False)]


def call(slug, think_off):
    body = {"model": slug, "messages": [{"role": "user", "content": PROMPT}], "temperature": 0, "max_tokens": 8000}
    if think_off:
        body["thinking"] = {"type": "disabled"}
    r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                      headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                      json=body, timeout=600)
    if r.status_code != 200:
        return None, f"HTTP {r.status_code}: {r.text[:200]}"
    d = r.json()
    return d["choices"][0]["message"]["content"], None


preds, raws = {}, {}
print("Re-rodando (salvando tudo):\n")
for slug, th in MODELS:
    text, err = call(slug, th)
    if err:
        print(f"{slug}: {err}"); preds[slug] = {}; raws[slug] = ""; continue
    raws[slug] = text
    try:
        res = T.parse_json(text)
        p = {int(k): [int(x) for x in v if str(x).isdigit()] for k, v in res.items()}
    except Exception as e:
        p = {}; print(f"  {slug}: PARSE FALHOU: {e}")
    preds[slug] = p
    n = ok = 0
    for j in range(len(sample)):
        g = gold.get(j, [])
        if not g:
            continue
        n += 1
        pp = p.get(j, [])
        if pp and pp[0] in g:
            ok += 1
    print(f"  {slug:34} parse {len(p)}/{len(sample)} questões | acc {ok}/{n} = {100*ok/max(1,n):.0f}%")

print("\n" + "=" * 90)
print("EXEMPLOS CONCRETOS — questão · gabarito(Fable) · palpite de cada modelo (✓/✗)")
print("=" * 90)
for j in [0, 1, 2, 3, 5, 8, 13, 20]:
    i = sample[j]
    g = gold.get(j, [])
    print(f"\n[{j}] {T.TXT[i][:115]}")
    print(f"     gabarito(Fable): {[T.NAME.get(x, x) for x in g]}")
    for slug, _ in MODELS:
        pp = preds[slug].get(j, [])
        hit = "✓" if (pp and pp[0] in g) else "✗"
        print(f"     {hit} {slug.split('/')[-1]:26}: {[T.NAME.get(x, x) for x in pp[:2]]}")

print("\n" + "=" * 90)
print("DIAGNÓSTICO GPT-4.1-nano (o 6%) — resposta CRUA, primeiros 900 chars:")
print("=" * 90)
print(raws.get("openai/gpt-4.1-nano", "")[:900])
