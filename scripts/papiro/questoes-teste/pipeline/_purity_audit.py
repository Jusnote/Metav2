"""Auditoria de pureza: amostra N questões por folha e o OPUS (juiz independente) diz se cada
uma PERTENCE à folha em que foi classificada. Mede pureza por folha + global e aponta folhas sujas.
Uso: python _purity_audit.py <slug> "<materia>" [N_por_folha=5]
"""
import io, sys, json, time, random, threading, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, unquote

SLUG, MATERIA = sys.argv[1], sys.argv[2]
PER = int(sys.argv[3]) if len(sys.argv) > 3 else 5
TAX = Path(r"D:\inventario-v2\_scale_probe\tax")

def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v: val = v
    return val

ORKEY = envval("OPENROUTER_API_KEY")
tree = json.loads((TAX / f"{SLUG}.tree_design.json").read_text(encoding="utf-8"))
plc = json.loads((TAX / f"{SLUG}.placement.json").read_text(encoding="utf-8"))["placement"]

leaves = []  # (nome_full, def)
for t in tree["temas"]:
    for s in t.get("subtemas", []):
        pts = s.get("pontos", [])
        if pts:
            for p in pts:
                leaves.append((f'{t["nome"]} › {s["nome"]} › {p["nome"]}', p.get("definicao", "")))
        else:
            leaves.append((f'{t["nome"]} › {s["nome"]}', s.get("definicao", "")))

byleaf = defaultdict(list)
for q, v in plc.items():
    if v.get("n") and v["n"][0] > 0:
        byleaf[v["n"][0]].append(int(q))

random.seed(7)
samples = {}
allids = []
for i in range(1, len(leaves) + 1):
    qs = byleaf.get(i, [])[:]
    random.shuffle(qs)
    s = qs[:PER]
    if s:
        samples[i] = s
        allids += s

# pull textos
p = urlparse(envval("DATABASE_URL"))
import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                        dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
cur = conn.cursor()
cur.execute("select id, enunciado, alternativas, resposta_correta from questoes where id = any(%s)", (allids,))
qtext = {}
for qid, enun, alts, resp in cur.fetchall():
    al = " ".join(a if isinstance(a, str) else str(a) for a in alts) if isinstance(alts, (list, tuple)) else ""
    qtext[qid] = (enun + " " + al)[:900] + (f" [RESP: {str(resp)[:120]}]" if resp else "")
cur.close(); conn.close()
print(f"[audit] {len(leaves)} folhas, {len(allids):,} questões amostradas ({PER}/folha)")

result = {}  # leaf_idx -> (n, impuras, [sugestões])
usage = {"in": 0, "out": 0}
lock = threading.Lock()
done = [0]

def judge(i):
    nome, defn = leaves[i - 1]
    qs = samples[i]
    items = "\n".join(f"[{j}] {qtext.get(qid,'?')}" for j, qid in enumerate(qs))
    SYS = ("Você AUDITA a classificação de questões de concurso. As questões abaixo foram colocadas na FOLHA:\n"
           f"«{nome}»" + (f" — {defn}" if defn else "") + "\n\n"
           "Para CADA questão, julgue se o TEMA CENTRAL dela (o que o comando cobra) pertence a ESTA folha. "
           "Seja criterioso mas justo: se for um tema vizinho razoável da mesma família, conte como pertence; "
           "só marque NÃO se a questão é claramente de OUTRO assunto. "
           "Responda APENAS JSON {\"<j>\":{\"ok\":true|false,\"sug\":\"tema correto se false\"}}.")
    body = {"model": "anthropic/claude-opus-4.8",
            "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": "QUESTÕES:\n" + items}],
            "temperature": 0, "max_tokens": 1200, "reasoning": {"enabled": False}}
    for _ in range(3):
        try:
            r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                              headers={"Authorization": f"Bearer {ORKEY}"}, json=body, timeout=180)
            if r.status_code != 200:
                time.sleep(2); continue
            d = r.json(); c = d["choices"][0]["message"]["content"]
            res = json.loads(c[c.find("{"):c.rfind("}") + 1])
            u = d.get("usage", {})
            imp, sug = 0, []
            for j in range(len(qs)):
                v = res.get(str(j)) or {}
                if v.get("ok") is False:
                    imp += 1; sug.append(v.get("sug", "?"))
            with lock:
                usage["in"] += u.get("prompt_tokens", 0); usage["out"] += u.get("completion_tokens", 0)
                result[i] = (len(qs), imp, sug)
                done[0] += 1
                if done[0] % 25 == 0:
                    print(f"  {done[0]}/{len(samples)} folhas auditadas")
            return
        except Exception:
            time.sleep(2)
    with lock:
        result[i] = (len(qs), 0, [])

t0 = time.time()
with ThreadPoolExecutor(max_workers=8) as ex:
    list(ex.map(judge, list(samples.keys())))

tot = sum(r[0] for r in result.values())
imp = sum(r[1] for r in result.values())
cost = usage["in"] / 1e6 * 5 + usage["out"] / 1e6 * 25
print("\n" + "=" * 64)
print(f" PUREZA {MATERIA}: {(tot-imp)/tot*100:.1f}% ({tot-imp}/{tot} pertencem) | {time.time()-t0:.0f}s | ~${cost:.2f}")
print("=" * 64)
sujas = sorted([(i, r[1], r[0]) for i, r in result.items() if r[1] >= 2], key=lambda x: -x[1])
print(f" FOLHAS SUJAS (>=2 de {PER} fora): {len(sujas)}")
for i, im, n in sujas[:25]:
    print(f"   {im}/{n}  {leaves[i-1][0]}")
    for s in result[i][2][:3]:
        print(f"        ↳ sugerido: {s}")
out = TAX / f"{SLUG}.purity.json"
out.write_text(json.dumps({"pureza_pct": (tot-imp)/tot*100,
                           "sujas": [{"folha": leaves[i-1][0], "fora": im, "n": n, "sug": result[i][2]} for i, im, n in sujas]},
                          ensure_ascii=False, indent=1), encoding="utf-8")
print(f"\n[salvo] {out.name}")
