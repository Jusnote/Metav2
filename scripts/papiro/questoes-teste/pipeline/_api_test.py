"""Teste pontual: MAP single-turn via API normal (Opus 4.8) — mede custo e valida
cobertura contra o claude -p. Lê a chave do .env (nunca imprime). Throwaway."""
import json, time, pathlib, sys
from dotenv import dotenv_values
import anthropic

key = dotenv_values(r"D:/verus_api/.env").get("ANTHROPIC_API_KEY")
assert key, "ANTHROPIC_API_KEY ausente"

PIPE = pathlib.Path(r"D:/meta novo/Metav2/scripts/papiro/questoes-teste/pipeline")
FOLHA = pathlib.Path(r"D:/inventario-v2/lingua-portuguesa-portugues/fonetica-fonemas-digrafos-encontros-consonantais-vocalicos-separacao-silabica")
system = (PIPE / "analista_map.md").read_text(encoding="utf-8")
lote_raw = (FOLHA / "lote-001.json").read_text(encoding="utf-8")
src_ids = {q["id"] for q in json.loads(lote_raw)}

user = (
    "Analise TODAS as questões do lote abaixo seguindo SUAS INSTRUÇÕES à risca: régua máxima de "
    "minuciosidade; cada distrator vira pegadinha com tipo_armadilha e ID; todo ID recebido tem "
    "que aparecer em ids_analisados E em ≥1 ponto; checagem cruzada do gabarito (base-0). "
    'Responda APENAS com o JSON no schema (sem crases, sem texto fora). Campo "lote"="lote-001".\n\n'
    f"LOTE (JSON):\n{lote_raw}"
)

client = anthropic.Anthropic(api_key=key)
t0 = time.time()
resp = client.messages.create(
    model="claude-opus-4-8", max_tokens=32000,
    system=system, messages=[{"role": "user", "content": user}],
)
dt = time.time() - t0
text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
u = resp.usage
cost = u.input_tokens / 1e6 * 15 + u.output_tokens / 1e6 * 75  # tabela Opus aprox.

# parse (tira cercas se houver)
t = text.strip()
if t.startswith("```"):
    t = t.strip("`")
    t = t[4:] if t.lower().startswith("json") else t
    t = t.strip()
try:
    inv = json.loads(t)
except Exception as e:
    print("✗ JSON inválido:", e)
    print(text[:600])
    sys.exit(1)

ana = set(inv.get("ids_analisados", []))
ref = set()
for p in inv.get("pontos", []):
    ref |= set(p.get("ids", []))
    for pg in p.get("pegadinhas", []):
        ref |= set(pg.get("ids", []))
pts = len(inv.get("pontos", []))
peg = sum(len(p.get("pegadinhas", [])) for p in inv.get("pontos", []))
(FOLHA / "_ab" / "lote-001.api.json").write_text(json.dumps(inv, ensure_ascii=False, indent=1), encoding="utf-8")

print("=" * 60)
print("MAP single-turn via API (Opus 4.8) — fonética lote-001")
print("=" * 60)
print(f"stop_reason:  {resp.stop_reason}")
print(f"tempo:        {dt:.0f}s        (claude -p: ~11 min)")
print(f"tokens:       in {u.input_tokens:,} | out {u.output_tokens:,}"
      f" | cache_read {getattr(u,'cache_read_input_tokens',0):,}")
print(f"custo est.:   ${cost:.3f}   (Batch ~${cost/2:.3f})   ← claude -p MAP ~$2.07/lote")
print(f"COBERTURA:    fonte {len(src_ids)} | analisados {len(ana)} | "
      f"perdidos {len(src_ids-ana)} | sem-ponto {len(src_ids-ref)}")
print(f"RIQUEZA:      {pts} pontos | {peg} pegadinhas   (claude -p: 15 pontos, 47 pegadinhas)")
