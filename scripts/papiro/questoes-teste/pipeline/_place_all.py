"""Coloca TODAS as questões de uma matéria na árvore — DeepSeek DIRETO, concorrente.
Válvula de escape (0=não encaixa) + validação de id no código. Salva o mapa questão→nó(s).
Node list vai no system (prefixo estável → cache hit do DeepSeek). PRODUÇÃO.

Uso: python _place_all.py <slug> "<materia>" [tree_file]
"""
import io, json, re, sys, threading, time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, unquote
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
SLUG = sys.argv[1]
MATERIA = sys.argv[2]
# flags: --min-len N (só >= N chars) · --merge (atualiza placement) · --refit (re-coloca só as no-fit existentes)
MINLEN = int(sys.argv[sys.argv.index("--min-len") + 1]) if "--min-len" in sys.argv else 0
MERGE = "--merge" in sys.argv
REFIT = "--refit" in sys.argv
_pos = [a for a in sys.argv[3:] if not a.startswith("--") and not a.isdigit()]
TREEF = _pos[0] if _pos else f"{SLUG}.tree_v2.json"
CACHE = Path(r"D:\inventario-v2\_scale_probe\tax")
DS_URL = "https://api.deepseek.com/chat/completions"
WORKERS, BATCH = 24, 40


def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v:
                val = v
    return val


DKEY = envval("DEEPSEEK_API_KEY")
tree = json.loads((CACHE / TREEF).read_text(encoding="utf-8"))
SUB = []
for t in tree["temas"]:
    for s in t["subtemas"]:
        pts = s.get("pontos", [])
        if pts:  # 3 níveis: folhas = pontos atômicos
            for p in pts:
                SUB.append({"id": len(SUB) + 1, "tema": t["nome"],
                            "nome": f'{s["nome"]} › {p["nome"]}', "def": p.get("artigo", "")})
        else:  # subtema-folha
            SUB.append({"id": len(SUB) + 1, "tema": t["nome"], "nome": s["nome"],
                        "def": s.get("definicao") or s.get("o_que_cai", "")})
N_SUB = len(SUB)
SUBS_STR = "\n".join(f'{s["id"]}. {s["tema"]} › {s["nome"]} — {s["def"][:120]}' for s in SUB)
SYSTEM = (f"Você classifica questões de «{MATERIA}» na taxonomia abaixo. Leia o enunciado, TODAS as "
          "alternativas e a RESPOSTA CORRETA (entre colchetes). Para CADA questão devolva:\n"
          "- n: 1 a 3 ids de subtemas (PRINCIPAL primeiro), OU 0 se nenhum encaixar. O PRINCIPAL é o tema que o "
          "COMANDO + a RESPOSTA CORRETA realmente avaliam — NUNCA o tema só citado numa alternativa ERRADA. "
          "Ex.: se a resposta certa é sustar decreto pelo Congresso e uma alternativa errada cita 'ADI', o "
          "principal é Congresso, não ADI. Atenção a distinções finas: controle ESTADUAL (representação ao TJ) "
          "≠ ADI federal (STF).\n"
          "- f: subconjunto de n (sem o principal) marcado FORTE — a questão cobra o tema de verdade "
          "(responder/eliminar EXIGE dominá-lo). Tema só CITADO num distrator NÃO entra em f.\n"
          "- c: confiança 1=alta, 2=baixa (use 2 quando hesitar entre dois subtemas).\n"
          "IMPORTANTE: questão sobre uma LEI específica/nova (ex.: Lei 14.133 vs 8.666, decreto de pregão "
          "eletrônico, RDC) vai na MESMA folha CONCEITUAL correspondente (Licitação/Contratos/Dispensa/"
          "Inexigibilidade/Pregão/etc. cobrem TODAS as leis do tema). NÃO devolva 0 só porque é lei nova/específica — "
          "só devolva 0 se o ASSUNTO realmente não existe na taxonomia.\n"
          "Responda APENAS JSON {\"<j>\":{\"n\":[ids],\"f\":[ids],\"c\":1}}.\n\nSUBTEMAS:\n" + SUBS_STR)

# ---- pull all (cache) ----
ALLF = CACHE / f"{SLUG}.all.json"
PLACEF0 = CACHE / f"{SLUG}.placement.json"
if REFIT:
    # re-coloca SÓ as questões que ficaram no-fit no placement existente
    plc0 = json.loads(PLACEF0.read_text(encoding="utf-8")).get("placement", {})
    nofit_ids = [int(q) for q, v in plc0.items() if not v.get("n") or v["n"][0] == 0]
    p = urlparse(envval("DATABASE_URL"))
    import psycopg2
    conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                            dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
    cur = conn.cursor()
    cur.execute("""select id, enunciado, alternativas, resposta_correta from public.questoes where id = any(%s)""",
                (nofit_ids,))
    ids, txt = [], []
    for qid, enun, alts, resp in cur.fetchall():
        al = " ".join(alts) if isinstance(alts, (list, tuple)) else ""
        base = (enun + " " + al)[:1150]
        if resp:
            base += f" [RESPOSTA CORRETA: {str(resp)[:160]}]"
        ids.append(qid); txt.append(base)
    cur.close(); conn.close()
    print(f"[pull] {len(ids):,} questões no-fit pra re-rotear — modo refit")
elif MINLEN:
    # modo direcionado: re-puxa do banco SÓ as questões longas (>= MINLEN), ignora cache
    p = urlparse(envval("DATABASE_URL"))
    import psycopg2
    conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                            dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
    cur = conn.cursor()
    cur.execute("""select id, enunciado, alternativas, resposta_correta from public.questoes where materia=%s
                   and coalesce(anulada,false)=false and enunciado is not null and length(enunciado)>20""", (MATERIA,))
    ids, txt = [], []
    for qid, enun, alts, resp in cur.fetchall():
        al = " ".join(alts) if isinstance(alts, (list, tuple)) else ""
        if len((enun or "") + " " + al) < MINLEN:
            continue
        base = (enun + " " + al)[:1150]
        if resp:
            base += f" [RESPOSTA CORRETA: {str(resp)[:160]}]"
        ids.append(qid); txt.append(base)
    cur.close(); conn.close()
    print(f"[pull] {len(ids):,} questões longas (>= {MINLEN} chars) — modo direcionado")
elif ALLF.exists():
    d = json.loads(ALLF.read_text(encoding="utf-8")); ids, txt = d["ids"], d["txt"]
    print(f"[pull] cache {len(ids):,}")
else:
    p = urlparse(envval("DATABASE_URL"))
    import psycopg2
    conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                            dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
    cur = conn.cursor()
    cur.execute("""select id, enunciado, alternativas, resposta_correta from public.questoes where materia=%s
                   and coalesce(anulada,false)=false and enunciado is not null and length(enunciado)>20""", (MATERIA,))
    ids, txt = [], []
    for qid, enun, alts, resp in cur.fetchall():
        al = " ".join(alts) if isinstance(alts, (list, tuple)) else ""
        # trunca enunciado+alternativas ANTES de anexar o gabarito, pra ele nunca ser cortado
        base = (enun + " " + al)[:1150]
        if resp:
            base += f" [RESPOSTA CORRETA: {str(resp)[:160]}]"
        ids.append(qid); txt.append(base)
    cur.close(); conn.close()
    ALLF.write_text(json.dumps({"ids": ids, "txt": txt}, ensure_ascii=False), encoding="utf-8")
    print(f"[pull] {len(ids):,} questões")

batches = [list(range(k, min(k + BATCH, len(ids)))) for k in range(0, len(ids), BATCH)]
placement, usage = {}, {"in": 0, "out": 0}
lock = threading.Lock()
done = [0]


def do_batch(batch):
    qs = "\n\n".join(f"[{j}] {txt[i]}" for j, i in enumerate(batch))  # txt já vem limitado c/ gabarito preservado
    body = {"model": "deepseek-v4-flash", "messages": [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"=== {len(batch)} QUESTÕES ===\n{qs}"}],
            "temperature": 0, "max_tokens": 4000, "thinking": {"type": "disabled"}}
    for _ in range(4):
        try:
            r = requests.post(DS_URL, headers={"Authorization": f"Bearer {DKEY}", "Content-Type": "application/json"},
                              json=body, timeout=180)
        except Exception:
            time.sleep(4); continue
        if r.status_code == 200:
            d = r.json()
            c = ((d.get("choices") or [{}])[0].get("message") or {}).get("content")
            u = d.get("usage", {})
            if c:
                t = re.sub(r"```(json)?", "", c); a, b = t.find("{"), t.rfind("}")
                try:
                    res = json.loads(t[a:b + 1])
                except Exception:
                    res = {}
                with lock:
                    usage["in"] += u.get("prompt_tokens", 0); usage["out"] += u.get("completion_tokens", 0)
                    for j, i in enumerate(batch):
                        v = res.get(str(j)) or res.get(j) or {}
                        ns = [int(x) for x in v.get("n", []) if str(x).isdigit() and 0 <= int(x) <= N_SUB]
                        # f = secundários FORTES; só vale se também estiver em n e não for o principal
                        fs = [int(x) for x in v.get("f", []) if str(x).isdigit() and 1 <= int(x) <= N_SUB]
                        fs = [x for x in fs if x in ns[1:]]
                        placement[ids[i]] = {"n": ns, "f": fs, "c": int(v.get("c", 1))}
                    done[0] += 1
                    if done[0] % 50 == 0:
                        print(f"  {done[0]}/{len(batches)} lotes ({len(placement):,} colocadas)", flush=True)
                return
        time.sleep(4)
    with lock:
        done[0] += 1


print(f"Colocando {len(ids):,} questões em {N_SUB} nós (DeepSeek direto, {WORKERS} concorrentes)…")
t0 = time.time()
with ThreadPoolExecutor(max_workers=WORKERS) as ex:
    list(ex.map(do_batch, batches))
dt = time.time() - t0

naofit = [q for q, v in placement.items() if not v["n"] or v["n"][0] == 0]
dist = Counter((v["n"][0] for v in placement.values() if v["n"] and v["n"][0] > 0))
NAME = {s["id"]: f'{s["tema"]} › {s["nome"]}' for s in SUB}
cost = usage["in"] / 1e6 * 0.14 + usage["out"] / 1e6 * 0.28
PLACEF = CACHE / f"{SLUG}.placement.json"
if MERGE and PLACEF.exists():
    # atualiza só as questões reprocessadas, preserva o resto do placement
    existing = json.loads(PLACEF.read_text(encoding="utf-8"))
    base_plc = existing.get("placement", {})
    upd = {str(k): v for k, v in placement.items()}
    base_plc.update(upd)
    placement_out = base_plc
    print(f"[merge] {len(upd):,} questões atualizadas sobre {len(base_plc):,} totais")
else:
    placement_out = placement
PLACEF.write_text(
    json.dumps({"materia": MATERIA, "tree": TREEF, "placement": placement_out}, ensure_ascii=False), encoding="utf-8")

print("\n" + "=" * 70)
print(f" {MATERIA}: {len(placement):,}/{len(ids):,} colocadas | {dt/60:.1f} min | ${cost:.2f} (in {usage['in']:,}/out {usage['out']:,})")
print(f" não-encaixa: {len(naofit):,} ({100*len(naofit)/max(1,len(ids)):.1f}%)")
print("=" * 70)
for nid, c in dist.most_common():
    print(f"  {c:>7,}  {NAME.get(nid)}")
print(f"\n[salvo] {SLUG}.placement.json")
