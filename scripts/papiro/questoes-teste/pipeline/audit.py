"""Audita cobertura do MAP: compara IDs das questoes-fonte com os IDs que
cada inventario diz ter analisado. Pega omissao silenciosa que o auto-report
do agente nao revela."""
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

BASE = Path(r"D:\inventario-v2\direito-penal\da-extincao-da-punibilidade-arts-107-a-120-do-cp\da-prescricao-arts-108-a-119-do-cp")
PILOT = BASE / "_pilot"

total_src = set()
total_inv = set()

for lote in ["lote-001", "lote-002", "lote-003"]:
    src = json.loads((BASE / f"{lote}.json").read_text(encoding="utf-8"))
    src_ids = {q["id"] for q in src}
    inv_path = PILOT / f"{lote}.inventory.json"
    if not inv_path.exists():
        print(f"{lote}: INVENTARIO AUSENTE")
        continue
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    inv_ids = set(inv.get("ids_analisados", []))

    # IDs referenciados em pontos/pegadinhas/exemplos/conexoes
    ref_ids = set()
    for p in inv.get("pontos", []):
        ref_ids.update(p.get("ids", []))
        for pg in p.get("pegadinhas", []):
            ref_ids.update(pg.get("ids", []))
        for ex in p.get("exemplos", []):
            ref_ids.update(ex.get("ids", []))
    for c in inv.get("conexoes", []):
        ref_ids.update(c.get("ids", []))

    faltando = src_ids - inv_ids           # na fonte, NAO no inventario = PERDIDO
    fantasma = inv_ids - src_ids           # no inventario, NAO na fonte = inventado
    nao_usado = inv_ids - ref_ids          # declarado analisado mas nao gerou ponto
    ref_orfao = ref_ids - inv_ids          # citado em ponto mas fora de ids_analisados

    print(f"\n=== {lote} ===")
    print(f"  fonte:            {len(src_ids)} questoes")
    print(f"  ids_analisados:   {len(inv_ids)}")
    print(f"  auto-report diz:  recebidas={inv.get('recebidas')} analisadas={inv.get('analisadas')}")
    print(f"  PERDIDOS (fonte sem inventario): {len(faltando)}  {sorted(faltando) if faltando else ''}")
    print(f"  fantasma (inventario sem fonte): {len(fantasma)}  {sorted(fantasma) if fantasma else ''}")
    print(f"  declarados mas sem ponto algum:  {len(nao_usado)}  {sorted(nao_usado) if nao_usado else ''}")
    print(f"  ref orfao (ponto cita id fora):  {len(ref_orfao)}  {sorted(ref_orfao) if ref_orfao else ''}")

    total_src |= src_ids
    total_inv |= inv_ids

print(f"\n=== TOTAL ===")
print(f"  fonte: {len(total_src)} | inventariado: {len(total_inv)}")
print(f"  PERDIDOS no total: {len(total_src - total_inv)}  {sorted(total_src - total_inv) if (total_src - total_inv) else ''}")
