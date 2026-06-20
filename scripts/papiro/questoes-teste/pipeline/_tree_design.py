"""Opus DESENHA a árvore (top-down pedagógico) a partir do inventário bottom-up + buracos
forçados + arcabouço da matéria. Não reorganiza TEC — projeta do zero com regras de qualidade.
Saída: tax/<slug>.tree_design.json (mesmo schema do tree_v3, pronto pra _place_all/_db_load).
Uso: python _tree_design.py <slug> "<materia>"
"""
import io, sys, json, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from pathlib import Path

SLUG = sys.argv[1]
MATERIA = sys.argv[2]
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
inv = json.load(open(TAX / f"{SLUG}.inventory.json", encoding="utf-8"))["topicos"]
INV_STR = "\n".join(f'- {t["nome"]} ({t["freq"]})' for t in inv)

# arcabouço opcional (ementa de manual/cursinho) — esqueleto de estrutura + nomes canônicos
EMENTA_F = TAX / f"{SLUG}.ementa.txt"
EMENTA = EMENTA_F.read_text(encoding="utf-8") if EMENTA_F.exists() else ""

# buracos do cruzamento com TEC (folha própria obrigatória) — por matéria, em <slug>.gaps.txt
GAPS_F = TAX / f"{SLUG}.gaps.txt"
GAPS_STR = GAPS_F.read_text(encoding="utf-8").strip() if GAPS_F.exists() else "(nenhum informado — confie no inventário + arcabouço)"

SYSTEM = f"""Você é o MELHOR professor de {MATERIA} do Brasil, montando a árvore de tópicos DEFINITIVA de um banco de questões — a que faz o aluno dizer "essa é perfeita".

Você recebe:
1) INVENTÁRIO bottom-up: tópicos realmente cobrados nas questões, com frequência (quanto cai). É o CHÃO — o que existe de verdade.
2) BURACOS: tópicos que DEVEM ter folha própria (não podem ser lumpados em outro).
3) ARCABOUÇO: quando fornecido (ementa de manual/cursinho), use-o como ESQUELETO de estrutura e fonte dos nomes canônicos de tema/subtema. Senão, use seu conhecimento da estrutura da matéria (no DConst foi a CF). ATENÇÃO: o arcabouço dá ESTRUTURA e NOMES, não a lista de folhas — o VOLUME das questões (inventário) decide a granularidade; tópico da ementa com zero questão não vira folha pesada; o que cai muito você divide.

PROJETE uma árvore de 3 NÍVEIS: tema (área macro) → subtema (bloco) → ponto (FOLHA = 1 aula de cursinho).

REGRAS DE OURO (inegociáveis):
• 1 FOLHA = 1 tópico de estudo coerente, do tamanho de UMA AULA. O aluno estuda aquilo como unidade.
• NÃO LUMPAR coisas distintas. ERRADO: "Câmara dos Deputados e Senado Federal" (são 2 folhas), "Conceito, Estrutura, Supremacia e Classificação das Constituições" (são ~3-4 folhas), "Advocacia Pública e Defensoria" (2 folhas). Só junte o que é REALMENTE inseparável.
• NÃO descer ao micro-detalhe da questão. "Número de deputados", "idade mínima para deputado" → tudo é a folha "Estatuto dos Congressistas/Deputados". Use a frequência: micro-itens de freq 1-3 do inventário você FUNDE no pai certo.
• DIVIDIR o que é pesado demais. "Direitos e garantias fundamentais" (freq alta) deve virar várias folhas (direitos individuais, coletivos, vida/igualdade/legalidade, etc.). "Direitos dos trabalhadores" idem.
• PROIBIDO balde-lixo: NADA de "Jurisprudência sobre X" nem "Questões mescladas de X". Jurisprudência entra na folha substantiva.
• Os BURACOS listados DEVEM aparecer como folha própria.
• Nomes CURTOS e limpos (sem "art. X da CF").
• Profundidade UNIFORME (todo tema tem subtemas; folhas no mesmo nível conceitual).
• Cobertura: todo tópico relevante do inventário tem que ter casa. Nada de inventar folha sem lastro nas questões.

Para cada FOLHA dê:
- "nome": curto
- "definicao": 1 frase do que cai ali (ajuda a classificar questões depois)
- "desempate": (opcional) regra curta vs folha vizinha confundível (ex.: "ADI: lei em tese; ADPF: ato não alcançado por ADI/lei pré-constitucional")

RESPONDA APENAS JSON neste schema:
{{"temas":[{{"nome":"...","subtemas":[{{"nome":"...","pontos":[{{"nome":"...","definicao":"...","desempate":"..."}}]}}]}}]}}
Se um subtema for ele mesmo a folha (raro), pode vir sem "pontos" mas com "definicao"."""

_arc = f"ARCABOUÇO (esqueleto de estrutura/nomes — NÃO é lista de folhas):\n{EMENTA}\n\n" if EMENTA else ""
USER = f"{_arc}INVENTÁRIO (tópico + frequência na amostra):\n{INV_STR}\n\nBURACOS (folha própria obrigatória):\n{GAPS_STR}\n\nProjete a árvore definitiva de {MATERIA}."

body = {"model": "anthropic/claude-opus-4.8",
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": USER}],
        "temperature": 0.2, "max_tokens": 24000, "reasoning": {"enabled": False}}
print("[opus] desenhando…")
r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                  headers={"Authorization": f"Bearer {ORKEY}"}, json=body, timeout=600)
if r.status_code != 200:
    print("ERRO", r.status_code, r.text[:300]); sys.exit(1)
d = r.json()
c = d["choices"][0]["message"]["content"]
tree = json.loads(c[c.find("{"): c.rfind("}") + 1])

# normaliza + conta
temas = tree["temas"]
nfolhas = 0
for t in temas:
    for s in t.get("subtemas", []):
        pts = s.get("pontos", [])
        nfolhas += len(pts) if pts else 1
OUTF = TAX / f"{SLUG}.tree_design.json"
OUTF.write_text(json.dumps(tree, ensure_ascii=False, indent=1), encoding="utf-8")

u = d.get("usage", {})
cost = u.get("prompt_tokens", 0)/1e6*5 + u.get("completion_tokens", 0)/1e6*25
print(f"[ok] {len(temas)} temas · {sum(len(t.get('subtemas',[])) for t in temas)} subtemas · {nfolhas} folhas | ~${cost:.2f}")
print(f"[salvo] {OUTF.name}\n")
for t in temas:
    print(f"# {t['nome']}")
    for s in t.get("subtemas", []):
        pts = s.get("pontos", [])
        print(f"   - {s['nome']}" + ("" if pts else "  (folha)"))
        for pt in pts:
            print(f"       . {pt['nome']}")
