"""Re-avalia vínculos SECUNDÁRIOS (principal=false) e promove os legítimos a forte.

Para cada questão com tema(s) secundário(s), o DeepSeek decide por tema:
  - FORTE: responder/eliminar EXIGE conhecer esse tema (a questão cobra de verdade) → entra no filtro
  - FRACO: o tema só é CITADO (ex.: nome num distrator errado) → fica fora do filtro de tópico
Âncora = comando + RESPOSTA CORRETA (gabarito). Grava papiro.q_node_questao.forte=true nos fortes.

Uso:
  python _reeval_secundarios.py <materia> --test 50      # dry-run: mostra amostra, NÃO grava
  python _reeval_secundarios.py <materia>                # roda tudo e grava
"""
import io, json, sys, threading, time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, unquote
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

MATERIA = sys.argv[1]
TEST_N = None
if "--test" in sys.argv:
    i = sys.argv.index("--test")
    TEST_N = int(sys.argv[i + 1]) if len(sys.argv) > i + 1 else 50

DS_URL = "https://api.deepseek.com/chat/completions"
WORKERS, BATCH = 16, 25


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
p = urlparse(envval("DATABASE_URL"))
import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                        dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
cur = conn.cursor()
cur.execute("""
    select q.id, q.enunciado, q.alternativas, q.resposta_correta,
           m.node_id, n.nome, coalesce(n.definicao, n.desempate, n.artigo, '')
    from papiro.q_node_questao m
    join papiro.q_node n on n.id = m.node_id
    join public.questoes q on q.id = m.questao_id
    where n.materia = %s and not m.principal
    order by q.id
""", (MATERIA,))

# agrupa por questão: cada item carrega o texto + lista de nós secundários candidatos
items = {}
for qid, enun, alts, resp, node_id, nome, ndef in cur.fetchall():
    al = " ".join(a if isinstance(a, str) else str(a) for a in alts) if isinstance(alts, (list, tuple)) else ""
    it = items.setdefault(qid, {"txt": (enun + " " + al)[:1400], "resp": resp or "", "cand": []})
    it["cand"].append({"node_id": node_id, "nome": nome, "def": (ndef or "")[:80]})

qids = list(items.keys())
if TEST_N:
    qids = qids[:TEST_N]
print(f"[pull] {len(items):,} questões com secundário | processando {len(qids):,}"
      f"{' (TEST dry-run)' if TEST_N else ''}")

SYSTEM = (
    "Você classifica a RELEVÂNCIA de temas SECUNDÁRIOS numa questão de concurso. "
    "Para cada tema candidato decida:\n"
    "- forte: responder a questão ou eliminar alternativas EXIGE dominar esse tema (a questão o cobra de verdade).\n"
    "- fraco: o tema só é CITADO/tangenciado (ex.: aparece como nome numa alternativa errada, sem precisar dominá-lo).\n"
    "Âncora: use o COMANDO e a RESPOSTA CORRETA. Na dúvida entre os dois, escolha fraco (preferir folha pura). "
    "Responda APENAS JSON {\"<j>\":{\"<node_id>\":\"forte|fraco\"}} para cada item."
)


def build_user(batch):
    parts = []
    for j, qid in enumerate(batch):
        it = items[qid]
        cand = "; ".join(f'{c["node_id"]}={c["nome"]}' for c in it["cand"])
        parts.append(f'[{j}] QUESTÃO: {it["txt"]}\nRESPOSTA CORRETA: {it["resp"][:200]}\nTEMAS CANDIDATOS: {cand}')
    return "=== %d ITENS ===\n%s" % (len(batch), "\n\n".join(parts))


result = {}            # qid -> {node_id: 'forte'|'fraco'}
usage = {"in": 0, "out": 0}
lock = threading.Lock()
done = [0]


def do_batch(batch):
    body = {"model": "deepseek-v4-flash",
            "messages": [{"role": "system", "content": SYSTEM},
                         {"role": "user", "content": build_user(batch)}],
            "temperature": 0, "max_tokens": 4000, "thinking": {"type": "disabled"},
            "response_format": {"type": "json_object"}}
    for attempt in range(4):
        try:
            r = requests.post(DS_URL, headers={"Authorization": f"Bearer {DKEY}"}, json=body, timeout=180)
            if r.status_code != 200:
                time.sleep(2 + attempt * 2); continue
            d = r.json()
            c = ((d.get("choices") or [{}])[0].get("message") or {}).get("content")
            if not c or not c.strip():
                time.sleep(2 + attempt * 2); continue
            res = json.loads(c[c.find("{"): c.rfind("}") + 1])
            u = d.get("usage", {})
            with lock:
                usage["in"] += u.get("prompt_tokens", 0); usage["out"] += u.get("completion_tokens", 0)
                for j, qid in enumerate(batch):
                    v = res.get(str(j)) or res.get(j) or {}
                    if isinstance(v, dict):
                        result[qid] = {int(k): str(val).lower() for k, val in v.items() if str(k).isdigit()}
                done[0] += len(batch)
                if done[0] % 500 < BATCH:
                    print(f"  {done[0]:,}/{len(qids):,}")
            return
        except Exception:
            time.sleep(2 + attempt * 2)


batches = [qids[k:k + BATCH] for k in range(0, len(qids), BATCH)]
t0 = time.time()
with ThreadPoolExecutor(max_workers=WORKERS) as ex:
    list(ex.map(do_batch, batches))

# consolida: pares (qid, node_id) marcados forte
fortes = []
fraco_n = 0
for qid in qids:
    decided = result.get(qid, {})
    for c in items[qid]["cand"]:
        verdict = decided.get(c["node_id"], "fraco")  # default conservador
        if verdict.startswith("forte"):
            fortes.append((qid, c["node_id"]))
        else:
            fraco_n += 1

cost = usage["in"] / 1e6 * 0.14 + usage["out"] / 1e6 * 0.28
print(f"\n[modelo] in={usage['in']:,} out={usage['out']:,} ~${cost:.3f} | {time.time()-t0:.0f}s")
print(f"[veredito] FORTE={len(fortes):,}  FRACO={fraco_n:,}  "
      f"(forte = {len(fortes)/max(1,len(fortes)+fraco_n)*100:.1f}% dos secundários avaliados)")

if TEST_N:
    print("\n=== AMOSTRA (dry-run, nada gravado) ===")
    shown = 0
    for qid in qids:
        decided = result.get(qid, {})
        for c in items[qid]["cand"]:
            verdict = decided.get(c["node_id"], "fraco")
            tag = "FORTE" if verdict.startswith("forte") else "fraco"
            print(f"\n[{tag}] nó {c['node_id']} = {c['nome']}")
            print(f"   Q: {items[qid]['txt'][:160]}")
            print(f"   ✓ {items[qid]['resp'][:90]}")
            shown += 1
            if shown >= 25:
                break
        if shown >= 25:
            break
    print("\n(TEST: revise a qualidade. Pra gravar, rode sem --test.)")
    cur.close(); conn.close()
    sys.exit(0)

# grava forte=true nos legítimos
if fortes:
    from psycopg2.extras import execute_values
    execute_values(cur,
                   "update papiro.q_node_questao m set forte = true "
                   "from (values %s) as v(qid, nid) "
                   "where m.questao_id = v.qid and m.node_id = v.nid and not m.principal",
                   fortes, page_size=5000)
    conn.commit()
print(f"[gravado] {len(fortes):,} vínculos promovidos a forte. Filtro agora = principal + forte.")
cur.close(); conn.close()
