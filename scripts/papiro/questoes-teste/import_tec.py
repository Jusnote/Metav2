"""
Import interativo de taxonomia TEC. Suporta arquivo unico OU lote (pasta).

Pre-requisito: tunnel SSH aberto em outra janela:
    ssh -L 5433:127.0.0.1:5433 root@95.217.197.95

Uso:
    python scripts/papiro/questoes-teste/import_tec.py

Modo unico: cole o caminho de UM .json
Modo lote:  cole o caminho de uma PASTA com varios .json

No lote, o escopo de cada arquivo vem do sufixo no nome:
    Direito_civil_federal.json    -> escopo=federal
    Direito_civil_estadual.json   -> escopo=estadual
    Direito_civil_municipal.json  -> escopo=municipal
    Direito_civil.json            -> escopo=federal (default)

Fluxo do lote:
  1. Detecta matéria/escopo/slug de cada arquivo
  2. Mostra tabela completa
  3. Uma confirmacao pra o lote inteiro
  4. Cada item: dry-run + import (pausa apenas se rename/move/delete)
  5. Relatorio agregado
"""

from __future__ import annotations

import json
import re
import shutil
import socket
import subprocess
import sys
import unicodedata
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:
    pass

VERUS_API_DIR = Path(r"D:/verus_api")
VERUS_API_ENV = VERUS_API_DIR / ".env"
TAXONOMIA_DIR = VERUS_API_DIR / "data" / "taxonomia"
RUN_IMPORT = VERUS_API_DIR / "scripts" / "run_import_via_tunnel.py"

ESCOPOS_VALIDOS = ("federal", "estadual", "municipal")

BANCAS_V2 = ["CEBRASPE (CESPE)", "VUNESP", "FCC", "FGV", "QUADRIX", "FUNDATEC"]


# ---------- Helpers basicos ----------

def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", strip_accents(s).lower())).strip("-")


def normalize(s: str) -> str:
    return strip_accents(s).lower()


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


def perguntar_escopo() -> str:
    while True:
        raw = ask("Escopo (federal / estadual / municipal)", "federal").lower()
        # aceita prefixo (fed, est, mun)
        for esc in ESCOPOS_VALIDOS:
            if esc.startswith(raw):
                return esc
        print(f"  escopo invalido: {raw!r}")


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


def limpar_caminho(raw: str) -> str:
    """Normaliza caminho colado: tira aspas, backslash -> slash."""
    s = raw.strip().strip('"').strip("'")
    return s.replace("\\", "/")


# ---------- Inferencia a partir do nome do arquivo ----------

def derivar_nome_candidato(filename: str) -> str:
    """De 'Direito_economico.json' deriva 'Direito economico'.
    Remove sufixo de escopo se houver."""
    stem = Path(filename).stem
    for cand in ESCOPOS_VALIDOS:
        m = re.search(rf"[_\-]{cand}$", stem, re.IGNORECASE)
        if m:
            stem = stem[: m.start()]
            break
    return re.sub(r"[_\-]+", " ", stem).strip()


def detectar_escopo_do_nome(filename: str) -> str:
    """Detecta sufixo _federal/_estadual/_municipal no nome. Default = federal."""
    stem = Path(filename).stem
    for cand in ESCOPOS_VALIDOS:
        if re.search(rf"[_\-]{cand}$", stem, re.IGNORECASE):
            return cand
    return "federal"


def parsear_diff_summary(stdout: str) -> dict:
    """Le saida do dry-run e extrai os contadores: adicionados, renomeados, movidos, deletados, inalterados."""
    out = {"adicionados": 0, "renomeados": 0, "movidos": 0, "deletados": 0, "inalterados": 0}
    for line in stdout.splitlines():
        m = re.search(r"\+\s*(\d+)\s+adicionados", line)
        if m: out["adicionados"] = int(m.group(1)); continue
        m = re.search(r"~\s*(\d+)\s+renomeados", line)
        if m: out["renomeados"] = int(m.group(1)); continue
        m = re.search(r"->\s*(\d+)\s+movidos", line)
        if m: out["movidos"] = int(m.group(1)); continue
        m = re.search(r"-\s*(\d+)\s+deletados", line)
        if m: out["deletados"] = int(m.group(1)); continue
        m = re.search(r"=\s*(\d+)\s+inalterados", line)
        if m: out["inalterados"] = int(m.group(1)); continue
    return out


# ---------- Resolucao de materia no DB ----------

def buscar_materia_no_db(cur, candidato: str) -> list[tuple[str, int]]:
    tokens = [t for t in re.split(r"\s+", candidato.strip()) if t]
    if not tokens:
        return []
    tokens_n = [normalize(t) for t in tokens]
    cur.execute(
        "SELECT materia, COUNT(*) AS n FROM questoes "
        "WHERE materia IS NOT NULL GROUP BY materia"
    )
    rows = cur.fetchall()
    hits: list[tuple[str, int]] = []
    for r in rows:
        m = r["materia"]
        nm = normalize(m)
        if all(re.search(r"\b" + re.escape(t), nm) for t in tokens_n):
            hits.append((m, r["n"]))
    hits.sort(key=lambda h: -h[1])
    return hits


# ---------- Validacao do JSON ----------

def carregar_e_validar_json(path: Path) -> tuple[int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    assuntos = data.get("assuntos")
    if not isinstance(assuntos, list):
        raise ValueError("JSON nao tem chave 'assuntos' como array")

    def walk(arr) -> tuple[int, int]:
        leaf = 0
        parent = 0
        for n in arr:
            sub = n.get("subTree") or n.get("subtree") or n.get("children") or []
            if sub:
                parent += 1
                lr, pr = walk(sub)
                leaf += lr
                parent += pr
            else:
                leaf += 1
        return leaf, parent

    leaf, parent = walk(assuntos)
    return leaf + parent, parent


# ---------- Fluxo ----------

def planejar_arquivo(path: Path, cur) -> dict | None:
    """Analisa um arquivo e prepara o plano de import. Retorna dict ou None se invalido."""
    try:
        total_nodes, n_pais = carregar_e_validar_json(path)
    except Exception as e:
        return {"path": path, "erro": f"JSON invalido: {e}"}

    escopo = detectar_escopo_do_nome(path.name)
    candidato = derivar_nome_candidato(path.name)
    hits = buscar_materia_no_db(cur, candidato)
    if not hits:
        return {"path": path, "erro": f"materia nao encontrada no DB ({candidato!r})"}

    materia, n_questoes = hits[0]
    slug = slugify(materia)
    cur.execute(
        "SELECT COUNT(*) AS n FROM taxonomia_nodes WHERE materia = %s AND is_sintetico = false",
        (materia,),
    )
    nodes_existentes = cur.fetchone()["n"]

    return {
        "path": path,
        "total_nodes": total_nodes,
        "n_pais": n_pais,
        "n_folhas": total_nodes - n_pais,
        "escopo": escopo,
        "candidato": candidato,
        "materia": materia,
        "n_questoes": n_questoes,
        "slug": slug,
        "nodes_existentes": nodes_existentes,
        "matches_multiplos": len(hits) > 1,
        "alternativas": hits[:5],
    }


def executar_item_lote(item: dict) -> dict:
    """Executa import de UM item do lote. Pausa apenas se rename/move/delete."""
    print(f"\n{'='*60}")
    print(f"  {item['materia']!r} ({item['escopo']})")
    print(f"{'='*60}")

    destino_dir = TAXONOMIA_DIR / item["slug"]
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / f"{item['escopo']}.json"
    shutil.copy2(item["path"], destino)
    print(f"  copiado: {destino.name}")

    # Dry-run com captura de saída
    print("  dry-run...")
    proc = subprocess.run(
        [
            sys.executable, str(RUN_IMPORT),
            "--materia", item["materia"],
            "--slug", item["slug"],
            "--dir", str(destino_dir.relative_to(VERUS_API_DIR)),
            "--dry-run",
        ],
        cwd=str(VERUS_API_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        print(f"  ERRO dry-run:\n{proc.stdout}\n{proc.stderr}")
        return {"item": item, "status": "erro_dryrun"}

    diff = parsear_diff_summary(proc.stdout)
    print(
        f"  diff: +{diff['adicionados']} novos, "
        f"~{diff['renomeados']} renomeados, "
        f"->{diff['movidos']} movidos, "
        f"-{diff['deletados']} deletados, "
        f"={diff['inalterados']} inalterados"
    )

    # Pausa se rename/move/delete
    perigoso = diff["renomeados"] > 0 or diff["movidos"] > 0 or diff["deletados"] > 0
    if perigoso:
        print("  ⚠ diff perigoso (rename/move/delete) — saida completa abaixo:")
        print(proc.stdout)
        if not confirm("Confirmar import real desse item?", default_yes=False):
            print("  pulado.")
            return {"item": item, "status": "pulado"}

    # Import real
    proc = subprocess.run(
        [
            sys.executable, str(RUN_IMPORT),
            "--materia", item["materia"],
            "--slug", item["slug"],
            "--dir", str(destino_dir.relative_to(VERUS_API_DIR)),
        ],
        cwd=str(VERUS_API_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        print(f"  ERRO import:\n{proc.stdout}\n{proc.stderr}")
        return {"item": item, "status": "erro_import"}

    # Contagem pos-import
    conn = psycopg2.connect(read_database_url(), connect_timeout=5)
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE taxonomia_node_id IS NOT NULL) AS resolvidas
            FROM questoes WHERE materia = %s
        """, (item["materia"],))
        r = cur.fetchone()
        cur.execute("""
            SELECT COUNT(*) AS n FROM questoes
            WHERE materia = %s
              AND banca = ANY(%s)
              AND ano BETWEEN 2019 AND 2025
              AND COALESCE(anulada,false) = false
              AND COALESCE(desatualizada,false) = false
              AND gabarito_correto IS NOT NULL
        """, (item["materia"], BANCAS_V2))
        universo_v2 = cur.fetchone()["n"]

    pct = (r["resolvidas"] / r["total"] * 100) if r["total"] else 0
    print(f"  [ok] {r['resolvidas']:,}/{r['total']:,} resolvidas ({pct:.1f}%) | universo V2: {universo_v2:,}")
    return {
        "item": item,
        "status": "ok",
        "resolvidas": r["resolvidas"],
        "total_questoes": r["total"],
        "universo_v2": universo_v2,
        "diff": diff,
    }


def processar_lote(pasta: Path) -> int:
    """Processa todos os .json da pasta em sequencia."""
    arquivos = sorted(pasta.glob("*.json"))
    if not arquivos:
        print(f"  nenhum .json em {pasta}")
        return 1

    print(f"\nDetectados {len(arquivos)} arquivo(s) em {pasta}\n")
    conn = psycopg2.connect(read_database_url(), connect_timeout=5)
    planos: list[dict] = []
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        for arq in arquivos:
            plano = planejar_arquivo(arq, cur)
            planos.append(plano)

    # Tabela
    print(f"{'#':>3}  {'arquivo':<45}  {'escopo':<10}  {'materia / status':<45}")
    print("-" * 110)
    for i, p in enumerate(planos, 1):
        if "erro" in p:
            print(f"{i:>3}  {p['path'].name:<45}  {'-':<10}  ❌ {p['erro']}")
            continue
        warn = ""
        if p["matches_multiplos"]:
            warn = " ⚠(mult.match — usa 1º)"
        if p["nodes_existentes"]:
            warn += f" ⚠({p['nodes_existentes']} nodes ja existem)"
        print(f"{i:>3}  {p['path'].name:<45}  {p['escopo']:<10}  {p['materia']}  ({p['total_nodes']}n){warn}")

    validos = [p for p in planos if "erro" not in p]
    invalidos = [p for p in planos if "erro" in p]
    if not validos:
        print("\nnenhum arquivo valido pra processar.")
        return 1

    print(f"\nResumo: {len(validos)} validos, {len(invalidos)} com erro")
    if any(p["matches_multiplos"] for p in validos):
        print("  ⚠ Alguns arquivos tem multiplos matches de materia (pega o 1º — mais frequente).")
        print("    Se quiser controle individual, processe esses arquivos um por um.")

    if not confirm("\nConfirmar TODO o lote?", default_yes=True):
        print("cancelado.")
        return 0

    # Executar
    resultados = []
    for p in validos:
        try:
            res = executar_item_lote(p)
        except Exception as e:
            print(f"  ERRO inesperado: {e}")
            res = {"item": p, "status": "erro_excecao"}
        resultados.append(res)

    # Relatorio agregado
    print(f"\n{'='*60}")
    print(f"RELATORIO DO LOTE")
    print(f"{'='*60}")
    ok = [r for r in resultados if r["status"] == "ok"]
    falhou = [r for r in resultados if r["status"] != "ok"]
    print(f"  Processados com sucesso: {len(ok)} / {len(resultados)}")
    if falhou:
        print(f"  Falhas/pulados:")
        for r in falhou:
            print(f"    {r['item']['materia']!r} ({r['item']['escopo']}) -> {r['status']}")
    if ok:
        print(f"\n  Detalhes (sucesso):")
        print(f"    {'materia':<40}  {'%resolv':>8}  {'V2':>6}")
        for r in ok:
            pct = (r['resolvidas'] / r['total_questoes'] * 100) if r['total_questoes'] else 0
            print(f"    {r['item']['materia']:<40}  {pct:>6.1f}%  {r['universo_v2']:>6,}")
    return 0


def main() -> int:
    print("=" * 60)
    print("Import interativo de taxonomia TEC")
    print("=" * 60)

    if not tunnel_aberto():
        print("\nERRO: tunnel SSH fechado.")
        print("  abra em outra janela: ssh -L 5433:127.0.0.1:5433 root@95.217.197.95")
        return 1

    while True:
        raw = input("\nCaminho do JSON (arquivo unico) ou de uma PASTA (lote); vazio = sair: ").strip()
        if not raw:
            print("saindo.")
            return 0
        path = Path(limpar_caminho(raw))
        if not path.exists():
            print(f"  nao encontrado: {path}")
            continue
        if path.is_dir():
            processar_lote(path)
        else:
            # modo unico (fluxo antigo)
            importar_uma_de_path(path)
        if not confirm("\nProcessar outro arquivo/pasta?", default_yes=False):
            print("saindo.")
            return 0


def importar_uma_de_path(path: Path) -> None:
    """Versao do importar_uma() que recebe o path direto (sem re-perguntar)."""
    try:
        total_nodes, n_pais = carregar_e_validar_json(path)
    except Exception as e:
        print(f"  JSON invalido: {e}")
        return
    n_folhas = total_nodes - n_pais
    print(f"  JSON OK: {total_nodes} nodes ({n_pais} pais + {n_folhas} folhas)")

    escopo_auto = detectar_escopo_do_nome(path.name)
    escopo = perguntar_escopo() if escopo_auto == "federal" else escopo_auto
    # Se sufixo definiu escopo != federal, usa direto
    if escopo_auto != "federal":
        print(f"  escopo (detectado do nome): {escopo}")

    candidato = derivar_nome_candidato(path.name)
    print(f"\n  candidato (do nome do arquivo): {candidato!r}")

    conn = psycopg2.connect(read_database_url(), connect_timeout=5)
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        hits = buscar_materia_no_db(cur, candidato)
        if not hits:
            print(f"  nenhuma materia no DB casa com {candidato!r}")
            materia_manual = ask("digite o nome exato da materia (vazio = cancela)")
            if not materia_manual:
                return
            cur.execute("SELECT COUNT(*) AS n FROM questoes WHERE materia = %s", (materia_manual,))
            n = cur.fetchone()["n"]
            if n == 0:
                print(f"  materia {materia_manual!r} nao existe em questoes")
                return
            materia, n_questoes = materia_manual, n
            print(f"  usando: {materia!r}  ({n_questoes:,} questoes)")
        elif len(hits) == 1:
            materia, n_questoes = hits[0]
            print(f"  match unico: {materia!r}  ({n_questoes:,} questoes)")
            if not confirm("Confirmar essa materia?"):
                return
        else:
            print(f"  {len(hits)} match(es):")
            for i, (m, n) in enumerate(hits[:10], 1):
                print(f"    {i:>2}) {m}  ({n:,} questoes)")
            escolha = ask("escolha o numero", "1")
            try:
                idx = int(escolha) - 1
                materia, n_questoes = hits[idx]
            except (ValueError, IndexError):
                print("  escolha invalida")
                return
            print(f"  selecionada: {materia!r}  ({n_questoes:,} questoes)")

        slug_default = slugify(materia)
        slug = ask(f"\nSlug", slug_default) or slug_default
        print(f"  slug: {slug}")

        cur.execute(
            "SELECT COUNT(*) AS n FROM taxonomia_nodes WHERE materia = %s AND is_sintetico = false",
            (materia,),
        )
        nodes_existentes = cur.fetchone()["n"]
        if nodes_existentes:
            print(f"  ATENCAO: ja existem {nodes_existentes} nodes pra essa materia no DB")

    destino_dir = TAXONOMIA_DIR / slug
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / f"{escopo}.json"
    if destino.exists():
        if not confirm(f"\nJa existe {destino.name}. Sobrescrever?", default_yes=False):
            print("cancelado.")
            return
    shutil.copy2(path, destino)
    print(f"  copiado: {destino}")

    print("\n=== DRY-RUN ===")
    rc = subprocess.run(
        [sys.executable, str(RUN_IMPORT), "--materia", materia, "--slug", slug,
         "--dir", str(destino_dir.relative_to(VERUS_API_DIR)), "--dry-run"],
        cwd=str(VERUS_API_DIR),
    ).returncode
    if rc != 0:
        print("  erro no dry-run.")
        return

    if not confirm("\nConfirmar import real?"):
        print("cancelado.")
        return

    print("\n=== IMPORT REAL ===")
    rc = subprocess.run(
        [sys.executable, str(RUN_IMPORT), "--materia", materia, "--slug", slug,
         "--dir", str(destino_dir.relative_to(VERUS_API_DIR))],
        cwd=str(VERUS_API_DIR),
    ).returncode
    if rc != 0:
        print("  erro no import real.")
        return

    print("\n=== RELATORIO ===")
    conn = psycopg2.connect(read_database_url(), connect_timeout=5)
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            WITH com_filhos AS (SELECT DISTINCT parent_id FROM taxonomia_nodes WHERE parent_id IS NOT NULL)
            SELECT
              COUNT(*) FILTER (WHERE id IN (SELECT parent_id FROM com_filhos)) AS pais,
              COUNT(*) FILTER (WHERE id NOT IN (SELECT parent_id FROM com_filhos)) AS folhas
            FROM taxonomia_nodes WHERE materia = %s AND is_sintetico = false
        """, (materia,))
        r = cur.fetchone()
        print(f"  Nodes:    {r['pais'] + r['folhas']} total ({r['pais']} pais + {r['folhas']} folhas)")
        cur.execute("""
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE taxonomia_node_id IS NOT NULL) AS resolvidas,
              COUNT(*) FILTER (WHERE assunto IS NULL) AS sem_assunto
            FROM questoes WHERE materia = %s
        """, (materia,))
        r = cur.fetchone()
        t = r["total"]
        pct = (r["resolvidas"] / t * 100) if t else 0
        print(f"  Questoes: {t:,} total")
        print(f"    resolvidas: {r['resolvidas']:,} ({pct:.2f}%)")
        if r["sem_assunto"]:
            print(f"    sem assunto: {r['sem_assunto']:,}  (irrecuperavel)")
        cur.execute("""
            SELECT COUNT(*) AS n FROM questoes
            WHERE materia = %s AND banca = ANY(%s) AND ano BETWEEN 2019 AND 2025
              AND COALESCE(anulada,false) = false AND COALESCE(desatualizada,false) = false
              AND gabarito_correto IS NOT NULL
        """, (materia, BANCAS_V2))
        print(f"  Universo V2: {cur.fetchone()['n']:,} questoes")
    print("\n[ok] import concluido.")


if __name__ == "__main__":
    sys.exit(main())
