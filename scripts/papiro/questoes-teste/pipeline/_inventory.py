"""Inventário bottom-up: DeepSeek lê questão por questão e mantém uma LISTA CANÔNICA de
TÓPICOS DE ESTUDO (nível de aula), contando a frequência de cada um. Sem embedding —
a fusão é por entendimento do modelo. Saída: tax/<slug>.inventory.json (tópico + frequência),
que alimenta o Opus pra desenhar a árvore.
Uso: python _inventory.py "<materia>" <slug> [N] [batch]
"""
import io, sys, json, time, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
from pathlib import Path
from urllib.parse import urlparse, unquote

MATERIA = sys.argv[1]
SLUG = sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 4000
B = int(sys.argv[4]) if len(sys.argv) > 4 else 30
OUT = Path(r"D:\inventario-v2\_scale_probe\tax") / f"{SLUG}.inventory.json"

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

canon = []        # tópicos canônicos
freq = []         # frequência paralela
curve = []
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

SYS_RULES = (
    "Você classifica cada questão num TÓPICO DE ESTUDO e mantém uma LISTA CANÔNICA de tópicos.\n"
    "GRANULARIDADE = nível de UMA AULA de cursinho. Regra de separação:\n"
    " • SEPARE tópicos distintos que o aluno estuda em aulas diferentes. Ex.: 'Conceito de "
    "Constituição', 'Classificação das Constituições' e 'Supremacia da Constituição' são 3 tópicos, "
    "NÃO um só. 'Mandado de Segurança' ≠ 'Habeas Corpus'. 'Advocacia Pública' ≠ 'Defensoria Pública'.\n"
    " • NÃO desça ao micro-detalhe da questão. Ex.: 'número de deputados', 'idade para deputado', "
    "'imunidade de deputado' → tudo é o tópico 'Câmara dos Deputados / Estatuto dos Congressistas'.\n"
    " • PROIBIDO criar tópico-balde de 'jurisprudência sobre X' — a questão de jurisprudência vai no "
    "tópico substantivo (um julgado sobre ADI é o tópico 'ADI').\n"
    "REUSE FORTEMENTE um tópico existente (responda o número). Só crie NOVO se nenhum existente couber.\n"
    "Para cada questão: {\"id\": N} (existente) OU {\"id\": 0, \"novo\": \"topico curto\"}.\n"
    "Responda APENAS JSON {\"<j>\":{\"id\":N,\"novo\":\"...\"}}.\n\nLISTA CANÔNICA ATUAL:\n")

# parada por saturação: para quando 2 janelas seguidas de ~1000 questões trazem <= SAT tópicos novos
FLOOR, WINDOW, SAT = 18000, 990, 5
last_check, topics_at_check, low_windows, processed = 0, 0, 0, 0
t0 = time.time()
for k in range(0, len(QS), B):
    batch = QS[k:k+B]
    lista = "\n".join(f"{i+1}. {c}" for i, c in enumerate(canon)) or "(vazia)"
    user = "=== QUESTOES ===\n" + "\n\n".join(f"[{j}] {q}" for j, q in enumerate(batch))
    res = call(SYS_RULES + lista, user)
    for j in range(len(batch)):
        v = res.get(str(j)) or {}
        cid = v.get("id", 0)
        if isinstance(cid, int) and 1 <= cid <= len(canon):
            freq[cid-1] += 1
        else:
            novo = (v.get("novo") or "").strip()
            if novo:
                low = [c.lower() for c in canon]
                if novo.lower() in low:
                    freq[low.index(novo.lower())] += 1
                else:
                    canon.append(novo); freq.append(1)
    processed = min(k + B, len(QS))
    if (k // B) % 10 == 0 or processed >= len(QS):
        curve.append((processed, len(canon)))
        print(f"  {processed:>5,}/{len(QS):,} -> {len(canon)} tópicos")
    # checa saturação a cada janela
    if processed - last_check >= WINDOW:
        novos_janela = len(canon) - topics_at_check
        if processed >= FLOOR:
            low_windows = low_windows + 1 if novos_janela <= SAT else 0
            print(f"    [saturação] janela {last_check:,}-{processed:,}: +{novos_janela} novos (baixas seguidas: {low_windows})")
            if low_windows >= 2:
                print(f"    >>> SATUROU em {processed:,} questões — parando (teto era {len(QS):,}).")
                break
        topics_at_check, last_check = len(canon), processed

inv = sorted(zip(canon, freq), key=lambda x: -x[1])
OUT.write_text(json.dumps({"materia": MATERIA, "amostra": len(QS),
                           "topicos": [{"nome": n, "freq": f} for n, f in inv]}, ensure_ascii=False, indent=1),
               encoding="utf-8")
cost = usage["in"]/1e6*0.14 + usage["out"]/1e6*0.28
print("\n" + "="*64)
print(f" INVENTÁRIO: {len(canon)} tópicos | amostra {len(QS):,} | {time.time()-t0:.0f}s | ~${cost:.2f}")
print(f" curva: " + " ".join(f"{n}:{d}" for n, d in curve))
print("="*64)
print(" TOP 35 tópicos por frequência:")
for n, f in inv[:35]:
    print(f"   {f:>4}  {n}")
print(f"\n[salvo] {OUT.name}")
