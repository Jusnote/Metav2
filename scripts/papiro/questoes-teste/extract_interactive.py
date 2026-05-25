"""
Extrator interativo de questoes — le DB direto (read-only, sem POST).

Pre-requisito: tunnel SSH aberto em outra janela:
    ssh -L 5433:127.0.0.1:5433 root@95.217.197.95

Uso:
    python scripts/papiro/questoes-teste/extract_interactive.py
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

# Forca UTF-8 no terminal Windows (cp1252 quebra com ✓ e acentos)
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:
    pass

VERUS_API_ENV = Path(r"D:/verus_api/.env")
OUT_DIR = Path(__file__).parent


# ---------- Helpers basicos ----------

def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def slugify(s: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", strip_accents(s).lower())
    return slug.strip("-")[:80]


def normalize(s: str) -> str:
    # remove acentos, lower, e colapsa pontos/virgulas entre digitos
    # ("9.784" ~ "9784", "10,50" ~ "1050") pra busca fuzzy ficar tolerante
    norm = strip_accents(s).lower()
    norm = re.sub(r"(\d)[.,](?=\d)", r"\1", norm)
    return norm


def matches_all_tokens(text_norm: str, tokens_norm: list[str]) -> bool:
    """Cada token precisa ocorrer como INICIO de palavra (\\b<token>) na
    string normalizada. Isso evita falsos positivos do tipo 'atos' casando
    dentro de 'contr*atos*'. Ainda permite prefixo: 'admin' casa
    'Administrativo'."""
    return all(re.search(r"\b" + re.escape(t), text_norm) for t in tokens_norm)


def read_database_url() -> str:
    if not VERUS_API_ENV.exists():
        sys.exit(f"ERRO: nao encontrei {VERUS_API_ENV}")
    env = dotenv_values(str(VERUS_API_ENV))
    url = env.get("DATABASE_URL")
    if not url:
        sys.exit("ERRO: DATABASE_URL nao encontrado")
    return re.sub(r"^postgresql\+psycopg2://", "postgresql://", url)


def ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    raw = input(f"{prompt}{suffix}: ").strip()
    return raw if raw else (default or "")


def confirm(prompt: str, default_yes: bool = True) -> bool:
    suffix = " [S/n]" if default_yes else " [s/N]"
    raw = input(f"{prompt}{suffix}: ").strip().lower()
    if not raw:
        return default_yes
    return raw in {"s", "sim", "y", "yes"}


# ---------- Resolvers ----------

def resolver_materia(cur, termo_user: str) -> str | None:
    # split por qualquer nao-letra/nao-digito (parenteses, pontos, hifen viram separador)
    tokens = [t for t in re.split(r"[^\w]+", termo_user.strip(), flags=re.UNICODE) if t]
    if not tokens:
        return None

    cur.execute(
        "SELECT materia, COUNT(*) AS n FROM questoes "
        "WHERE materia IS NOT NULL GROUP BY materia ORDER BY n DESC"
    )
    materias = cur.fetchall()
    tokens_norm = [normalize(t) for t in tokens]
    hits = [m for m in materias if matches_all_tokens(normalize(m["materia"]), tokens_norm)]

    if not hits:
        print(f"  nenhuma materia casa {tokens}")
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
    print("  escolha invalida")
    return None


def _parse_selecao(s: str, n_total: int) -> list[int] | None:
    """Aceita: '1', '1,3,5', '1-5', 'all'/'*'. Retorna lista de indices 0-based."""
    s = s.strip().lower()
    if not s:
        return [0]
    if s in {"all", "*", "todos", "tudo"}:
        return list(range(n_total))
    if "-" in s and "," not in s:
        a, b = s.split("-", 1)
        try:
            ai, bi = int(a.strip()) - 1, int(b.strip()) - 1
        except ValueError:
            return None
        lo, hi = sorted([ai, bi])
        return [i for i in range(lo, hi + 1) if 0 <= i < n_total]
    try:
        idxs = [int(x.strip()) - 1 for x in s.split(",") if x.strip()]
    except ValueError:
        return None
    idxs = [i for i in idxs if 0 <= i < n_total]
    return idxs or None


def resolver_assunto(cur, termo_user: str, materia: str | None) -> list[str] | None:
    """Busca fuzzy. Retorna lista (pode ser 1 ou varios assuntos selecionados)."""
    # split por qualquer nao-letra/nao-digito (parenteses, pontos, hifen viram separador)
    tokens = [t for t in re.split(r"[^\w]+", termo_user.strip(), flags=re.UNICODE) if t]
    if not tokens:
        return None

    if materia:
        cur.execute(
            "SELECT assunto, COUNT(*) AS n FROM questoes "
            "WHERE assunto IS NOT NULL AND materia = %s "
            "GROUP BY assunto",
            (materia,),
        )
    else:
        cur.execute(
            "SELECT assunto, COUNT(*) AS n FROM questoes "
            "WHERE assunto IS NOT NULL GROUP BY assunto"
        )
    rows = cur.fetchall()

    tokens_norm = [normalize(t) for t in tokens]
    hits = [(r["assunto"], r["n"]) for r in rows if matches_all_tokens(normalize(r["assunto"]), tokens_norm)]

    if not hits:
        print(f"  nenhum assunto contem todos os termos {tokens}")
        return None

    if len(hits) == 1:
        print(f"  match unico: {hits[0][0]}  ({hits[0][1]:,} questoes)")
        return [hits[0][0]]

    # ordena por contagem desc (mais frequente primeiro), limita a 30
    hits = sorted(hits, key=lambda h: -h[1])[:30]
    print(f"  {len(hits)} match(es):")
    for i, (a, n) in enumerate(hits, 1):
        print(f"    {i:>2}) {a}  ({n:,} questoes)")
    escolha = ask("  escolha (numero, '1,3,5', '1-5', 'all')", "1")
    idxs = _parse_selecao(escolha, len(hits))
    if not idxs:
        print("  escolha invalida")
        return None
    selecao = [hits[i][0] for i in idxs]
    if len(selecao) > 1:
        print(f"  -> {len(selecao)} assunto(s) selecionado(s)")
    return selecao


def _resolver_uma_banca(cur, termo: str, materia, assuntos) -> str | None:
    """Resolve UM termo fuzzy para uma banca. Usado pelo multi-resolver."""
    tokens = [t for t in re.split(r"[^\w]+", termo.strip(), flags=re.UNICODE) if t]
    if not tokens:
        return None

    where_parts = ["banca IS NOT NULL"]
    params: list = []
    if materia:
        where_parts.append("materia = %s")
        params.append(materia)
    if assuntos:
        where_parts.append("assunto = ANY(%s)")
        params.append(assuntos)
    where_sql = " AND ".join(where_parts)
    cur.execute(
        f"SELECT banca, COUNT(*) AS n FROM questoes "
        f"WHERE {where_sql} GROUP BY banca ORDER BY n DESC",
        params,
    )
    bancas = cur.fetchall()
    tokens_norm = [normalize(t) for t in tokens]
    hits = [b for b in bancas if matches_all_tokens(normalize(b["banca"]), tokens_norm)]

    if not hits:
        print(f"  '{termo.strip()}': nenhuma banca casa")
        return None

    if len(hits) == 1:
        print(f"  '{termo.strip()}' -> {hits[0]['banca']}  ({hits[0]['n']:,} questoes)")
        return hits[0]["banca"]

    print(f"  '{termo.strip()}': {len(hits)} match(es)")
    for i, h in enumerate(hits[:15], 1):
        print(f"    {i:>2}) {h['banca']}  ({h['n']:,} questoes)")
    escolha = ask("  escolha o numero", "1")
    try:
        idx = int(escolha) - 1
        if 0 <= idx < len(hits):
            return hits[idx]["banca"]
    except ValueError:
        pass
    print("  escolha invalida")
    return None


def resolver_banca(
    cur,
    termo_user: str,
    materia: str | None = None,
    assuntos: list[str] | None = None,
) -> list[str] | None:
    """Aceita 1 ou varias bancas separadas por virgula. Ex: 'cespe, fcc, fgv'.
    Cada chunk e resolvido individualmente; se um chunk tem multiplos matches,
    pede escolha. Retorna lista deduplicada."""
    chunks = [c.strip() for c in termo_user.split(",") if c.strip()]
    if not chunks:
        return None

    resultado: list[str] = []
    for chunk in chunks:
        b = _resolver_uma_banca(cur, chunk, materia, assuntos)
        if b and b not in resultado:
            resultado.append(b)

    if not resultado:
        return None
    if len(chunks) > 1:
        print(f"  -> {len(resultado)} banca(s) selecionada(s)")
    return resultado


def contar_universo(
    cur,
    materia: str | None = None,
    assuntos: list[str] | None = None,
    bancas: list[str] | None = None,
) -> int:
    """Conta questoes restantes dado o conjunto de filtros ja escolhidos."""
    where_parts: list[str] = ["1=1"]
    params: list = []
    if materia:
        where_parts.append("materia = %s")
        params.append(materia)
    if assuntos:
        where_parts.append("assunto = ANY(%s)")
        params.append(assuntos)
    if bancas:
        where_parts.append("banca = ANY(%s)")
        params.append(bancas)
    cur.execute(
        f"SELECT COUNT(*) AS n FROM questoes WHERE {' AND '.join(where_parts)}",
        params,
    )
    return cur.fetchone()["n"]


def print_universo(cur, **filtros) -> None:
    n = contar_universo(cur, **filtros)
    print(f"  >>> universo atual: {n:,} questoes")


def parse_anos(s: str) -> list[int]:
    """Aceita: '2020-2025', '2020,2022,2024', '2024', 'all'."""
    s = s.strip().lower()
    if not s or s in {"all", "todos", "tudo"}:
        return []  # vazio = sem filtro
    if "-" in s and "," not in s:
        a, b = s.split("-", 1)
        ai, bi = int(a.strip()), int(b.strip())
        return list(range(min(ai, bi), max(ai, bi) + 1))
    return [int(x.strip()) for x in s.split(",") if x.strip()]


# ---------- Query / saida ----------

QUERY_PREVIEW = """
SELECT
    tipo,
    ano,
    COALESCE(anulada, false) AS anulada,
    COALESCE(desatualizada, false) AS desatualizada,
    COUNT(*) AS n
FROM questoes
WHERE assunto = ANY(%(assuntos)s)
  {materia_clause}
  {banca_clause}
  {anos_clause}
  {anulada_clause}
  {desatualizada_clause}
  AND gabarito_correto IS NOT NULL
GROUP BY tipo, ano, COALESCE(anulada, false), COALESCE(desatualizada, false)
ORDER BY ano DESC, tipo
"""

QUERY_EXTRACT = """
SELECT
    id, enunciado, alternativas, gabarito_correto, resposta_correta,
    tipo, banca, materia, assunto, ano,
    COALESCE(anulada, false) AS anulada,
    COALESCE(desatualizada, false) AS desatualizada
FROM questoes
WHERE assunto = ANY(%(assuntos)s)
  {materia_clause}
  {banca_clause}
  {anos_clause}
  {anulada_clause}
  {desatualizada_clause}
  AND gabarito_correto IS NOT NULL
ORDER BY {order_by}
LIMIT %(limit)s
"""

ORDER_BY = {
    "recentes": "ano DESC NULLS LAST, id DESC",
    "aleatorio": "RANDOM()",
}


def build_clauses(
    materia: str | None,
    bancas: list[str] | None,
    anos: list[int],
    incluir_anuladas: bool,
    incluir_desatualizadas: bool,
) -> tuple[str, str, str, str, str, dict]:
    params: dict = {}
    materia_clause = ""
    if materia:
        materia_clause = "AND materia = %(materia)s"
        params["materia"] = materia
    banca_clause = ""
    if bancas:
        banca_clause = "AND banca = ANY(%(bancas)s)"
        params["bancas"] = bancas
    anos_clause = ""
    if anos:
        anos_clause = "AND ano = ANY(%(anos)s)"
        params["anos"] = anos
    anulada_clause = "" if incluir_anuladas else "AND COALESCE(anulada, false) = false"
    desatualizada_clause = "" if incluir_desatualizadas else "AND COALESCE(desatualizada, false) = false"
    return materia_clause, banca_clause, anos_clause, anulada_clause, desatualizada_clause, params


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
        "nomeMateria": row.get("materia"),
        "nomeAssunto": row["assunto"],
        "anulada": bool(row.get("anulada")),
        "desatualizada": bool(row.get("desatualizada")),
    }


# ---------- Fluxo principal ----------

def main() -> None:
    print("=" * 60)
    print("Extrator interativo de questoes (read-only via DB)")
    print("=" * 60)

    try:
        conn = psycopg2.connect(read_database_url(), connect_timeout=5)
    except psycopg2.OperationalError as e:
        sys.exit(
            "ERRO: nao conectou ao DB. O tunnel SSH esta aberto?\n"
            "    ssh -L 5433:127.0.0.1:5433 root@95.217.197.95\n"
            f"Detalhe: {e}"
        )

    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # 1) Materia
        materia: str | None = None
        while not materia:
            termo = ask("\nMateria (palavras-chave; vazio = sair)")
            if not termo:
                print("saindo.")
                return
            materia = resolver_materia(cur, termo)
        print_universo(cur, materia=materia)

        # 2) Assunto (restrito a materia escolhida; pode escolher varios)
        assuntos: list[str] | None = None
        termo_assunto = ""
        while not assuntos:
            termo_assunto = ask("\nAssunto (palavras-chave; vazio = sair)")
            if not termo_assunto:
                print("saindo.")
                return
            assuntos = resolver_assunto(cur, termo_assunto, materia)
        print_universo(cur, materia=materia, assuntos=assuntos)

        # 3) Banca(s)
        bancas: list[str] | None = None
        termo_banca = ask("\nBanca (Enter = todas; separe por virgula pra varias, ex: cespe, fcc, fgv)")
        if termo_banca:
            bancas = resolver_banca(cur, termo_banca, materia=materia, assuntos=assuntos)
            if not bancas and not confirm("seguir sem filtro de banca?", default_yes=False):
                return
        print_universo(cur, materia=materia, assuntos=assuntos, bancas=bancas)

        # 4) Anos
        ano_atual = datetime.now().year
        default_anos = f"{ano_atual - 5}-{ano_atual}"
        anos_raw = ask("\nAnos (ex: 2020-2025, 2024,2025, all)", default_anos)
        try:
            anos = parse_anos(anos_raw)
        except ValueError:
            print(f"  formato invalido: {anos_raw!r}")
            return

        # 5) Anuladas / desatualizadas
        incluir_anuladas = confirm("\nIncluir anuladas?", default_yes=False)
        incluir_desatualizadas = confirm("Incluir desatualizadas?", default_yes=False)

        # 6) Limit
        try:
            limit = int(ask("\nLimit", "100"))
        except ValueError:
            print("  limit invalido")
            return

        # 6b) Ordenacao
        ordem_raw = ask("Ordem (recentes / aleatorio)", "recentes").strip().lower()
        if ordem_raw not in ORDER_BY:
            print(f"  ordem invalida ({ordem_raw!r}); usando 'recentes'")
            ordem_raw = "recentes"

        # 7) Preview
        (
            materia_clause,
            banca_clause,
            anos_clause,
            anulada_clause,
            desatualizada_clause,
            params,
        ) = build_clauses(materia, bancas, anos, incluir_anuladas, incluir_desatualizadas)
        params.update({"assuntos": assuntos})
        cur.execute(
            QUERY_PREVIEW.format(
                materia_clause=materia_clause,
                banca_clause=banca_clause,
                anos_clause=anos_clause,
                anulada_clause=anulada_clause,
                desatualizada_clause=desatualizada_clause,
            ),
            params,
        )
        preview = cur.fetchall()
        total_disponivel = sum(r["n"] for r in preview)

        print("\n" + "-" * 60)
        print(f"Materia:        {materia}")
        if len(assuntos) == 1:
            print(f"Assunto:        {assuntos[0]}")
        else:
            print(f"Assuntos:       {len(assuntos)} selecionado(s)")
            for a in assuntos:
                print(f"                - {a}")
        if not bancas:
            print(f"Banca:          (todas)")
        elif len(bancas) == 1:
            print(f"Banca:          {bancas[0]}")
        else:
            print(f"Bancas:         {len(bancas)} selecionada(s)")
            for b in bancas:
                print(f"                - {b}")
        print(f"Anos:           {anos_raw} ({len(anos) or 'todos'} ano(s))")
        print(f"Anuladas:       {'incluidas' if incluir_anuladas else 'excluidas'}")
        print(f"Desatualizadas: {'incluidas' if incluir_desatualizadas else 'excluidas'}")
        print(f"Limit:          {limit}")
        print(f"Ordem:          {ordem_raw}")
        print(f"Total disponivel (com gabarito): {total_disponivel}")
        if preview:
            por_tipo: dict[str, int] = {}
            por_ano: dict[int, int] = {}
            n_anuladas = 0
            n_desatualizadas = 0
            for r in preview:
                por_tipo[r["tipo"] or "?"] = por_tipo.get(r["tipo"] or "?", 0) + r["n"]
                por_ano[r["ano"] or 0] = por_ano.get(r["ano"] or 0, 0) + r["n"]
                if r["anulada"]:
                    n_anuladas += r["n"]
                if r["desatualizada"]:
                    n_desatualizadas += r["n"]
            print(f"  por tipo: {por_tipo}")
            print(f"  por ano:  {dict(sorted(por_ano.items(), reverse=True))}")
            if incluir_anuladas and n_anuladas:
                print(f"  -> {n_anuladas} anulada(s) inclusas")
            if incluir_desatualizadas and n_desatualizadas:
                print(f"  -> {n_desatualizadas} desatualizada(s) inclusas")
        print("-" * 60)

        if total_disponivel == 0:
            print("nada a extrair com esses filtros.")
            return

        if not confirm("\nConfirmar extracao?"):
            print("cancelado.")
            return

        # 8) Extrai
        params["limit"] = limit
        cur.execute(
            QUERY_EXTRACT.format(
                materia_clause=materia_clause,
                banca_clause=banca_clause,
                anos_clause=anos_clause,
                anulada_clause=anulada_clause,
                desatualizada_clause=desatualizada_clause,
                order_by=ORDER_BY[ordem_raw],
            ),
            params,
        )
        rows = cur.fetchall()
        saida = [to_out(r) for r in rows]

        # 9) Salva (pede confirmacao se ja existe)
        if len(assuntos) == 1:
            slug = slugify(assuntos[0])
        else:
            slug = f"{slugify(materia)}__{slugify(termo_assunto)}"
        out_path = OUT_DIR / f"{slug}.json"
        if out_path.exists():
            if not confirm(f"\n{out_path.name} ja existe — sobrescrever?", default_yes=False):
                # adiciona timestamp
                ts = datetime.now().strftime("%Y%m%d-%H%M%S")
                out_path = OUT_DIR / f"{slug}_{ts}.json"

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(saida, f, ensure_ascii=False, indent=2)
        print(f"\n[ok] {len(saida)} questoes salvas em: {out_path}")


if __name__ == "__main__":
    main()
