"""
Extrai questoes de UM assunto LENDO O BANCO DIRETO (via tunnel SSH)
- ZERO POST /responder, ZERO contaminacao de stats.
- Le gabarito_correto direto da coluna no DB.

Pre-requisito:
    Aldemir abre o tunnel SSH em outra janela:
        ssh -L 5433:127.0.0.1:5433 root@95.217.197.95

Uso:
    python scripts/papiro/questoes-teste/extract_via_db.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

# ---------- Config ----------

ASSUNTO = "Da Competência (arts. 11 a 17 da Lei nº 9.784/1999)"
BANCA   = "CEBRASPE (CESPE)"
ANO_MIN = 2020
ANO_MAX = 2025
LIMIT   = 100  # safety cap; nao haveria mais que 51 dado o universo conhecido

VERUS_API_ENV = Path(r"D:/verus_api/.env")
OUT_DIR = Path(__file__).parent

# ---------- Helpers ----------

def slugify(s: str) -> str:
    nfd = unicodedata.normalize("NFD", s)
    no_diacritics = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    slug = re.sub(r"[^a-z0-9]+", "-", no_diacritics.lower())
    return slug.strip("-")[:80]


def read_database_url() -> str:
    if not VERUS_API_ENV.exists():
        sys.exit(f"ERRO: nao encontrei {VERUS_API_ENV}")
    env = dotenv_values(str(VERUS_API_ENV))
    url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("ERRO: DATABASE_URL nao encontrado no .env do verus_api")
    # psycopg2 nao aceita prefixo SQLAlchemy "postgresql+psycopg2://"
    url = re.sub(r"^postgresql\+psycopg2://", "postgresql://", url)
    return url


# ---------- Query ----------

QUERY = """
SELECT
    id,
    enunciado,
    alternativas,
    gabarito_correto,
    resposta_correta,
    tipo,
    banca,
    assunto,
    ano,
    anulada,
    desatualizada
FROM questoes
WHERE assunto = %(assunto)s
  AND banca = %(banca)s
  AND ano BETWEEN %(ano_min)s AND %(ano_max)s
  AND COALESCE(anulada, false) = false
  AND COALESCE(desatualizada, false) = false
  AND gabarito_correto IS NOT NULL
ORDER BY ano DESC NULLS LAST, id DESC
LIMIT %(limit)s
"""

# ---------- Saida ----------

def normalizar_tipo(tipo_raw: str | None, alternativas: list[str]) -> str:
    if not tipo_raw:
        # fallback: se sao 2 alternativas certo/errado, marca CE
        if len(alternativas) == 2 and {a.strip().lower() for a in alternativas} == {"certo", "errado"}:
            return "CERTO_ERRADO"
        return "DESCONHECIDO"
    t = tipo_raw.strip().lower()
    if t in {"certo_errado", "certo-errado", "ce"}:
        return "CERTO_ERRADO"
    if t in {"multipla_escolha", "multipla-escolha", "me", "objetiva"}:
        return "MULTIPLA_ESCOLHA"
    return tipo_raw.upper()


def to_out(row: psycopg2.extras.DictRow) -> dict:
    alternativas: list[str] = list(row["alternativas"] or [])
    gab_idx: int | None = row["gabarito_correto"]
    gab_texto = None
    if gab_idx is not None and 0 <= gab_idx < len(alternativas):
        gab_texto = alternativas[gab_idx]
    elif row.get("resposta_correta"):
        gab_texto = row["resposta_correta"]

    return {
        "id": row["id"],
        "enunciado": row["enunciado"],
        "tipoQuestao": normalizar_tipo(row["tipo"], alternativas),
        "alternativas": alternativas,
        "numeroAlternativaCorreta": gab_idx,
        "gabarito": gab_texto,
        "bancaSigla": row["banca"],
        "concursoAno": row["ano"],
        "nomeAssunto": row["assunto"],
    }


# ---------- Main ----------

def main() -> None:
    dsn = read_database_url()
    # nao logar a DSN, mesmo redacted
    print("[db] conectando via tunnel local (127.0.0.1:5433)")

    try:
        conn = psycopg2.connect(dsn, connect_timeout=5)
    except psycopg2.OperationalError as e:
        sys.exit(
            "ERRO: nao foi possivel conectar ao DB.\n"
            "Verifique se o tunnel SSH esta aberto:\n"
            "    ssh -L 5433:127.0.0.1:5433 root@95.217.197.95\n"
            f"Detalhe: {e}"
        )

    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            QUERY,
            {
                "assunto": ASSUNTO,
                "banca": BANCA,
                "ano_min": ANO_MIN,
                "ano_max": ANO_MAX,
                "limit": LIMIT,
            },
        )
        rows = cur.fetchall()

    print(f"[db] {len(rows)} questoes retornadas")

    saida = [to_out(r) for r in rows]

    # contagem por tipo/ano
    por_tipo: dict[str, int] = {}
    por_ano: dict[int, int] = {}
    for q in saida:
        por_tipo[q["tipoQuestao"]] = por_tipo.get(q["tipoQuestao"], 0) + 1
        por_ano[q["concursoAno"] or 0] = por_ano.get(q["concursoAno"] or 0, 0) + 1
    print(f"[stats] por tipo: {por_tipo}")
    print(f"[stats] por ano:  {dict(sorted(por_ano.items(), reverse=True))}")

    slug = slugify(ASSUNTO)
    out_path = OUT_DIR / f"{slug}.json"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)
    print(f"\nSalvo em: {out_path}  ({len(saida)} questoes)")


if __name__ == "__main__":
    main()
