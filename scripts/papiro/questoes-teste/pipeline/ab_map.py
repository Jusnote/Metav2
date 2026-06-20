"""A/B Sonnet x Opus no estágio MAP — mesmos lotes, pra medir se Sonnet segura a
profundidade. Escreve em <folha>/_ab/<lote>.<modelo>.json. Idempotente."""
from __future__ import annotations
import asyncio
from pathlib import Path

from pipeline import ClaudeCliDispatcher, prompt_analista, is_inventory_valid, log

FOLHA = Path(r"D:\inventario-v2\lingua-portuguesa-portugues\fonetica-fonemas-digrafos-encontros-consonantais-vocalicos-separacao-silabica")
LOTES = ["lote-001.json", "lote-002.json"]
MODELS = {"opus": "claude-opus-4-8", "sonnet": "claude-sonnet-4-6"}
OUT = FOLHA / "_ab"


async def one(disp: ClaudeCliDispatcher, name: str, lote: str) -> None:
    lp = FOLHA / lote
    out = OUT / f"{Path(lote).stem}.{name}.json"
    if is_inventory_valid(out):
        log(f"[skip] {out.name} ja valido")
        return
    log(f"[{name}] {lote} -> rodando…")
    try:
        await disp.run(prompt_analista(FOLHA, lp, Path(lote).stem, out))
        log(f"[{name}] {lote} -> {out.name} valido={is_inventory_valid(out)}")
    except Exception as e:
        log(f"[{name}] {lote} -> ERRO: {e}")


async def main() -> None:
    OUT.mkdir(exist_ok=True)
    # cap=1 por dispatcher => no maximo 1 opus + 1 sonnet ao mesmo tempo (gentil no custo/limite)
    disp_o = ClaudeCliDispatcher(model=MODELS["opus"], max_concurrent=1)
    disp_s = ClaudeCliDispatcher(model=MODELS["sonnet"], max_concurrent=1)
    tasks = []
    for lote in LOTES:
        tasks.append(one(disp_o, "opus", lote))
        tasks.append(one(disp_s, "sonnet", lote))
    await asyncio.gather(*tasks)
    log("=== A/B concluido ===")


if __name__ == "__main__":
    asyncio.run(main())
