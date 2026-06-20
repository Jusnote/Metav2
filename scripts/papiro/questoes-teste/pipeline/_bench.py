"""Benchmark LIMPO: 150 questões via claude -p (Max) vs API single-turn (Opus 4.8).

RODE VOCÊ MESMO num terminal separado, com o Claude Code FECHADO/parado, assim:
  1. leia sua cota (% diário/semanal)
  2. python _bench.py
  3. leia a cota de novo  -> o delta do % é SÓ a rota Max
     (a API não toca a cota Max — é $ no painel/saldo)

Imprime: custo auto-reportado de cada rota + qualidade (cobertura/pegadinhas).
"""
import asyncio, json, time, pathlib
from dotenv import dotenv_values
import anthropic
from pipeline import ClaudeCliDispatcher, prompt_analista

FOLHA = pathlib.Path(r"D:\inventario-v2\direito-civil\da-responsabilidade-civil-arts-927-a-954")
PIPE = pathlib.Path(__file__).parent
AB = FOLHA / "_ab"; AB.mkdir(exist_ok=True)

# --- monta um lote de 150 (3 x 50), determinístico ---
qs = []
for n in ("001", "002", "003"):
    qs += json.loads((FOLHA / f"lote-{n}.json").read_text(encoding="utf-8"))
lote150 = AB / "lote_150.json"
lote150.write_text(json.dumps(qs, ensure_ascii=False), encoding="utf-8")
SRC = {q["id"] for q in qs}
print(f"lote de teste: {len(qs)} questões  (IDs únicos: {len(SRC)})\n")


def quality(inv):
    ana = set(inv.get("ids_analisados", [])); ref = set()
    for p in inv.get("pontos", []):
        ref |= set(p.get("ids", []))
        for pg in p.get("pegadinhas", []):
            ref |= set(pg.get("ids", []))
    pts = len(inv.get("pontos", []))
    peg = sum(len(p.get("pegadinhas", [])) for p in inv.get("pontos", []))
    return pts, peg, len(SRC & ana), len(SRC - ref)


# ============ ROTA 1: claude -p (Max) — consome sua cota ============
print("[1/2] claude -p (Max)… (~3-6 min)  <- esta rota mexe no seu %")

async def run_max():
    d = ClaudeCliDispatcher(model="claude-opus-4-8", max_concurrent=1)
    out = AB / "bench.max.json"
    t0 = time.time()
    await d.run(prompt_analista(FOLHA, lote150, "bench", out), stage="map")
    return time.time() - t0, d.stats[0], json.loads(out.read_text(encoding="utf-8"))

try:
    dt_m, st_m, inv_m = asyncio.run(run_max())
    pm = quality(inv_m); ok_m = True
except Exception as e:
    print("  Max falhou:", e); ok_m = False

# ============ ROTA 2: API single-turn (Opus 4.8) — NÃO toca a cota Max ============
print("[2/2] API single-turn… (~3-5 min)  <- esta rota é $ no painel, NÃO mexe no %")
key = dotenv_values(r"D:/verus_api/.env").get("ANTHROPIC_API_KEY")
system = (PIPE / "analista_map.md").read_text(encoding="utf-8")
user = ("Analise TODAS as questões seguindo SUAS INSTRUÇÕES à risca (régua máxima; cada distrator "
        "vira pegadinha com tipo_armadilha e ID; todo ID em ids_analisados E em ≥1 ponto; gabarito "
        'base-0). Responda APENAS o JSON do schema (sem crases, sem texto fora). "lote"="bench".\n\n'
        "LOTE (JSON):\n" + lote150.read_text(encoding="utf-8"))
cli = anthropic.Anthropic(api_key=key)
t0 = time.time()
r = cli.messages.create(model="claude-opus-4-8", max_tokens=32000, system=system,
                        messages=[{"role": "user", "content": user}])
dt_a = time.time() - t0
txt = "".join(b.text for b in r.content if getattr(b, "type", None) == "text").strip()
trunc = (r.stop_reason == "max_tokens")
if txt.startswith("```"):
    txt = txt.strip("`"); txt = txt[4:] if txt.lower().startswith("json") else txt
try:
    inv_a = json.loads(txt.strip()); pa = quality(inv_a); ok_a = True
    (AB / "bench.api.json").write_text(json.dumps(inv_a, ensure_ascii=False), encoding="utf-8")
except Exception as e:
    ok_a = False; print("  API JSON inválido (truncou?):", e, "stop_reason:", r.stop_reason)
ca = r.usage.input_tokens / 1e6 * 5 + r.usage.output_tokens / 1e6 * 25

# ============ RESULTADO ============
print("\n" + "=" * 70)
print(f"{'rota':<18}|{'$ custo':>9}|{'tempo':>7}|{'pontos':>7}|{'pegad':>6}|{'cobertura':>11}")
print("-" * 70)
if ok_m:
    cov = f"{pm[2]}/{len(SRC)}" + ("" if pm[3] == 0 else f" (s/pt {pm[3]})")
    print(f"{'claude -p (Max)':<18}|{st_m['cost']:>8.2f}*|{dt_m:>6.0f}s|{pm[0]:>7}|{pm[1]:>6}|{cov:>11}")
if ok_a:
    cov = f"{pa[2]}/{len(SRC)}" + ("" if pa[3] == 0 else f" (s/pt {pa[3]})")
    print(f"{'API Padrão':<18}|{ca:>8.2f} |{dt_a:>6.0f}s|{pa[0]:>7}|{pa[1]:>6}|{cov:>11}")
    print(f"{'API Batch (metade)':<18}|{ca/2:>8.2f} | assíncrono (mesmos tokens, -50%)")
print("=" * 70)
print("* Max = custo-EQUIVALENTE (real $0, mas é o que consome sua cota).")
if trunc:
    print("⚠️ API truncou em 32k tokens de saída — 150q é grande demais p/ 1 resposta;")
    print("   reduza p/ ~100q por chamada OU aumente max_tokens.")
print(f"\nPara o %: o delta que você leu (antes/depois) é da rota MAX. A API foi ${ca:.2f} real.")
