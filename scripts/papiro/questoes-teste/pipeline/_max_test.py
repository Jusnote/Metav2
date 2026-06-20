"""Mede 1 MAP via claude -p (Max) nas mesmas 50q do teste API. Throwaway."""
import asyncio, time
from pathlib import Path
from pipeline import ClaudeCliDispatcher, prompt_analista, is_inventory_valid

folha = Path(r"D:\inventario-v2\lingua-portuguesa-portugues\fonetica-fonemas-digrafos-encontros-consonantais-vocalicos-separacao-silabica")
lote = folha / "lote-001.json"
out = folha / "_ab" / "lote-001.maxtest.json"


async def main():
    d = ClaudeCliDispatcher(model="claude-opus-4-8", max_concurrent=1)
    t0 = time.time()
    await d.run(prompt_analista(folha, lote, "lote-001", out), stage="map")
    print(f"tempo: {time.time()-t0:.0f}s")
    print(f"valido: {is_inventory_valid(out)}")
    print(f"claude -p self-report: {d.stats}")


asyncio.run(main())
