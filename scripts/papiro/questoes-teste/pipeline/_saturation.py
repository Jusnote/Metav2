"""Prova de saturação SEM embedding: o DeepSeek lê questão por questão mantendo uma LISTA
CANÔNICA crescente. Para cada questão ele decide: o conceito já está na lista (reusa o nº)
ou é novo (cria). A fusão é por entendimento do modelo, não por cosseno.
Mostra a curva: tamanho da lista canônica vs questões processadas (prova que satura).
Uso: python _saturation.py "<materia>" [N] [batch]
"""
import io, sys, json, time, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from urllib.parse import urlparse, unquote

MATERIA = sys.argv[1] if len(sys.argv) > 1 else "Direito Constitucional"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 2000
B = int(sys.argv[3]) if len(sys.argv) > 3 else 30

def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v: val = v
    return val

DKEY = envval("DEEPSEEK_API_KEY")
p = urlparse(envval("DATABASE_URL"))
import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                        dbname="postgres", sslmode="disable", connect_timeout=30)
cur = conn.cursor()
cur.execute("""select id, enunciado, alternativas, resposta_correta from questoes
               where materia=%s and coalesce(anulada,false)=false and enunciado is not null
               and length(enunciado)>20 order by random() limit %s""", (MATERIA, N))
QS = []
for qid, enun, alts, resp in cur.fetchall():
    al = " ".join(a if isinstance(a, str) else str(a) for a in alts) if isinstance(alts, (list, tuple)) else ""
    QS.append((enun + " " + al)[:1000] + (f" [RESP: {str(resp)[:110]}]" if resp else ""))
cur.close(); conn.close()
print(f"[pull] {len(QS):,} questões de {MATERIA} | batch={B}")

canon = []          # lista canônica de conceitos (str)
curve = []          # (n_processadas, tamanho_lista)
usage = {"in": 0, "out": 0}

def call(system, user):
    body = {"model": "deepseek-v4-flash", "messages": [{"role": "system", "content": system},
            {"role": "user", "content": user}], "temperature": 0, "max_tokens": 2500,
            "thinking": {"type": "disabled"}, "response_format": {"type": "json_object"}}
    for _ in range(4):
        try:
            r = requests.post("https://api.deepseek.com/chat/completions",
                              headers={"Authorization": f"Bearer {DKEY}"}, json=body, timeout=120)
            if r.status_code != 200:
                time.sleep(2); continue
            d = r.json(); c = d["choices"][0]["message"]["content"]
            u = d.get("usage", {}); usage["in"] += u.get("prompt_tokens", 0); usage["out"] += u.get("completion_tokens", 0)
            return json.loads(c[c.find("{"):c.rfind("}")+1])
        except Exception:
            time.sleep(2)
    return {}

t0 = time.time()
for k in range(0, len(QS), B):
    batch = QS[k:k+B]
    lista = "\n".join(f"{i+1}. {c}" for i, c in enumerate(canon)) or "(vazia)"
    system = (
        "Você classifica cada questão num TÓPICO DE ESTUDO e mantém uma LISTA CANÔNICA de tópicos.\n"
        "GRANULARIDADE: o tópico é o nível de um CAPÍTULO DE APOSTILA / FOLHA DE ÁRVORE — ex.: "
        "'Medidas Provisórias', 'STF - competências', 'Mandado de Segurança', 'Repartição de "
        "competências', 'Controle difuso'. NUNCA o micro-detalhe da questão (NÃO: 'número de "
        "deputados por território', 'competência municipal em educação' — isso é detalhe, "
        "agrupe em 'Câmara dos Deputados' / 'Competências dos Municípios').\n"
        "REGRA DE OURO: prefira FORTEMENTE reusar um tópico existente (reuse o número). Só crie "
        "tópico NOVO se nenhum capítulo existente abarcar. Um bom tópico cobre dezenas de questões.\n"
        "Para cada questão devolva {\"id\": N} (nº existente) OU {\"id\": 0, \"novo\": \"topico\"}.\n"
        "Responda APENAS JSON {\"<j>\":{\"id\":N,\"novo\":\"...\"}}.\n\nLISTA CANÔNICA ATUAL:\n" + lista)
    user = "=== QUESTOES ===\n" + "\n\n".join(f"[{j}] {q}" for j, q in enumerate(batch))
    res = call(system, user)
    for j in range(len(batch)):
        v = res.get(str(j)) or {}
        cid = v.get("id", 0)
        if isinstance(cid, int) and 1 <= cid <= len(canon):
            pass  # reusou existente
        else:
            novo = (v.get("novo") or "").strip().lower()
            if novo:
                # evita duplicata exata óbvia
                if novo not in [c.lower() for c in canon]:
                    canon.append(novo)
    curve.append((min(k + B, len(QS)), len(canon)))
    print(f"  {min(k+B,len(QS)):>5,}/{len(QS):,} -> lista canônica: {len(canon)} conceitos")

cost = usage["in"]/1e6*0.14 + usage["out"]/1e6*0.28
print("\n" + "="*64)
print(f" CONCEITOS DISTINTOS (DeepSeek, fusão por entendimento): {len(canon)}")
print(f" {len(QS):,} questões | {time.time()-t0:.0f}s | ~${cost:.3f}")
print("="*64)
print(" CURVA DE SATURAÇÃO (conceitos novos por bloco):")
prev = 0
for n, d in curve:
    novos = d - prev; prev = d
    print(f"   {n:>5,} questões -> {d:>4} conceitos  (+{novos} novos) {'#'*novos}")
print("="*64)
if len(curve) >= 4:
    early = curve[1][1] - curve[0][1]
    late = curve[-1][1] - curve[-2][1]
    print(f" Blocos iniciais traziam ~{early} novos; último trouxe {late}.")
    print(f" -> {'SATURANDO (curva achatando)' if late <= max(1, early*0.4) else 'ainda subindo'}")
print("\n--- LISTA CANÔNICA FINAL (amostra) ---")
for i, c in enumerate(canon[:60], 1):
    print(f" {i:>3}. {c}")
