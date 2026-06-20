"""3º NÍVEL (atômico): adiciona pontos sob cada subtema da v2, usando os assuntos atômicos
do TEC (com volume) como evidência de granularidade — sob a nossa hierarquia limpa.
Opus via OpenRouter. tax/<slug>.tree_v2.json + placement + TEC → tree_v3.json (3 níveis).
Uso: python _tree_3level.py <slug> "<materia>"
"""
import io, json, re, sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse, unquote
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
SLUG = sys.argv[1] if len(sys.argv) > 1 else "dconst"
MATERIA = sys.argv[2] if len(sys.argv) > 2 else "Direito Constitucional"
CACHE = Path(r"D:\inventario-v2\_scale_probe\tax")
OR_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-opus-4.8"


def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v:
                val = v
    return val


KEY = envval("OPENROUTER_API_KEY")
v2 = json.loads((CACHE / f"{SLUG}.tree_v2.json").read_text(encoding="utf-8"))
plc = json.loads((CACHE / f"{SLUG}.placement.json").read_text(encoding="utf-8"))["placement"]

# volume por subtema (ordem dos subtemas na v2)
SUB = [(t["nome"], s["nome"]) for t in v2["temas"] for s in t["subtemas"]]
vol = Counter(v["n"][0] for v in plc.values() if v.get("n") and v["n"][0] > 0)
v2_str = "\n".join(f"  [{i+1}] {tema} › {sub}  ({vol.get(i+1,0):,}q)" for i, (tema, sub) in enumerate(SUB))

# assuntos atômicos do TEC (com volume), tirando baldes
p = urlparse(envval("DATABASE_URL"))
import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                        dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
cur = conn.cursor()
cur.execute("""select assunto, count(*) c from public.questoes where materia=%s and assunto is not null
               group by assunto having count(*)>120 order by count(*) desc""", (MATERIA,))
junk = ("mesclad", "outras", "variad", "demais", "diversos")
tec = [(a, n) for a, n in cur.fetchall() if not any(j in a.lower() for j in junk)]
cur.close(); conn.close()
tec_str = "\n".join(f"  {n:>6,}  {a}" for a, n in tec)

SYSTEM = (f"Você é o Editor-Chefe de Taxonomia do PAPIRO. Vai adicionar um 3º NÍVEL (pontos atômicos) à "
          f"árvore de «{MATERIA}», que hoje tem 2 níveis (tema→subtema). Nomes de aluno, sem jargão "
          "(\"Dos/Da\", \"(arts...)\" só viram campo `artigo`).")
USER = (
    f"ÁRVORE ATUAL (2 níveis) com volume por subtema:\n{v2_str}\n\n"
    f"ASSUNTOS ATÔMICOS DO TEC (evidência de granularidade + volume — LIMPE os nomes):\n{tec_str}\n\n"
    "TAREFA: para CADA subtema, adicione um 3º nível de `pontos` atômicos (o que o aluno estuda como "
    "unidade: ex. Remédios → Mandado de Segurança, Habeas Corpus, Mandado de Injunção, Habeas Data, Ação "
    "Popular; Controle → ADI, ADC, ADPF, ADO, difuso, concentrado). Mapeie os assuntos do TEC relevantes "
    "sob o subtema certo, com NOMES LIMPOS. REGRA: só crie ponto com volume/relevância real (≳300q ou "
    "claramente um eixo de prova); subtema pequeno e coeso pode ficar SEM 3º nível (folha). Não invente; "
    "ancore nos assuntos do TEC + bom senso jurídico.\n\n"
    "Responda SOMENTE o JSON 3-níveis: {\"materia\",\"temas\":[{\"nome\",\"subtemas\":[{\"nome\",\"definicao\","
    "\"desempate\",\"pontos\":[{\"nome\",\"artigo\"}]}]}]}. Subtema folha: \"pontos\":[]. Sem texto fora.")

body = {"model": MODEL, "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": USER}],
        "temperature": 0, "max_tokens": 24000, "reasoning": {"enabled": False}}
print(f"Opus montando o 3º nível de {MATERIA} ({len(SUB)} subtemas, {len(tec)} assuntos TEC de evidência)…")
txt = None
for _ in range(3):
    r = requests.post(OR_URL, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}, json=body, timeout=900)
    if r.status_code == 200:
        txt = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content")
        if txt:
            break
    print("retry", r.status_code, r.text[:80])
if not txt:
    print("✗ sem resposta"); raise SystemExit
t = re.sub(r"```(json)?", "", txt); a, b = t.find("{"), t.rfind("}")
v3 = json.loads(t[a:b + 1])
(CACHE / f"{SLUG}.tree_v3.json").write_text(json.dumps(v3, ensure_ascii=False, indent=1), encoding="utf-8")
nt = len(v3["temas"]); nsub = sum(len(t["subtemas"]) for t in v3["temas"])
npt = sum(len(s.get("pontos", [])) for t in v3["temas"] for s in t["subtemas"])
folhas = npt + sum(1 for t in v3["temas"] for s in t["subtemas"] if not s.get("pontos"))
print(f"✓ 3 níveis: {nt} temas · {nsub} subtemas · {npt} pontos atômicos ({folhas} folhas no total) → {SLUG}.tree_v3.json")
print("\nExemplos:")
for t in v3["temas"][:4]:
    for s in t["subtemas"]:
        if s.get("pontos"):
            print(f"  {s['nome']} → {', '.join(p['nome'] for p in s['pontos'])}")
