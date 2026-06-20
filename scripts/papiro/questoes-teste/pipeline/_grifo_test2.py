"""Testa o extrator de grifo nos outros 2 tipos: CERTO/ERRADO e MC pura."""
import json, glob, re, pathlib
from dotenv import dotenv_values
import anthropic

FOLHA = pathlib.Path(r"D:\inventario-v2\direito-civil\da-responsabilidade-civil-arts-927-a-954")
qs = []
for f in glob.glob(str(FOLHA / "lote-*.json")):
    qs += json.loads(open(f, encoding="utf-8").read())


def item_based(q):
    return any(re.search(r"\b(I e |II e |III e |apenas I|somente I|I, II)", str(a)) for a in q.get("alternativas", []))


ce = [q for q in qs if q.get("tipoQuestao") == "CERTO_ERRADO"]
ce_errado = [q for q in ce if "errad" in str(q.get("gabarito", "")).lower()] or ce
pura = [q for q in qs if q.get("tipoQuestao") == "MULTIPLA_ESCOLHA" and not item_based(q)
        and not re.search(r"\bI\s*\.|\bII\s*\.", q.get("enunciado", ""))]

SYSTEM = (
    "Você é o ANOTADOR DE GRIFO do PAPIRO ('comentários do professor'): GRIFA os trechos ERRADOS "
    "de uma questão e mostra um tooltip ao passar o mouse.\n\n"
    "REGRA DE LOCALIZAÇÃO (varia com a estrutura):\n"
    "- Alternativas (A-E) são afirmações completas -> grife nas ALTERNATIVAS erradas.\n"
    "- Itens (I, II, III) e alternativas dizem só quais itens estão corretos -> grife nos ITENS errados (no enunciado).\n"
    "- CERTO/ERRADO -> grife no ENUNCIADO o trecho que torna a assertiva errada (se a assertiva for CORRETA, retorne grifos vazio).\n\n"
    "Para cada trecho: local ('enunciado'/'item II'/'alternativa C'), trecho (citação EXATA E LITERAL), "
    "tipo_armadilha, tooltip (erro + verdade + artigo). Responda APENAS JSON sem crases: "
    '{"tipo_estrutura": "...", "grifos": [...]}'
)
cli = anthropic.Anthropic(api_key=dotenv_values(r"D:/verus_api/.env").get("ANTHROPIC_API_KEY"))


def run(q, tag):
    user = (f"QUESTÃO (banca {q['bancaSigla']}, {q['concursoAno']}):\n\nENUNCIADO:\n{q['enunciado']}\n\n"
            f"ALTERNATIVAS: {q.get('alternativas')}\nGABARITO (correta): {q.get('gabarito')}\n")
    r = cli.messages.create(model="claude-opus-4-8", max_tokens=4000, system=SYSTEM,
                            messages=[{"role": "user", "content": user}])
    txt = "".join(b.text for b in r.content if getattr(b, "type", None) == "text").strip()
    if txt.startswith("```"):
        txt = txt.strip("`"); txt = txt[4:] if txt.lower().startswith("json") else txt
    print("\n" + "=" * 64)
    print(f"### {tag} | id {q['id']} | gabarito: {q.get('gabarito')} | custo ~${r.usage.input_tokens/1e6*5 + r.usage.output_tokens/1e6*25:.3f}")
    print("ENUNCIADO:", re.sub(r"<[^>]+>", " ", q["enunciado"])[:280])
    full = q["enunciado"] + " " + " ".join(map(str, q.get("alternativas", [])))
    try:
        g = json.loads(txt.strip())
        print("tipo_estrutura:", g.get("tipo_estrutura"))
        if not g.get("grifos"):
            print("  (sem grifos - assertiva correta)")
        for x in g.get("grifos", []):
            ok = "CASA" if x.get("trecho", "") in full else "NAO CASA"
            print(f"  [{x.get('local')}] ({x.get('tipo_armadilha')})  [{ok} literal]")
            print(f"    GRIFAR: {x.get('trecho')}")
            print(f"    tooltip: {x.get('tooltip')}")
    except Exception as e:
        print("JSON inválido:", e); print(txt[:500])


if ce_errado: run(ce_errado[0], "CERTO/ERRADO")
else: print("nenhuma C/E neste folha")
if pura: run(pura[0], "MC PURA")
else: print("nenhuma MC pura clara")
