"""_advisor_matrix.py — advisor-na-mão (DIY) no MAP, rota Max. THROWAWAY.

Testa se um worker barato + Fable revisando (chamada separada) + merge no código
chega na qualidade do Fable (37 pontos) gastando menos. NÃO é a advisor tool oficial
da API (essa é beta só-API e Fable só aconselha Fable). Aqui são 2 chamadas
independentes + merge — sem trava de pareamento.

  B1 = Opus (rascunho reaproveitado do baseline) + Fable revisa
  B2 = Sonnet-leve (prompt analista_map_light) + Fable revisa
        (o rascunho leve do Sonnet também é pontuado sozinho)

Folha: resp. civil, lote-001 (50 q). Baselines: Opus 31/$2,18 · Fable 37/$4,61.
Régua: 8 itens-ouro (o que o Fable-37 pegou e o Opus-31 deixou passar) + 2 armadilhas.

Uso:  python _advisor_matrix.py            (roda B1 e B2)
      python _advisor_matrix.py b1         (só B1)
Idempotente: se o merge já existe, re-pontua sem gastar chamada.
"""
from __future__ import annotations
import asyncio, json, re, sys, time, unicodedata
from pathlib import Path
from pipeline import ClaudeCliDispatcher, is_inventory_valid, log

ROOT = Path(__file__).parent
FOLHA = Path(r"D:\inventario-v2\direito-civil\da-responsabilidade-civil-arts-927-a-954")
LOTE = FOLHA / "lote-001.json"
AB = FOLHA / "_ab"; AB.mkdir(exist_ok=True)
OPUS_BASE = FOLHA / "_pilot2" / "lote-001.inventory.json"   # 31 pts (worker do B1)
FABLE_BASE = AB / "lote-001.fable.json"                      # 37 pts (referência)
REVISOR_MD = ROOT / "revisor_fable.md"
LIGHT_MD = ROOT / "analista_map_light.md"

COST_OPUS_BASE = 2.18   # equiv-$ do baseline Opus (claude -p), p/ somar no total do B1
COST_FABLE_BASE = 4.61  # equiv-$ do baseline Fable

SRC_IDS = {q["id"] for q in json.loads(LOTE.read_text(encoding="utf-8"))}


# ---------- utils ----------
def load_json(path: Path) -> dict:
    t = path.read_text(encoding="utf-8").strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[4:] if t.lower().startswith("json") else t
    return json.loads(t.strip())


def norm(s: str) -> str:
    s = s.lower()
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


# ---------- régua (itens-ouro = o que separa Fable-37 de Opus-31) ----------
GOLD = {
    "953 injúria/difam.": lambda t: "953" in t or "injuria" in t or "difamacao" in t or "calunia" in t,
    "abuso direito (187)": lambda t: "abuso de direito" in t,
    "culpa concorr. (945)": lambda t: "culpa concorrente" in t or "945" in t,
    "art.931 circulação": lambda t: "931" in t or "postos em circulacao" in t,
    "prescr. 200/198,I": lambda t: bool(re.search(r"\b198\b", t)) or bool(re.search(r"art\.?\s*200\b", t))
                                   or "suspende a prescri" in t or "suspensao da pretensao" in t,
    "Súmula 642": lambda t: "642" in t,
    "Súmula 387": lambda t: "387" in t,
    "nascituro/ricochete": lambda t: "nascituro" in t or "ricochete" in t or "vitimas indiretas" in t,
}


def gold_hits(inv: dict) -> set[str]:
    t = norm(json.dumps(inv, ensure_ascii=False))
    return {k for k, f in GOLD.items() if f(t)}


def metrics(inv: dict) -> dict:
    pts = inv.get("pontos", [])
    peg = sum(len(p.get("pegadinhas", [])) for p in pts)
    ana = set(inv.get("ids_analisados", []))
    ref: set[int] = set()
    for p in pts:
        ref |= set(p.get("ids", []))
        for pg in p.get("pegadinhas", []):
            ref |= set(pg.get("ids", []))
    return {"pontos": len(pts), "peg": peg, "ouro": gold_hits(inv),
            "cob": f"{len(SRC_IDS & ana)}/{len(SRC_IDS)}", "sem_ponto": len(SRC_IDS - ref)}


# ---------- merge (draft + delta do revisor) ----------
def _arts(label: str) -> set[str]:
    return set(re.findall(r"art\.?\s*(\d+)", norm(label)))


def _match_point(label: str, labels: dict) -> dict | None:
    """Casa um rótulo a um ponto EXISTENTE só quando é o MESMO ponto: rótulo idêntico,
    OU mesmo nº de artigo, OU alta sobreposição (≥0.6) de palavras. Conservador de
    propósito — fundir um ponto novo (art. 953) num ponto errado some com a contribuição."""
    k = norm(label)
    if k in labels:
        return labels[k]
    ka = _arts(label)
    if ka:
        for lk, p in labels.items():
            if ka & _arts(lk):
                return p
    kw = set(k.split())
    best, bestj = None, 0.0
    for lk, p in labels.items():
        lw = set(lk.split())
        if lw:
            j = len(kw & lw) / min(len(kw), len(lw))
            if j > bestj:
                best, bestj = p, j
    return best if bestj >= 0.6 else None


def merge(draft: dict, delta: dict) -> tuple[dict, int, int]:
    out = json.loads(json.dumps(draft, ensure_ascii=False))  # deep copy
    pontos = out.setdefault("pontos", [])
    labels = {norm(p.get("ponto", "")): p for p in pontos}
    out.setdefault("ids_analisados", [])
    add_pts = add_peg = 0

    def reg_ids(ids):
        for i in ids:
            if i in SRC_IDS and i not in out["ids_analisados"]:
                out["ids_analisados"].append(i)

    for np_ in delta.get("pontos_faltantes", []):
        new_peg = np_.get("pegadinhas", [])
        match = _match_point(np_.get("ponto", ""), labels)
        if match:  # mesmo ponto → só agrega as pegadinhas
            match.setdefault("pegadinhas", []).extend(new_peg)
        else:
            pontos.append(np_); labels[norm(np_.get("ponto", ""))] = np_; add_pts += 1
        add_peg += len(new_peg)
        reg_ids(np_.get("ids", []))
        for pg in new_peg:
            reg_ids(pg.get("ids", []))

    avulsas = None
    for pf in delta.get("pegadinhas_faltantes", []):
        pg = pf.get("pegadinha")
        if not pg:
            continue
        match = _match_point(pf.get("ponto_existente", ""), labels)
        if match is None:  # não achou o ponto-âncora → não perde a pegadinha
            if avulsas is None:
                avulsas = {"ponto": "(revisor) pegadinhas avulsas", "conceito": "", "ids": [],
                           "pegadinhas": [], "exemplos": [], "a_conferir": ""}
                pontos.append(avulsas); labels[norm(avulsas["ponto"])] = avulsas; add_pts += 1
            match = avulsas
        match.setdefault("pegadinhas", []).append(pg); add_peg += 1
        reg_ids(pg.get("ids", []))

    out["_revisor"] = {"correcoes": delta.get("correcoes", []), "add_pontos": add_pts, "add_peg": add_peg}
    return out, add_pts, add_peg


# ---------- prompts (espelham prompt_analista) ----------
def prompt_revisor(draft_path: Path, out_path: Path) -> str:
    return (
        "Você é o REVISOR Cirúrgico do PAPIRO. Critica o rascunho de outro analista e devolve SÓ o delta (o que falta + erros).\n\n"
        f"PASSO 1 — Read seu prompt operacional: {REVISOR_MD}\n"
        f"PASSO 2 — Read o lote (as questões reais com gabarito): {LOTE}\n"
        f"PASSO 3 — Read o RASCUNHO a revisar: {draft_path}\n"
        "PASSO 4 — Para CADA questão, ache o que o rascunho deixou passar (ponto/pegadinha cobrável ausente, "
        "artigo/súmula deixado genérico) e os ERROS de doutrina. Não repita o que já está certo. Todo id citado existe no lote.\n"
        f"PASSO 5 — Write SOMENTE o JSON do delta (schema do seu prompt, sem crases nem texto fora) em: {out_path}\n\n"
        "Retorne resumo curto: nº de pontos_faltantes, pegadinhas_faltantes, correcoes."
    )


def prompt_light(out_path: Path) -> str:
    return (
        "Você é o Analista LEVE do PAPIRO (rascunho de largura). Cobre TUDO, mas conciso — outro revisor aprofunda.\n\n"
        f"PASSO 1 — Read seu prompt operacional: {LIGHT_MD}\n"
        f"PASSO 2 — Read o lote: {LOTE}\n"
        "PASSO 3 — Cubra cada questão e cada alternativa (cada distrator = pegadinha+ID), 1 frase por conceito, sem esgotar. "
        "Gabarito base-0, checagem cruzada. Todo ID em ids_analisados E em ≥1 ponto. Não trave: largura, não profundidade.\n"
        f'PASSO 4 — Monte o JSON no schema do analista, campo "lote"="lote-001".\n'
        f"PASSO 5 — Write SOMENTE o JSON (sem crases) em: {out_path}\n\n"
        "Retorne: questões cobertas, pontos, pegadinhas."
    )


# ---------- runs ----------
async def run_revisor(draft_path: Path, out_delta: Path, out_merged: Path) -> dict | None:
    if out_merged.exists() and is_inventory_valid(out_merged):
        log(f"  [skip] {out_merged.name} já existe — re-pontuando")
        merged = load_json(out_merged)
        rev = merged.get("_revisor", {})
        return {"cost": None, "dt": None, "merged": merged,
                "add_pts": rev.get("add_pontos", 0), "add_peg": rev.get("add_peg", 0)}
    disp = ClaudeCliDispatcher(model="claude-fable-5", max_concurrent=1, timeout=2400)
    log(f"  revisor Fable sobre {draft_path.name}… (~3-8 min)")
    t0 = time.time()
    await disp.run(prompt_revisor(draft_path, out_delta), stage="revisor")
    dt = time.time() - t0
    if not out_delta.exists():
        log(f"  ✗ revisor não gravou {out_delta.name}"); return None
    delta = load_json(out_delta)
    merged, ap, apg = merge(load_json(draft_path), delta)
    out_merged.write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    cost = sum(s["cost"] for s in disp.stats)
    log(f"  ✓ Fable add: {ap} pontos, {apg} pegadinhas, {len(delta.get('correcoes', []))} correções | {dt:.0f}s | ${cost:.3f}")
    return {"cost": cost, "dt": dt, "merged": merged, "add_pts": ap, "add_peg": apg}


async def run_sonnet_light(out_path: Path) -> dict | None:
    if is_inventory_valid(out_path):
        log(f"  [skip] {out_path.name} já válido")
        return {"cost": None, "dt": None, "inv": load_json(out_path)}
    disp = ClaudeCliDispatcher(model="claude-sonnet-4-6", max_concurrent=1, timeout=1800)
    log("  Sonnet-leve (rascunho de largura)… (timeout 30min — pode travar, é um achado)")
    t0 = time.time()
    try:
        await disp.run(prompt_light(out_path), stage="sonnet_light")
    except Exception as e:
        log(f"  ✗ Sonnet-leve falhou: {e}"); return None
    dt = time.time() - t0
    if not is_inventory_valid(out_path):
        log(f"  ✗ Sonnet não gerou inventário válido"); return None
    cost = sum(s["cost"] for s in disp.stats)
    log(f"  ✓ Sonnet-leve: {dt:.0f}s | ${cost:.3f}")
    return {"cost": cost, "dt": dt, "inv": load_json(out_path)}


# ---------- tabela ----------
def row(label: str, route: str, cost, m: dict) -> str:
    c = "  —  " if cost is None else f"{cost:>5.2f}"
    sp = "" if m["sem_ponto"] == 0 else f" sp{m['sem_ponto']}"
    return (f"{label:<22}|{route:^5}|{c:>6}|{m['pontos']:>4}|{m['peg']:>5}|"
            f"{len(m['ouro'])}/8 |{m['cob']+sp:>9}")


async def main() -> None:
    only = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    print("=" * 78)
    print(" MATRIZ ADVISOR-NA-MÃO — resp. civil lote-001 (50q) — rota Max")
    print("=" * 78)
    rows, notes = [], []

    # baselines (0 call)
    m_opus = metrics(load_json(OPUS_BASE))
    m_fable = metrics(load_json(FABLE_BASE))
    rows.append(row("Opus-só (base)", "Max", COST_OPUS_BASE, m_opus))
    rows.append(row("Fable-só (base)", "Max", COST_FABLE_BASE, m_fable))
    notes.append(f"Régua valida: Fable-base {len(m_fable['ouro'])}/8, Opus-base {len(m_opus['ouro'])}/8 "
                 f"(faltam no Opus: {sorted(set(GOLD) - m_opus['ouro'])})")

    # B1 — Opus + Fable
    if only in ("", "b1"):
        draft_gold = m_opus["ouro"]
        b1 = await run_revisor(OPUS_BASE, AB / "B1.delta.json", AB / "B1.opus_fable.json")
        if b1:
            m = metrics(b1["merged"])
            total = None if b1["cost"] is None else COST_OPUS_BASE + b1["cost"]
            rows.append(row("B1 Opus+Fable", "Max", total, m))
            rec = m["ouro"] - draft_gold
            notes.append(f"B1: Fable add {b1['add_pts']} pontos / {b1['add_peg']} peg. "
                         f"Recuperou ouro: {sorted(rec) or '∅'}  → {len(draft_gold)}/8 → {len(m['ouro'])}/8"
                         + ("" if b1["cost"] is None else f" | revisor ${b1['cost']:.2f} (worker reuso ${COST_OPUS_BASE})"))

    # B2 — Sonnet-leve + Fable
    if only in ("", "b2"):
        sl = await run_sonnet_light(AB / "B2.sonnet_light.json")
        if sl:
            m_sl = metrics(sl["inv"])
            rows.append(row("Sonnet-leve só", "Max", sl["cost"], m_sl))
            b2 = await run_revisor(AB / "B2.sonnet_light.json", AB / "B2.delta.json", AB / "B2.sonnet_fable.json")
            if b2:
                m = metrics(b2["merged"])
                total = None if (b2["cost"] is None or sl["cost"] is None) else sl["cost"] + b2["cost"]
                rows.append(row("B2 Sonnet+Fable", "Max", total, m))
                rec = m["ouro"] - m_sl["ouro"]
                notes.append(f"B2: Sonnet-leve {len(m_sl['ouro'])}/8 → +Fable add {b2['add_pts']}p/{b2['add_peg']}peg. "
                             f"Recuperou ouro: {sorted(rec) or '∅'} → {len(m['ouro'])}/8")
        else:
            notes.append("B2: Sonnet-leve não completou (timeout/erro) — worker barato inviável nesta rota.")

    # imprime
    print(f"\n{'braço':<22}|{'rota':^5}|{'$':>6}|{'pts':>4}|{'peg':>5}|ouro |{'cobert.':>9}")
    print("-" * 70)
    for r in rows:
        print(r)
    print("-" * 70)
    print("\nNOTAS:")
    for n in notes:
        print(" •", n)
    print(" • Doutrina (erros): vem das `correcoes` que o próprio Fable apontou (ver _ab/*.delta.json)")
    print("   + leitura humana do dump — código não pega erro de conteúdo (princípio do projeto).")
    print("\n⚠️  Custo no Max: cada chamada carrega ~31K tokens de overhead fixo → a economia em $")
    print("    aqui SUBESTIMA a da API/Batch (lá o custo é output-driven, e o delta do revisor é pequeno).")
    print("    Este teste mede QUALIDADE (recupera os itens-ouro?). Decisão final: leia o dump do vencedor.")


if __name__ == "__main__":
    asyncio.run(main())
