"""Rani (resumo) via Fable 5 no MESMO INVENTARIO que o Opus usou. Compara a escrita."""
import asyncio
from pathlib import Path
from pipeline import ClaudeCliDispatcher, prompt_rani

folha = Path(r"D:\inventario-v2\direito-civil\da-responsabilidade-civil-arts-927-a-954")
pilot = folha / "_pilot2"
out = folha / "_ab" / "RESUMO-RANI.fable.md"


async def main():
    d = ClaudeCliDispatcher(model="claude-fable-5", max_concurrent=1)
    await d.run(prompt_rani(folha, pilot / "INVENTARIO.md", out), stage="rani")
    print("valido:", out.exists(), "| chars:", len(out.read_text(encoding="utf-8")) if out.exists() else 0)
    print("fable rani stats:", d.stats)


asyncio.run(main())
