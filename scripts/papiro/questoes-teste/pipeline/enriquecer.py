"""PAPIRO — enriquecedor (Rani × cursinho), passo OPCIONAL e seletivo.

Funde um RESUMO-RANI.md (espinha: questões + incidência + pegadinhas com ID) com um
trecho de cursinho do MESMO ponto (didática + doutrina) num RESUMO-FINAL.md: ensina no
método do cursinho, prioriza/arma pegadinha como o PAPIRO, SEM alucinar (toda afirmação
rastreia a uma das duas fontes; o que não confirma vira 'confira na fonte' ou cai).

Separado do pipeline.py de propósito: o pipeline roda em escala e é puro (questões →
resumo); o enriquecimento é pós-hoc, manual e só compensa em tópico de cauda longa.

Uso:
  python enriquecer.py                 # MODO INTERATIVO: escolhe a folha por número
  python enriquecer.py <pasta>         # direto numa pasta (usado pelo .bat/automação)
  python enriquecer.py <pasta> --out NOME.md

Convenção da pasta (auto-detecta por nome, case-insensitive):
  *rani*.md        -> espinha PAPIRO (obrigatório)
  *estrateg*.md    -> trecho do cursinho do mesmo ponto (obrigatório)
  *inventario*.md  -> opcional; se existir, entra como grounding extra de correção
"""
from __future__ import annotations

import argparse
import asyncio
import os
import shutil
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:
    pass

# Reusa o backend e helpers do pipeline (claude -p / Max hoje; Batch API amanhã).
from pipeline import ClaudeCliDispatcher, log, confirm_yn, INVENTARIO_ROOT

ROOT = Path(__file__).parent
PROMPT_FINAL = ROOT / "redator_final.md"
OUT_DEFAULT = "RESUMO-FINAL.md"


def find_one(folha: Path, *needles: str) -> Path | None:
    """Primeiro .md cujo nome contém um dos `needles` (case-insensitive)."""
    if not folha.exists():
        return None
    for p in sorted(folha.glob("*.md")):
        low = p.name.lower()
        if any(n in low for n in needles) and "final" not in low:
            return p
    return None


def prompt_enriquecer(rani: Path, estrategia: Path, inventario: Path | None,
                      out_path: Path) -> str:
    extra = (
        f"PASSO 3b — Read o INVENTÁRIO (evidência crua das questões, grounding extra de "
        f"correção): {inventario}\n"
        if inventario else ""
    )
    return (
        f"Você é o Redator-FINAL do PAPIRO. Funde a espinha (questões) com a didática do "
        f"cursinho, SEM alucinar.\n\n"
        f"PASSO 1 — Read seu prompt operacional (regras invioláveis): {PROMPT_FINAL}\n"
        f"PASSO 2 — Read a ESPINHA (resumo Rani — incidência, pegadinhas, IDs): {rani}\n"
        f"PASSO 3 — Read a FONTE DIDÁTICA (trecho do cursinho do mesmo ponto): {estrategia}\n"
        f"{extra}"
        f"PASSO 4 — Funda: ensine no método do cursinho (conceito → porquê → exemplo "
        f"resolvido), mantenha a ordem por incidência e TODAS as pegadinhas com ID da "
        f"espinha. REGRA DOS DOIS GROUNDING: toda afirmação rastreia a uma fonte; o que não "
        f"confirmar vira '⚠️ confira na fonte' ou cai; na divergência, vence a banca "
        f"(espinha). Transformativo: reescreva, nunca copie o cursinho ao pé da letra.\n"
        f"PASSO 5 — Write SOMENTE o Markdown (sem ``` nem texto fora) em: {out_path}\n\n"
        f"Retorne resumo curto: pontos cobertos, quantos exemplos resolvidos inseridos, "
        f"quantas divergências banca×cursinho sinalizou."
    )


async def run(folha: Path, out_name: str = OUT_DEFAULT) -> int:
    if not folha.is_dir():
        log(f"ERRO: {folha} não é uma pasta.")
        return 1
    rani = find_one(folha, "rani")
    estrategia = find_one(folha, "estrateg", "cursinho")
    inventario = find_one(folha, "inventario")
    faltando = [n for n, p in [("*rani*.md", rani), ("*estrateg*.md", estrategia)] if p is None]
    if faltando:
        log(f"ERRO: faltam na pasta: {', '.join(faltando)}")
        return 1

    out_path = folha / out_name
    log(f"espinha:    {rani.name}")
    log(f"cursinho:   {estrategia.name}")
    if inventario:
        log(f"inventário: {inventario.name} (grounding extra)")
    log(f"saída:      {out_path.name}")
    log("enriquecendo (claude -p / Opus, pode levar alguns minutos)…")

    disp = ClaudeCliDispatcher(model="claude-opus-4-8")
    resumo = await disp.run(prompt_enriquecer(rani, estrategia, inventario, out_path))
    if not out_path.exists():
        log("✗ o redator não escreveu o arquivo de saída.")
        log(f"  retorno do agente: {resumo[:400]}")
        return 1
    log(f"✓ pronto: {out_path}")
    log(f"  {resumo.strip()[:400]}")
    return 0


# ---------- Modo interativo --------------------------------------------------

def scan_candidates(root: Path) -> list[tuple[Path, Path, Path, Path | None, str]]:
    """Acha folhas com resumo Rani pronto (<folha>/_pilot2/RESUMO-RANI.md) e classifica
    o estado do enriquecimento. Retorna (folha, rani_src, enriq_dir, estrategia, status)."""
    out: list[tuple[Path, Path, Path, Path | None, str]] = []
    if not root.exists():
        return out
    for rani_src in sorted(root.rglob("RESUMO-RANI.md")):
        if rani_src.parent.name != "_pilot2":
            continue
        folha = rani_src.parent.parent
        enriq = folha / "_enriq"
        estr = find_one(enriq, "estrateg", "cursinho")
        if estr is not None:
            status = "feito" if (enriq / OUT_DEFAULT).exists() else "pronto"
        else:
            status = "falta_estrategia"
        out.append((folha, rani_src, enriq, estr, status))
    return out


async def cmd_interactive() -> int:
    root = INVENTARIO_ROOT
    cands = scan_candidates(root)
    print("=" * 64)
    print(" PAPIRO Enriquecedor — modo interativo (Rani × cursinho)")
    print("=" * 64)
    if not cands:
        print(f"\nNenhum RESUMO-RANI.md encontrado em {root}.")
        print("Rode antes o pipeline.py pra gerar os resumos Rani.")
        return 1

    label = {
        "feito": "✓ já enriquecido (re-roda = sobrescreve)",
        "pronto": "→ PRONTO p/ enriquecer",
        "falta_estrategia": "⚠ falta colocar o estrategia.md",
    }
    print(f"\nFolhas com resumo Rani em {root}:\n")
    for i, (folha, _, _, _, status) in enumerate(cands, 1):
        rel = folha.relative_to(root)
        print(f"  {i:>2}) {rel}   [{label[status]}]")

    try:
        raw = input("\nEscolha o número (vazio = sair): ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\nsaindo.")
        return 0
    if not raw:
        print("saindo.")
        return 0
    try:
        idx = int(raw) - 1
        assert 0 <= idx < len(cands)
    except (ValueError, AssertionError):
        print("opção inválida.")
        return 1

    folha, rani_src, enriq, estr, status = cands[idx]
    enriq.mkdir(exist_ok=True)
    rani_dst = enriq / "rani.md"
    if not rani_dst.exists():
        shutil.copy(rani_src, rani_dst)
        log(f"✓ copiei o resumo Rani para {rani_dst}")

    if status == "falta_estrategia":
        print(f"\n⚠ Falta o trecho do cursinho. Preparei a pasta:\n   {enriq}")
        print("   ✓ rani.md já está lá.")
        print("   → COLOQUE o 'estrategia.md' (trecho do cursinho daquele ponto) nessa pasta")
        print("     e rode de novo (escolha o mesmo número).")
        try:
            os.startfile(str(enriq))  # abre no Explorer pra largar o arquivo
            print("\nAbri a pasta no Explorer — é só largar o estrategia.md ali. 🙂")
        except Exception:
            pass
        return 0

    print(f"\nFolha:   {folha.relative_to(root)}")
    print(f"Espinha: rani.md   |   Cursinho: {estr.name}")
    if status == "feito":
        print("(já existe um RESUMO-FINAL.md — rodar de novo vai sobrescrever)")
    if not confirm_yn("\nEnriquecer agora?"):
        print("cancelado.")
        return 0
    print()
    return await run(enriq, OUT_DEFAULT)


# ---------- Entrada ----------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(
        description="Enriquece um RESUMO-RANI com a didática de um trecho de cursinho. "
                    "Sem argumento abre o modo interativo; com pasta roda direto.")
    ap.add_argument("pasta", nargs="?", help="pasta com rani.md + estrategia.md "
                                             "(omita pra abrir o menu interativo)")
    ap.add_argument("--out", default=OUT_DEFAULT, help="nome do arquivo de saída")
    args = ap.parse_args()
    if args.pasta:
        return asyncio.run(run(Path(args.pasta), args.out))
    return asyncio.run(cmd_interactive())


if __name__ == "__main__":
    sys.exit(main())
