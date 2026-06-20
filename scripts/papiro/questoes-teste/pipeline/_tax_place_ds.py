"""Testa DeepSeek V4 Flash (non-thinking) na COLOCAÇÃO, contra o MESMO gold do Fable
(DConst n=50). Apples-to-apples vs Haiku 92% e KMeans 62%. Reusa o gold salvo em
_tax_place_test.json. Chave em D:/verus_api/.env (DEEPSEEK_API_KEY=...). THROWAWAY.

Uso:  python _tax_place_ds.py            (non-thinking, padrão)
      python _tax_place_ds.py think       (com thinking, pra comparar)
"""
import io, json, sys, time
from pathlib import Path
import requests
import _tax_place_test as T   # reaproveita SUB, NAME, classify_prompt, parse_json (carrega DConst)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
THINK = len(sys.argv) > 1 and sys.argv[1] == "think"


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")


KEY = envval("DEEPSEEK_API_KEY")
assert KEY, "DEEPSEEK_API_KEY ausente no D:/verus_api/.env"

C = Path(r"D:\inventario-v2\_scale_probe")
saved = json.loads((C / "_tax_place_test.json").read_text(encoding="utf-8"))
sample = saved["sample"]
gold = {int(k): [int(x) for x in v] for k, v in saved["gold"].items()}

MODEL = "deepseek-v4-flash"
body = {"model": MODEL, "messages": [{"role": "user", "content": T.classify_prompt(sample)}],
        "temperature": 0, "max_tokens": 8000}
if not THINK:
    body["thinking"] = {"type": "disabled"}

print(f"DeepSeek {MODEL} | thinking={'ON' if THINK else 'OFF'} | classificando {len(sample)} questões…")
t0 = time.time()
r = requests.post("https://api.deepseek.com/chat/completions",
                  headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                  json=body, timeout=600)
dt = time.time() - t0
if r.status_code != 200:
    print("✗ HTTP", r.status_code, r.text[:400]); sys.exit(1)
data = r.json()
text = data["choices"][0]["message"]["content"]
usage = data.get("usage", {})
try:
    res = T.parse_json(text)
    ds = {int(k): [int(x) for x in v if str(x).isdigit()] for k, v in res.items()}
except Exception as e:
    print("✗ parse falhou:", e); print(text[:600]); sys.exit(1)

ok, n, jacc = 0, 0, []
miss = []
for j in range(len(sample)):
    g = gold.get(j, [])
    if not g:
        continue
    n += 1
    p = ds.get(j, [])
    hit = bool(p) and p[0] in g
    ok += hit
    if p:
        jacc.append(len(set(p) & set(g)) / len(set(p) | set(g)))
    if not hit and j < 200:
        miss.append((j, p, g))
cost = usage.get("prompt_tokens", 0) / 1e6 * 0.14 + usage.get("completion_tokens", 0) / 1e6 * 0.28

print("=" * 72)
print(f" DeepSeek V4 Flash ({'thinking' if THINK else 'NON-thinking'}) — colocação DConst, gold Fable n={n}")
print("=" * 72)
print(f"  DeepSeek acerto (principal) vs gabarito:  {ok}/{n} = {100*ok/max(1,n):.0f}%")
print(f"  Multi-rótulo (Jaccard médio):             {100*sum(jacc)/max(1,len(jacc)):.0f}%")
print(f"  ── mesma régua ──  Haiku 4.5: 92%  ·  KMeans embedding: 62%")
print(f"  tempo {dt:.0f}s | tokens in {usage.get('prompt_tokens')} / out {usage.get('completion_tokens')} | custo ${cost:.4f}")
print(f"  (projeção 1,07M questões a esse custo/token: ~${cost/max(1,n)*1_073_363:,.0f})")
if miss:
    print(f"\n  exemplos de erro (DeepSeek → gabarito):")
    for j, p, g in miss[:5]:
        i = sample[j]
        print(f'   • "{T.TXT[i][:80]}…"  → {[T.NAME.get(x) for x in p[:1]]}  vs  {[T.NAME.get(x) for x in g]}')
