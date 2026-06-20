"""
V2 — Extrator de inventario por folha da taxonomia (read-only via DB).

Filtros fixos:
  - Anos 2019-2025
  - Bancas: CEBRASPE (CESPE), VUNESP, FCC, FGV, QUADRIX, FUNDATEC
  - anulada=false, desatualizada=false, gabarito_correto IS NOT NULL

Estrutura de saida (espelha arvore da taxonomia):
  D:\\inventario-v2\\
    <materia-slug>\\
      _inventario.json
      <pai-slug>\\         (se a folha tem pai nao-sintetico)
        <folha-slug>\\
          _meta.json
          lote-001.json
          lote-002.json
          ...
      <folha-slug-direta>\\ (se a folha esta na raiz da materia)
        _meta.json
        lote-001.json

Lotes: 50 questoes cada. Ordem aleatoria com seed deterministica por folha
(hash(materia + node_id)) — lote-001 do mesmo node sempre tem as mesmas 50.

Idempotente: se pasta da folha ja existe com _meta.json e o universo bate,
pula. Senao, re-extrai aquela folha (apaga lote-*.json antigos da pasta).

Pre-requisito: tunnel SSH aberto em outra janela:
    ssh -L 5433:127.0.0.1:5433 root@95.217.197.95

Uso:
    python scripts/papiro/questoes-teste/extract_v2.py
"""

from __future__ import annotations

import hashlib
import json
import random
import re
import socket
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:
    pass

VERUS_API_ENV = Path(r"D:/verus_api/.env")
OUTPUT_ROOT = Path(r"D:/inventario-v2")

ANO_MAX = 2026
ANO_MIN_DIREITO = 2019      # Direito e legislação
ANO_MIN_OUTRAS = 2019       # demais (Português, exatas, contabilidade, informática)
BANCAS = ["CEBRASPE (CESPE)", "VUNESP", "FCC", "FGV", "QUADRIX", "FUNDATEC", "CESGRANRIO", "Instituto AOCP", "AOCP"]
LOTE_SIZE = 50


# ---------- Helpers ----------

def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def ano_min_materia(materia: str) -> int:
    """Janela de ano por grupo: Direito/legislação desde 2019; demais desde 2015."""
    m = strip_accents(materia).lower()
    if m.startswith("direito") or "legisla" in m or "humanos" in m:
        return ANO_MIN_DIREITO
    return ANO_MIN_OUTRAS


def slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", strip_accents(s).lower())).strip("-")[:120]


def normalize(s: str) -> str:
    norm = strip_accents(s).lower()
    return re.sub(r"(\d)[.,](?=\d)", r"\1", norm)


def matches_all_tokens(text_norm: str, tokens_norm: list[str]) -> bool:
    return all(re.search(r"\b" + re.escape(t), text_norm) for t in tokens_norm)


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    raw = input(f"{prompt}{suffix}: ").strip()
    return raw if raw else default


def confirm(prompt: str, default_yes: bool = True) -> bool:
    suffix = " [S/n]" if default_yes else " [s/N]"
    raw = input(f"{prompt}{suffix}: ").strip().lower()
    if not raw:
        return default_yes
    return raw in {"s", "sim", "y", "yes"}


def read_database_url() -> str:
    env = dotenv_values(str(VERUS_API_ENV))
    url = env.get("DATABASE_URL", "")
    return re.sub(r"^postgresql\+psycopg2://", "postgresql://", url)


def tunnel_aberto() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 5433), timeout=2):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def seed_para_folha(materia: str, node_id: int) -> int:
    h = hashlib.sha256(f"{materia}|{node_id}".encode("utf-8")).hexdigest()
    return int(h[:16], 16)


# ---------- Resolucao da materia ----------

def resolver_materia(cur, termo_user: str) -> str | None:
    tokens = [t for t in re.split(r"[^\w]+", termo_user.strip(), flags=re.UNICODE) if t]
    if not tokens:
        return None
    cur.execute("""
        SELECT materia, COUNT(*) AS n FROM questoes
        WHERE materia IS NOT NULL GROUP BY materia ORDER BY n DESC
    """)
    materias = cur.fetchall()
    tokens_n = [normalize(t) for t in tokens]
    hits = [m for m in materias if matches_all_tokens(normalize(m["materia"]), tokens_n)]
    if not hits:
        print(f"  nenhuma materia casa com {tokens}")
        return None
    if len(hits) == 1:
        print(f"  match unico: {hits[0]['materia']} ({hits[0]['n']:,} questoes)")
        return hits[0]["materia"]
    print(f"  {len(hits)} match(es):")
    for i, h in enumerate(hits[:15], 1):
        print(f"    {i:>2}) {h['materia']}  ({h['n']:,} questoes)")
    escolha = ask("  escolha o numero", "1")
    try:
        idx = int(escolha) - 1
        if 0 <= idx < len(hits):
            return hits[idx]["materia"]
    except ValueError:
        pass
    return None


# ---------- Folhas da materia ----------

def listar_folhas(cur, materia: str) -> list[dict]:
    """Retorna lista de folhas (nodes sem filhos, nao sinteticos) da materia,
    com chain de ancestrais (do mais antigo ao mais novo)."""
    cur.execute("""
        WITH com_filhos AS (
            SELECT DISTINCT parent_id FROM taxonomia_nodes WHERE parent_id IS NOT NULL
        )
        SELECT id, nome, parent_id, nivel, hierarquia, fonte
        FROM taxonomia_nodes
        WHERE materia = %s
          AND is_sintetico = false
          AND id NOT IN (SELECT parent_id FROM com_filhos)
        ORDER BY hierarquia NULLS LAST, id
    """, (materia,))
    folhas = list(cur.fetchall())

    # Carrega todos os nodes da materia pra montar ancestrais
    cur.execute("""
        SELECT id, nome, parent_id, is_sintetico
        FROM taxonomia_nodes
        WHERE materia = %s
    """, (materia,))
    by_id = {r["id"]: r for r in cur.fetchall()}

    def ancestrais(node_id: int) -> list[dict]:
        chain: list[dict] = []
        cur_id = by_id.get(node_id, {}).get("parent_id")
        while cur_id:
            n = by_id.get(cur_id)
            if not n:
                break
            if not n["is_sintetico"]:
                chain.append({"id": n["id"], "nome": n["nome"]})
            cur_id = n["parent_id"]
        chain.reverse()
        return chain

    return [
        {
            **dict(f),
            "ancestrais": ancestrais(f["id"]),
            "is_mescladas": bool(re.search(r"mesclad", normalize(f["nome"]))),
        }
        for f in folhas
    ]


# ---------- Contagem e extracao ----------

PREVIEW_SQL = """
SELECT
  taxonomia_node_id AS node_id,
  COUNT(*) AS n
FROM questoes
WHERE materia = %(materia)s
  AND banca = ANY(%(bancas)s)
  AND ano BETWEEN %(ano_min)s AND %(ano_max)s
  AND COALESCE(anulada, false) = false
  AND COALESCE(desatualizada, false) = false
  AND gabarito_correto IS NOT NULL
  AND taxonomia_node_id = ANY(%(node_ids)s)
GROUP BY taxonomia_node_id
"""

EXTRACT_SQL = """
SELECT
  id, enunciado, alternativas, gabarito_correto, resposta_correta,
  tipo, banca, materia, assunto, ano
FROM questoes
WHERE taxonomia_node_id = %(node_id)s
  AND banca = ANY(%(bancas)s)
  AND ano BETWEEN %(ano_min)s AND %(ano_max)s
  AND COALESCE(anulada, false) = false
  AND COALESCE(desatualizada, false) = false
  AND gabarito_correto IS NOT NULL
ORDER BY id
"""


def normalizar_tipo(tipo_raw: str | None, alternativas: list[str]) -> str:
    if not tipo_raw:
        if len(alternativas) == 2 and {a.strip().lower() for a in alternativas} == {"certo", "errado"}:
            return "CERTO_ERRADO"
        return "DESCONHECIDO"
    t = tipo_raw.strip().lower()
    if t in {"certo_errado", "certo-errado", "ce"}:
        return "CERTO_ERRADO"
    if t in {"multipla_escolha", "multipla-escolha", "me", "objetiva"}:
        return "MULTIPLA_ESCOLHA"
    return tipo_raw.upper()


def to_out(row) -> dict:
    alternativas = list(row["alternativas"] or [])
    gab_idx = row["gabarito_correto"]
    gab_texto = (
        alternativas[gab_idx]
        if gab_idx is not None and 0 <= gab_idx < len(alternativas)
        else row.get("resposta_correta")
    )
    return {
        "id": row["id"],
        "enunciado": row["enunciado"],
        "tipoQuestao": normalizar_tipo(row["tipo"], alternativas),
        "alternativas": alternativas,
        "numeroAlternativaCorreta": gab_idx,
        "gabarito": gab_texto,
        "bancaSigla": row["banca"],
        "concursoAno": row["ano"],
        "nomeMateria": row["materia"],
        "nomeAssunto": row["assunto"],
    }


# ---------- Filesystem ----------

def caminho_folha_base(materia: str, folha: dict) -> Path:
    """Constroi path bruto: D:/inventario-v2/<materia-slug>/[<ancestrais...>/]<folha-slug>/"""
    p = OUTPUT_ROOT / slugify(materia)
    for anc in folha["ancestrais"]:
        p = p / slugify(anc["nome"])
    p = p / slugify(folha["nome"])
    return p


def mapear_paths_unicos(materia: str, folhas: list[dict]) -> dict[int, Path]:
    """Pre-calcula path final por node_id. Se 2+ folhas mapeiam pro mesmo path
    (nomes idênticos sob mesmo pai), sufixa com __<node_id> em TODAS as folhas
    do grupo colidido — garante unicidade preservando rastreabilidade."""
    grupos: dict[Path, list[dict]] = {}
    for f in folhas:
        base = caminho_folha_base(materia, f)
        grupos.setdefault(base, []).append(f)

    final: dict[int, Path] = {}
    colisoes = 0
    for base, grupo in grupos.items():
        if len(grupo) == 1:
            final[grupo[0]["id"]] = base
        else:
            colisoes += 1
            for f in grupo:
                final[f["id"]] = base.parent / f"{base.name}__{f['id']}"
    if colisoes:
        print(f"  ⚠ {colisoes} colisao(es) de nome detectada(s) — folhas afetadas ganham sufixo __<node_id>")
    return final


def salvar_lotes(folha_path: Path, questoes: list[dict], lote_size: int) -> int:
    """Particiona em lotes de N e salva lote-NNN.json. Retorna numero de lotes."""
    folha_path.mkdir(parents=True, exist_ok=True)
    # apaga lote-*.json antigos
    for f in folha_path.glob("lote-*.json"):
        f.unlink()

    n_lotes = 0
    for i in range(0, len(questoes), lote_size):
        n_lotes += 1
        chunk = questoes[i : i + lote_size]
        out = folha_path / f"lote-{n_lotes:03d}.json"
        out.write_text(json.dumps(chunk, ensure_ascii=False, indent=2), encoding="utf-8")
    return n_lotes


def gerar_meta(folha: dict, materia: str, questoes: list[dict], n_lotes: int) -> dict:
    por_tipo: dict[str, int] = {}
    por_ano: dict[int, int] = {}
    por_banca: dict[str, int] = {}
    for q in questoes:
        por_tipo[q["tipoQuestao"]] = por_tipo.get(q["tipoQuestao"], 0) + 1
        por_ano[q["concursoAno"]] = por_ano.get(q["concursoAno"], 0) + 1
        por_banca[q["bancaSigla"]] = por_banca.get(q["bancaSigla"], 0) + 1
    return {
        "materia": materia,
        "ancestrais": [a["nome"] for a in folha["ancestrais"]],
        "folha": folha["nome"],
        "node_id": folha["id"],
        "is_mescladas": folha["is_mescladas"],
        "fonte_taxonomia": folha["fonte"],
        "total_questoes": len(questoes),
        "n_lotes": n_lotes,
        "lote_size": LOTE_SIZE,
        "por_tipo": por_tipo,
        "por_ano": dict(sorted(por_ano.items(), reverse=True)),
        "por_banca": dict(sorted(por_banca.items(), key=lambda kv: -kv[1])),
        "extraido_em": datetime.now().isoformat(timespec="seconds"),
    }


# ---------- Fluxo principal ----------

def processar_materia(cur, materia: str) -> None:
    amin = ano_min_materia(materia)
    print(f"\n=== Listando folhas de {materia!r} (anos {amin}-{ANO_MAX}) ===")
    folhas = listar_folhas(cur, materia)
    print(f"  {len(folhas)} folha(s) encontrada(s)")

    if not folhas:
        print("  nenhuma folha (matéria sem taxonomia importada?)")
        return

    # Pre-calcula paths unicos (suffix __<node_id> em colisoes)
    path_map = mapear_paths_unicos(materia, folhas)

    # Preview: count por folha
    node_ids = [f["id"] for f in folhas]
    cur.execute(
        PREVIEW_SQL,
        {"materia": materia, "bancas": BANCAS, "ano_min": amin, "ano_max": ANO_MAX, "node_ids": node_ids},
    )
    counts = {r["node_id"]: r["n"] for r in cur.fetchall()}

    total_questoes = sum(counts.values())
    folhas_com_questoes = sum(1 for f in folhas if counts.get(f["id"], 0) > 0)
    folhas_vazias = len(folhas) - folhas_com_questoes
    total_lotes = sum((counts.get(f["id"], 0) + LOTE_SIZE - 1) // LOTE_SIZE for f in folhas)

    print(f"\n  Universo V2: {total_questoes:,} questoes")
    print(f"  Folhas com questoes: {folhas_com_questoes}")
    print(f"  Folhas vazias:       {folhas_vazias}")
    print(f"  Lotes previstos:     {total_lotes}")
    print(f"  Output: {OUTPUT_ROOT / slugify(materia)}")

    if not confirm("\nConfirmar extração?"):
        print("cancelado.")
        return

    # Loop: extrai cada folha
    pulou = 0
    extraiu = 0
    vazias = 0
    for i, folha in enumerate(folhas, 1):
        n = counts.get(folha["id"], 0)
        folha_path = path_map[folha["id"]]
        meta_path = folha_path / "_meta.json"

        # Pasta vazia: cria diretorio + meta, sem lotes
        if n == 0:
            folha_path.mkdir(parents=True, exist_ok=True)
            meta = gerar_meta(folha, materia, [], 0)
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            vazias += 1
            continue

        # Idempotencia: skip se meta existe e bate
        if meta_path.exists():
            try:
                existing = json.loads(meta_path.read_text(encoding="utf-8"))
                if existing.get("total_questoes") == n:
                    pulou += 1
                    if i % 20 == 0:
                        print(f"  [{i}/{len(folhas)}] skipped: {folha['nome'][:60]}")
                    continue
            except Exception:
                pass

        # Extrai questoes
        cur.execute(
            EXTRACT_SQL,
            {"node_id": folha["id"], "bancas": BANCAS, "ano_min": amin, "ano_max": ANO_MAX},
        )
        rows = cur.fetchall()
        questoes = [to_out(r) for r in rows]

        # Embaralha com seed deterministica
        rng = random.Random(seed_para_folha(materia, folha["id"]))
        rng.shuffle(questoes)

        n_lotes = salvar_lotes(folha_path, questoes, LOTE_SIZE)
        meta = gerar_meta(folha, materia, questoes, n_lotes)
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        extraiu += 1
        marker = " [M]" if folha["is_mescladas"] else ""
        print(f"  [{i}/{len(folhas)}] {folha['nome'][:60]:60s} | {n:>4} q / {n_lotes:>3} lotes{marker}")

    # Inventario da materia
    inv_path = OUTPUT_ROOT / slugify(materia) / "_inventario.json"
    inv_path.parent.mkdir(parents=True, exist_ok=True)
    inv = {
        "materia": materia,
        "n_folhas": len(folhas),
        "folhas_com_questoes": folhas_com_questoes,
        "folhas_vazias": folhas_vazias,
        "total_questoes": total_questoes,
        "total_lotes": total_lotes,
        "extraido_em": datetime.now().isoformat(timespec="seconds"),
        "filtros": {
            "anos": [amin, ANO_MAX],
            "bancas": BANCAS,
            "anulada": False,
            "desatualizada": False,
            "gabarito_correto": "IS NOT NULL",
        },
    }
    inv_path.write_text(json.dumps(inv, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n  Extracao concluida: {extraiu} novas + {pulou} pre-existentes + {vazias} vazias")
    print(f"  Inventario: {inv_path}")


def main() -> int:
    print("=" * 60)
    print("V2 — Extrator de inventário por folha da taxonomia")
    print("=" * 60)
    print(f"  Output: {OUTPUT_ROOT}")
    print(f"  Filtros: Direito {ANO_MIN_DIREITO}-{ANO_MAX} / outras {ANO_MIN_OUTRAS}-{ANO_MAX}, {len(BANCAS)} bancas, sem anuladas/desatualizadas, gabarito NOT NULL")
    print(f"  Lotes: {LOTE_SIZE} questoes cada, ordem aleatoria com seed deterministica")

    if not tunnel_aberto():
        print("\nERRO: tunnel SSH fechado. Abra em outra janela:")
        print("    ssh -L 5433:127.0.0.1:5433 root@95.217.197.95")
        return 1

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    conn = psycopg2.connect(read_database_url(), connect_timeout=5)

    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        while True:
            termo = ask("\nMatéria (palavras-chave; vazio = sair)")
            if not termo:
                print("saindo.")
                return 0
            materia = resolver_materia(cur, termo)
            if materia:
                processar_materia(cur, materia)
            if not confirm("\nProcessar outra materia?", default_yes=False):
                print("saindo.")
                return 0


if __name__ == "__main__":
    sys.exit(main())
