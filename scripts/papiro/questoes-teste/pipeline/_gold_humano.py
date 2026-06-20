"""Gera o arquivo do GOLD HUMANO (DConst): 30 questões (todas as divergências
DeepSeek×Opus + amostra), com a lista de nós, pra Aldemir marcar o subtema certo.
Salva o mapeamento p/ depois comparar humano × modelos. THROWAWAY."""
import json, random
from pathlib import Path
import _tax_place_test as T

C = Path(r"D:\inventario-v2\_scale_probe")
d = json.loads((C / "_tax_place_v2.json").read_text(encoding="utf-8"))
sample = d["sample"]
gold = {int(k): v for k, v in d["gold"].items()}
ds = {int(k): v for k, v in d["preds"]["deepseek/deepseek-v4-flash"].items()}

disag = [j for j in range(len(sample)) if gold.get(j) and ds.get(j) and ds[j][0] not in gold[j]]
agree = [j for j in range(len(sample)) if gold.get(j) and j not in disag]
rng = random.Random(7)
pick = disag + rng.sample(agree, 30 - len(disag))
rng.shuffle(pick)

lines = [
    "GOLD HUMANO — Direito Constitucional",
    "=" * 70,
    "Pra CADA questão, escreva na linha 'R:' o(s) NÚMERO(S) do subtema certo.",
    "1 a 3 números, o PRINCIPAL primeiro, separados por vírgula. Ex.:  R: 7",
    "ou, se cobrar 2 assuntos:  R: 7, 12",
    "Salve o arquivo quando terminar e me avise.",
    "",
    "SUBTEMAS DISPONÍVEIS:",
]
for s in T.SUB:
    lines.append(f'  {s["id"]:>2}. {s["tema"]} › {s["nome"]}')
lines.append("\n" + "=" * 70)

mapping = {}
for n, j in enumerate(pick, 1):
    i = sample[j]
    mapping[str(n)] = j
    lines.append(f"\n[{n}] {T.TXT[i]}")
    lines.append("R: ")

out = C / "GOLD_HUMANO_dconst.txt"
out.write_text("\n".join(lines), encoding="utf-8")
(C / "_gold_humano_map.json").write_text(json.dumps(mapping), encoding="utf-8")
print(f"Arquivo: {out}")
print(f"{len(pick)} questões ({len(disag)} são divergências DeepSeek×Opus + {len(pick)-len(disag)} amostra)")
print(f"Subtemas: {len(T.SUB)} opções")
