"""Bake-off de modelos de classificação: DeepSeek vs Gemini 2.5 Flash vs GPT-4.1-mini.
Mesmo prompt (gabarito-aware), mesmos casos. Side-by-side pra julgamento humano + agregados.
Uso: python _bakeoff.py
"""
import io, sys, json, time, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from pathlib import Path
from urllib.parse import urlparse, unquote

def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v: val = v
    return val

DKEY = envval("DEEPSEEK_API_KEY")
ORKEY = envval("OPENROUTER_API_KEY")
CACHE = Path(r"D:\inventario-v2\_scale_probe\tax")
tree = json.loads((CACHE / "dconst.tree_v3.json").read_text(encoding="utf-8"))
SUB = []
for t in tree["temas"]:
    for s in t["subtemas"]:
        pts = s.get("pontos", [])
        if pts:
            for p in pts:
                SUB.append({"id": len(SUB) + 1, "tema": t["nome"], "nome": f'{s["nome"]} > {p["nome"]}', "def": p.get("artigo", "")})
        else:
            SUB.append({"id": len(SUB) + 1, "tema": t["nome"], "nome": s["nome"], "def": s.get("definicao") or s.get("o_que_cai", "")})
NAME = {s["id"]: f'{s["tema"]} > {s["nome"]}' for s in SUB}
SHORT = {s["id"]: s["nome"][:38] for s in SUB}
SUBS_STR = "\n".join(f'{s["id"]}. {s["tema"]} > {s["nome"]} - {s["def"][:120]}' for s in SUB)
SYSTEM = ("Voce classifica questoes de Direito Constitucional na taxonomia abaixo. Leia enunciado, TODAS as "
          "alternativas e a RESPOSTA CORRETA (entre colchetes). Devolva:\n"
          "- n: 1 a 3 ids (PRINCIPAL primeiro) ou 0. O PRINCIPAL e o tema que o COMANDO + a RESPOSTA CORRETA "
          "avaliam, NUNCA o tema so citado numa alternativa ERRADA. Atencao: controle ESTADUAL (representacao "
          "ao TJ) != ADI federal (STF).\n"
          "- f: subconjunto de n (sem o principal) FORTE (responder exige dominar; tema so citado nao entra).\n"
          "- c: confianca 1=alta 2=baixa.\n"
          "Responda APENAS JSON {\"<j>\":{\"n\":[ids],\"f\":[ids],\"c\":1}}.\n\nSUBTEMAS:\n" + SUBS_STR)

# --- test set: casos conhecidos + amostra aleatoria ---
p = urlparse(envval("DATABASE_URL"))
import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                        dbname="postgres", sslmode="disable")
cur = conn.cursor()
KNOWN = {251418: "Congresso (NAO ADI)", 215157: "TJs Estaduais (NAO ADI)", 215645: "TJs Estaduais"}
cur.execute("""select id, enunciado, alternativas, resposta_correta, assunto from questoes
               where id = any(%s)""", (list(KNOWN.keys()),))
known_rows = cur.fetchall()
cur.execute("""select id, enunciado, alternativas, resposta_correta, assunto from questoes
               where materia='Direito Constitucional' and coalesce(anulada,false)=false
               and resposta_correta is not null and length(enunciado) between 80 and 1100
               order by id limit 15""")
rows = known_rows + cur.fetchall()
cur.close(); conn.close()

Q = []
for qid, enun, alts, resp, assunto in rows:
    al = " ".join(a if isinstance(a, str) else str(a) for a in alts) if isinstance(alts, (list, tuple)) else ""
    base = (enun + " " + al)[:1150] + (f" [RESPOSTA CORRETA: {str(resp)[:160]}]" if resp else "")
    Q.append({"id": qid, "txt": base, "resp": str(resp or "")[:60], "assunto": (assunto or "")[:40]})

USER = f"=== {len(Q)} QUESTOES ===\n" + "\n\n".join(f"[{j}] {q['txt']}" for j, q in enumerate(Q))


def call(model, endpoint, key, extra=None):
    body = {"model": model, "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": USER}],
            "temperature": 0, "max_tokens": 3000, "response_format": {"type": "json_object"}}
    if extra: body.update(extra)
    t0 = time.time()
    r = requests.post(endpoint, headers={"Authorization": f"Bearer {key}"}, json=body, timeout=240)
    dt = time.time() - t0
    if r.status_code != 200:
        return None, dt, f"HTTP {r.status_code}: {r.text[:120]}"
    d = r.json()
    c = ((d.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    try:
        res = json.loads(c[c.find("{"): c.rfind("}") + 1])
    except Exception as e:
        return None, dt, f"parse fail: {e}"
    u = d.get("usage", {})
    return res, dt, u


MODELS = [
    ("DeepSeek-v4-flash", "deepseek-v4-flash", "https://api.deepseek.com/chat/completions", DKEY, {"thinking": {"type": "disabled"}}),
    ("Gemini-2.5-flash", "google/gemini-2.5-flash", "https://openrouter.ai/api/v1/chat/completions", ORKEY, {"reasoning": {"enabled": False}}),
    ("GPT-4.1-mini", "openai/gpt-4.1-mini", "https://openrouter.ai/api/v1/chat/completions", ORKEY, None),
]

results = {}
for label, model, ep, key, extra in MODELS:
    res, dt, info = call(model, ep, key, extra)
    results[label] = res
    print(f"[{label}] {dt:.1f}s | {'OK' if res else 'FALHOU: ' + str(info)}")

print("\n" + "=" * 110)
print(f"{'Q / assunto TEC':<44}", end="")
for label, *_ in MODELS: print(f"{label:<22}", end="")
print()
print("=" * 110)
for j, q in enumerate(Q):
    tag = KNOWN.get(q["id"], "")
    head = f"{q['id']} {('['+tag+']') if tag else q['assunto']}"
    print(f"{head[:43]:<44}", end="")
    for label, *_ in MODELS:
        res = results.get(label) or {}
        v = res.get(str(j)) or {}
        ns = v.get("n", [])
        principal = "NO-FIT" if (not ns or ns[0] == 0) else SHORT.get(ns[0], f"#{ns[0]}")
        conf = v.get("c", "?")
        print(f"{(principal+' c'+str(conf))[:21]:<22}", end="")
    print()

# agregados
print("\n--- AGREGADOS ---")
for label, *_ in MODELS:
    res = results.get(label) or {}
    nofit = sum(1 for j in range(len(Q)) if not (res.get(str(j)) or {}).get("n") or (res.get(str(j)) or {}).get("n", [0])[0] == 0)
    lowc = sum(1 for j in range(len(Q)) if (res.get(str(j)) or {}).get("c") == 2)
    print(f"  {label:<20} no-fit={nofit}/{len(Q)}  baixa-conf={lowc}")
