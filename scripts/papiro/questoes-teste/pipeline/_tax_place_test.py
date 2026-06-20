"""_tax_place_test.py — TESTE de fidelidade de colocação em DConst (gold set). THROWAWAY.

Demonstra o approach "melhor do Brasil" pra PLACEMENT:
  - GABARITO = Fable classifica uma amostra na árvore (multi-rótulo) → a "verdade".
  - Baseline ATUAL = colocação por KMeans→subtema (reproduz o cluster e alinha aos
    cluster_ids originais pelos samples cacheados).
  - Cascata barata = Haiku classifica a mesma amostra na árvore.
Mede os dois contra o gabarito Fable e mostra onde o KMeans erra e a classificação acerta.
Tudo com cache (sem tunnel/Voyage), Max ($0).

Uso:  python _tax_place_test.py
"""
from __future__ import annotations
import asyncio, io, json, random, re, sys
from collections import Counter
from pathlib import Path
import numpy as np
from pipeline import ClaudeCliDispatcher, log

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
C = Path(r"D:\inventario-v2\_scale_probe")
dat = json.loads((C / "dconst.dat.json").read_text(encoding="utf-8"))
TXT = dat["txt"]; N = len(TXT)
tree = json.loads((C / "dconst.tree.fable.json").read_text(encoding="utf-8"))
clusters = json.loads((C / "_tax_clusters.json").read_text(encoding="utf-8"))["clusters"]

# ---- index subtemas 1..S ----
SUB = []
for t in tree["temas"]:
    for s in t["subtemas"]:
        SUB.append({"id": len(SUB) + 1, "tema": t["nome"], "nome": s["nome"],
                    "oqc": s.get("o_que_cai", ""), "cids": s.get("cluster_ids", [])})
cid2sub = {c: s["id"] for s in SUB for c in s["cids"]}
NAME = {s["id"]: f'{s["tema"]} › {s["nome"]}' for s in SUB}


def kmeans_baseline():
    """Reproduz o KMeans k=30 (seed 0) e alinha os novos clusters aos cluster_ids
    originais via os samples cacheados. Retorna {indice_questao: subtema_id}."""
    from sklearn.cluster import KMeans
    E = np.load(C / "dconst.emb.npy")
    if len(E) != N:
        return {}, "emb size mismatch — baseline pulado"
    lab = KMeans(n_clusters=30, n_init=4, random_state=0).fit_predict(E)
    pref = {}
    for i, tx in enumerate(TXT):
        pref.setdefault(tx[:180], i)
    new2orig, clean = {}, 0
    for cl in clusters:
        idxs = [pref.get(s) for s in cl["samples"]]
        newls = [int(lab[i]) for i in idxs if i is not None]
        if not newls:
            continue
        maj, cnt = Counter(newls).most_common(1)[0]
        new2orig[maj] = cl["id"]
        if cnt == len(newls):
            clean += 1
    q2sub = {}
    for i in range(N):
        oc = new2orig.get(int(lab[i]))
        if oc is not None and oc in cid2sub:
            q2sub[i] = cid2sub[oc]
    return q2sub, f"alinhamento limpo {clean}/{len(clusters)} clusters"


def parse_json(t: str) -> dict:
    t = re.sub(r"```(json)?", "", t)
    a, b = t.find("{"), t.rfind("}")
    return json.loads(t[a:b + 1])


def classify_prompt(sample_idx: list[int]) -> str:
    subs = "\n".join(f'{s["id"]}. {s["tema"]} › {s["nome"]} — {s["oqc"][:85]}' for s in SUB)
    qs = "\n\n".join(f'[{j}] {TXT[i][:620]}' for j, i in enumerate(sample_idx))
    return ("Você classifica questões de Direito Constitucional na taxonomia abaixo. "
            "Para CADA questão, escolha de 1 a 3 subtemas que ela cobra (o PRINCIPAL primeiro). "
            "Use SÓ os números dos subtemas. Responda APENAS o JSON {\"<j>\":[ids]}, nada além.\n\n"
            f"SUBTEMAS:\n{subs}\n\n=== {len(sample_idx)} QUESTÕES ===\n{qs}")


async def classify(model: str, sample_idx: list[int]):
    d = ClaudeCliDispatcher(model=model, max_concurrent=1, timeout=900)
    r = await d.run(classify_prompt(sample_idx), stage="classify")
    cost = sum(s["cost"] for s in d.stats)
    try:
        res = parse_json(r)
        out = {int(k): [int(x) for x in v if isinstance(x, (int, str)) and str(x).isdigit()]
               for k, v in res.items()}
    except Exception as e:
        log(f"  parse falhou ({model}): {e}"); out = {}
    return out, cost


async def main():
    rng = random.Random(11)
    sample_idx = rng.sample(range(N), 50)
    q2sub_km, kmnote = kmeans_baseline()
    log(f"KMeans baseline: {kmnote}")
    log("Fable montando o GABARITO (multi-rótulo)… (~3-6 min)")
    gold, cg = await classify("claude-fable-5", sample_idx)
    log("Haiku classificando… (~1-2 min)")
    haiku, ch = await classify("haiku", sample_idx)

    rows, km_ok, hk_ok, jacc = [], 0, 0, []
    for j, i in enumerate(sample_idx):
        g = gold.get(j, [])
        if not g:
            continue
        kms = q2sub_km.get(i)
        hks = haiku.get(j, [])
        hkp = hks[0] if hks else None
        km_hit = bool(kms) and kms in g
        hk_hit = bool(hkp) and hkp in g
        km_ok += km_hit; hk_ok += hk_hit
        if hks:
            jacc.append(len(set(hks) & set(g)) / len(set(hks) | set(g)))
        rows.append((i, g, kms, hks, km_hit, hk_hit))
    n = len(rows)
    multi = sum(1 for _, g, *_ in rows if len(g) > 1)

    print("\n" + "=" * 80)
    print(f" FIDELIDADE DE COLOCAÇÃO — DConst | gabarito Fable, n={n} questões")
    print("=" * 80)
    print(f"  Colocação ATUAL (KMeans→subtema)   vs gabarito:  {km_ok}/{n} = {100*km_ok/max(1,n):.0f}%")
    print(f"  Classificação BARATA (Haiku→árvore) vs gabarito:  {hk_ok}/{n} = {100*hk_ok/max(1,n):.0f}%")
    print(f"  Multi-rótulo (Haiku∩gabarito, Jaccard médio):     {100*sum(jacc)/max(1,len(jacc)):.0f}%")
    print(f"  Questões que o Fable marcou em >1 subtema:        {multi}/{n}  (o KMeans não consegue representar)")
    print(f"  Referência protótipo (pureza embedding):  lite 79,5% · v4-large 83%")
    print(f"  Custo (Max, equiv-$): Fable ${cg:.2f} · Haiku ${ch:.2f}")

    print("\n  EXEMPLOS — onde o KMeans errou e a classificação acertou:")
    shown = 0
    for i, g, kms, hks, km_hit, hk_hit in rows:
        if (not km_hit) and hk_hit and shown < 6:
            print(f'   • "{TXT[i][:95]}…"')
            print(f"       KMeans:   {NAME.get(kms, '—')}")
            print(f"       Haiku:    {NAME.get(hks[0], '—')}")
            print(f"       gabarito: {' | '.join(NAME[x] for x in g if x in NAME)}")
            shown += 1
    if not shown:
        print("   (nenhum no recorte — ver JSONs em _scale_probe)")
    (C / "_tax_place_test.json").write_text(
        json.dumps({"n": n, "kmeans_pct": round(100*km_ok/max(1,n), 1),
                    "haiku_pct": round(100*hk_ok/max(1,n), 1), "multi": multi,
                    "sample": sample_idx, "gold": gold, "haiku": haiku}, ensure_ascii=False, indent=1),
        encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
