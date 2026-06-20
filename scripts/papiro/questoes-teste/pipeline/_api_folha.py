"""API single-turn MAP em TODA a responsabilidade civil (todos os lotes).
Mede custo + qualidade. Não toca a cota Max (é $ na API)."""
import json, time, pathlib
from datetime import datetime
from dotenv import dotenv_values
import anthropic

FOLHA = pathlib.Path(r"D:\inventario-v2\direito-civil\da-responsabilidade-civil-arts-927-a-954")
PIPE = pathlib.Path(__file__).parent
AB = FOLHA / "_apifolha"; AB.mkdir(exist_ok=True)
LOTES = sorted(FOLHA.glob("lote-*.json"))
SRC = set()
for l in LOTES:
    SRC |= {q["id"] for q in json.loads(l.read_text(encoding="utf-8"))}

key = dotenv_values(r"D:/verus_api/.env").get("ANTHROPIC_API_KEY")
system = (PIPE / "analista_map.md").read_text(encoding="utf-8")
cli = anthropic.Anthropic(api_key=key)
now = lambda: datetime.now().strftime("%H:%M:%S")

print(f"folha: {FOLHA.name} | {len(LOTES)} lotes | {len(SRC)} questões")

cost = 0.0; tin = tout = 0; invs = []; t0 = time.time()
for l in LOTES:
    user = ("Analise TODAS as questões seguindo SUAS INSTRUÇÕES à risca (régua máxima; cada distrator "
            "vira pegadinha com tipo_armadilha e ID; todo ID em ids_analisados E em ≥1 ponto; gabarito "
            f'base-0). Responda APENAS o JSON do schema (sem crases, sem texto fora). "lote"="{l.stem}".\n\n'
            "LOTE (JSON):\n" + l.read_text(encoding="utf-8"))
    r = cli.messages.create(model="claude-opus-4-8", max_tokens=32000, system=system,
                            messages=[{"role": "user", "content": user}])
    tin += r.usage.input_tokens; tout += r.usage.output_tokens
    cost += r.usage.input_tokens / 1e6 * 5 + r.usage.output_tokens / 1e6 * 25
    txt = "".join(b.text for b in r.content if getattr(b, "type", None) == "text").strip()
    if txt.startswith("```"):
        txt = txt.strip("`"); txt = txt[4:] if txt.lower().startswith("json") else txt
    try:
        inv = json.loads(txt.strip()); invs.append(inv)
        (AB / f"{l.stem}.json").write_text(json.dumps(inv, ensure_ascii=False), encoding="utf-8")
        print(f"[{now()}] {l.stem}: ok (stop={r.stop_reason} | in {r.usage.input_tokens} out {r.usage.output_tokens})")
    except Exception as e:
        print(f"[{now()}] {l.stem}: JSON inválido (stop={r.stop_reason}): {e}")
dt = time.time() - t0

ana = set(); ref = set(); pts = peg = 0
for inv in invs:
    ana |= set(inv.get("ids_analisados", []))
    for p in inv.get("pontos", []):
        pts += 1; ref |= set(p.get("ids", []))
        for pg in p.get("pegadinhas", []):
            peg += 1; ref |= set(pg.get("ids", []))

print("\n" + "=" * 60)
print(f"API single-turn — responsabilidade civil INTEIRA ({len(SRC)}q)")
print("=" * 60)
print(f"tempo:      {dt:.0f}s")
print(f"tokens:     in {tin:,} | out {tout:,}")
print(f"CUSTO:      ${cost:.2f} Padrão  |  ${cost/2:.2f} Batch")
print(f"$/questão:  ${cost/len(SRC):.4f} Padrão  |  ${cost/2/len(SRC):.4f} Batch")
print(f"qualidade:  {pts} pontos | {peg} pegadinhas | cobertura {len(SRC&ana)}/{len(SRC)} | sem-ponto {len(SRC-ref)}")
print(f"\nExtrapolação MAP do acervo Direito (~84K q):")
print(f"  ~${cost/len(SRC)*84000:,.0f} Padrão  |  ~${cost/2/len(SRC)*84000:,.0f} Batch")
