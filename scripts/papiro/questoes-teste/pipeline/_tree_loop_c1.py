"""Loop iterative-fit — CICLO 1 (diagnóstico). Coloca amostra de Português com VÁLVULA
DE ESCAPE (0=não encaixa) + confiança, via DeepSeek/OpenRouter. Diagnostica nós
bagunçados + 'não encaixa' → material pro Opus refinar a árvore. THROWAWAY.
"""
import io, json, re, sys, time
from collections import Counter
from pathlib import Path
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
TAX = Path(r"D:\inventario-v2\_scale_probe\tax")
OR_URL = "https://openrouter.ai/api/v1/chat/completions"
SLUG = sys.argv[1] if len(sys.argv) > 1 else "portugues"
MATERIA = sys.argv[2] if len(sys.argv) > 2 else "Língua Portuguesa"
N, BATCH = 500, 20


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
SUBS_STR = "\n".join(f'{s["id"]}. {s["tema"]} › {s["nome"]} — {s["oqc"][:90]}' for s in SUB)
import random
sample = random.Random(2026).sample(range(len(TXT)), N)
batches = [[(j, sample[j]) for j in range(k, min(k + BATCH, N))] for k in range(0, N, BATCH)]


def make_prompt(batch):
    qs = "\n\n".join(f"[{j}] {TXT[i]}" for j, i in batch)
    return (f"Você classifica questões de «{MATERIA}» na taxonomia abaixo. Para CADA questão: "
            "escolha 1-2 subtemas que ela cobra (PRINCIPAL primeiro), OU **0 se NENHUM nó encaixar bem**. "
            "Marque confiança: 1=alta, 2=baixa. Responda APENAS JSON {\"<j>\":{\"n\":[ids],\"c\":1}}.\n\n"
            f"SUBTEMAS:\n{SUBS_STR}\n\n=== {len(batch)} QUESTÕES ===\n{qs}")


def parse_into(text, preds):
    if not text:
        return
    t = re.sub(r"```(json)?", "", text)
    a, b = t.find("{"), t.rfind("}")
    try:
        for k, v in json.loads(t[a:b + 1]).items():
            ns = [int(x) for x in v.get("n", []) if str(x).isdigit()]
            preds[int(k)] = {"n": ns, "c": int(v.get("c", 1))}
    except Exception as e:
        print("   parse parcial:", e)


def call_batch(b):
    body = {"model": "deepseek/deepseek-v4-flash",
            "messages": [{"role": "user", "content": make_prompt(b)}],
            "temperature": 0, "max_tokens": 6000, "reasoning": {"enabled": False}}
    for _ in range(3):
        try:
            r = requests.post(OR_URL, headers={"Authorization": f"Bearer {KEY}",
                              "Content-Type": "application/json"}, json=body, timeout=300)
        except Exception as e:
            print("   net:", e); time.sleep(3); continue
        if r.status_code == 200:
            c = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content")
            if c:
                return c
            print("   content vazio, retry…")
        else:
            print(f"   HTTP {r.status_code}: {r.text[:90]}")
        time.sleep(3)
    return None


preds = {}
print(f"Colocando {N} questões de Português com válvula de escape (DeepSeek)…")
t0 = time.time()
for bi, b in enumerate(batches, 1):
    parse_into(call_batch(b), preds)
    if bi % 5 == 0:
        print(f"  {bi}/{len(batches)} lotes ({time.time()-t0:.0f}s)")

# ---- diagnóstico ----
prim = Counter()
lowconf_por_no = Counter()
naoencaixa = []
for j in range(N):
    p = preds.get(j)
    if not p:
        continue
    ns, c = p["n"], p["c"]
    if not ns or ns[0] == 0:
        naoencaixa.append(j); continue
    prim[ns[0]] += 1
    if c == 2:
        lowconf_por_no[ns[0]] += 1

print("\n" + "=" * 78)
print(f" DIAGNÓSTICO CICLO 1 — Português | {len([1 for j in range(N) if preds.get(j)])}/{N} colocadas")
print("=" * 78)
print(f"\n■ DISTRIBUIÇÃO por nó (e % baixa-confiança):")
for nid, cnt in prim.most_common():
    lc = lowconf_por_no.get(nid, 0)
    flag = "  ⚠️ muita baixa-conf" if cnt and lc / cnt > 0.35 else ""
    print(f"   {cnt:>4}q ({100*lc/max(1,cnt):>3.0f}% baixa-conf)  {NAME.get(nid)}{flag}")
print(f"\n■ NÃO ENCAIXA (válvula de escape): {len(naoencaixa)} questões  → sinal de NÓ FALTANDO")
for j in naoencaixa[:8]:
    print(f"   • {TXT[sample[j]][:120]}")

(TAX / f"{SLUG}.cycle1.json").write_text(
    json.dumps({"sample": sample, "preds": preds}, ensure_ascii=False), encoding="utf-8")
print(f"\n[salvo] {SLUG}.cycle1.json  ({time.time()-t0:.0f}s) — próximo: Opus refina a árvore com isso")
