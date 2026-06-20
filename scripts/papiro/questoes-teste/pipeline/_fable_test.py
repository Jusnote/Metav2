"""MAP no lote-001 via Fable 5 (claude -p, Max), pra comparar com o Opus. Throwaway."""
import asyncio, time
from pathlib import Path
from pipeline import ClaudeCliDispatcher, prompt_analista, is_inventory_valid

folha = Path(r"D:\inventario-v2\direito-civil\da-responsabilidade-civil-arts-927-a-954")
lote = folha / "lote-001.json"
out = folha / "_ab" / "lote-001.fable.json"


async def main():
    d = ClaudeCliDispatcher(model="claude-fable-5", max_concurrent=1)
    t0 = time.time()
    await d.run(prompt_analista(folha, lote, "lote-001", out), stage="map")
    print(f"tempo: {time.time()-t0:.0f}s")
    print(f"valido: {is_inventory_valid(out)}")
    print(f"fable self-report: {d.stats}")


asyncio.run(main())
