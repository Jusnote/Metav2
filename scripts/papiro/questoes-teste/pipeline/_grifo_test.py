"""Teste do EXTRATOR DE GRIFO (comentários do professor): dada uma questão + gabarito,
devolve os trechos a grifar + onde (enunciado/item/alternativa) + tooltip."""
import json, glob, pathlib
from dotenv import dotenv_values
import anthropic

FOLHA = pathlib.Path(r"D:\inventario-v2\direito-civil\da-responsabilidade-civil-arts-927-a-954")
qs = []
for f in glob.glob(str(FOLHA / "lote-*.json")):
    qs += json.loads(open(f, encoding="utf-8").read())
q = [x for x in qs if x.get("id") == 171306][0]

system = (
    "Você é o ANOTADOR DE GRIFO do PAPIRO, para o sistema de 'comentários do professor': ele GRIFA "
    "os trechos ERRADOS de uma questão e, ao passar o mouse, mostra um tooltip explicando a pegadinha.\n\n"
    "REGRA DE LOCALIZAÇÃO (crucial — varia com a estrutura da questão):\n"
    "- Se as alternativas (A-E) são afirmações completas → grife nas ALTERNATIVAS erradas.\n"
    "- Se a questão tem ITENS (I, II, III...) e as alternativas só dizem quais itens estão corretos "
    "('I e IV', 'apenas II') → grife nos ITENS errados (que estão no enunciado), NÃO nas alternativas.\n"
    "- Se é CERTO/ERRADO → grife no ENUNCIADO.\n\n"
    "Para CADA trecho a grifar, devolva:\n"
    "- local: onde está ('item II', 'item III', 'alternativa C', 'enunciado')\n"
    "- trecho: a citação EXATA E LITERAL do texto (copie palavra por palavra — a UI precisa achar e grifar)\n"
    "- tipo_armadilha\n"
    "- tooltip: explicação curta (o erro + a verdade, com o artigo/súmula)\n\n"
    "Responda APENAS o JSON, sem crases: {\"tipo_estrutura\": \"...\", \"grifos\": [...]}"
)
user = (
    f"QUESTÃO (banca {q['bancaSigla']}, {q['concursoAno']}):\n\n"
    f"ENUNCIADO:\n{q['enunciado']}\n\n"
    f"ALTERNATIVAS: {q['alternativas']}\n"
    f"GABARITO (correta): {q['gabarito']}\n"
)

key = dotenv_values(r"D:/verus_api/.env").get("ANTHROPIC_API_KEY")
cli = anthropic.Anthropic(api_key=key)
r = cli.messages.create(model="claude-opus-4-8", max_tokens=4000, system=system,
                        messages=[{"role": "user", "content": user}])
txt = "".join(b.text for b in r.content if getattr(b, "type", None) == "text").strip()
if txt.startswith("```"):
    txt = txt.strip("`"); txt = txt[4:] if txt.lower().startswith("json") else txt
print("custo: ~$%.3f" % (r.usage.input_tokens/1e6*5 + r.usage.output_tokens/1e6*25))
print("=" * 60)
try:
    g = json.loads(txt.strip())
    print("tipo_estrutura:", g.get("tipo_estrutura"))
    for x in g.get("grifos", []):
        print(f"\n[{x.get('local')}] ({x.get('tipo_armadilha')})")
        print(f"  GRIFAR: «{x.get('trecho')}»")
        print(f"  tooltip: {x.get('tooltip')}")
    # valida: o trecho existe literalmente no enunciado?
    print("\n--- validação: trecho casa LITERAL no texto? ---")
    full = q['enunciado'] + ' ' + ' '.join(q['alternativas'])
    for x in g.get("grifos", []):
        t = x.get('trecho','')
        print(f"  «{t[:50]}…» → {'✓ achou' if t in full else '✗ NÃO casa literal'}")
except Exception as e:
    print("JSON inválido:", e); print(txt[:800])
