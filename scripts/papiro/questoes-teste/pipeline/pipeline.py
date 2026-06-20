"""PAPIRO — pipeline headless (Max agora, API/Batch depois).

Processa folhas da taxonomia (`lote-*.json` gerados por extract_v2) através da
cascata MAP → audit → consolidador → audit → Rani, com checkpoint por estágio.
Idempotente: reprocessar pula o que já foi feito.

Uso:
  python pipeline.py process <pasta-da-folha>            # uma folha
  python pipeline.py materia <pasta-da-materia>          # todas as folhas da matéria, menores primeiro
  python pipeline.py status <pasta-da-folha-ou-materia>  # mostra progresso

Backend: hoje 'claude -p' (Max sub via Claude Code CLI). Trocar pra Batch API
no futuro = substituir Dispatcher.run().
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shlex
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:
    pass

ROOT = Path(__file__).parent
PROMPT_ANALISTA = ROOT / "analista_map.md"
PROMPT_CONSOLIDADOR = ROOT / "consolidador_inventario.md"
PROMPT_RANI = ROOT / "redator_rani.md"

OUT = "_pilot2"  # subpasta de saída em cada folha
INVENTARIO_ROOT = Path(r"D:\inventario-v2")  # onde extract_v2.py grava as folhas
# Cap de lotes por folha: processa só os N primeiros. Os lotes são embaralhados com seed
# determinística no extract, então os 6 primeiros = amostra aleatória estável. Medido na
# fonética: 6 lotes (~300 q) = 99,8% da incidência. PAPIRO_CAP_LOTES=0 desliga (exaustivo).
CAP_LOTES = int(os.environ.get("PAPIRO_CAP_LOTES", "6"))


# ---------- Backend trocável ----------------------------------------------

class ClaudeCliDispatcher:
    """Hoje: spawn `claude -p` para cada subagente, usa a sua sub Max via auth do CLI.
    Amanhã (Batch API): substituir esta classe por BatchApiDispatcher, mesmos prompts."""

    def __init__(self, model: str = "opus", timeout: int = 1800, max_concurrent: int = 4):
        self.model = model
        self.timeout = timeout
        self.max_concurrent = max_concurrent
        self._sem = None
        # Windows: PATHEXT acha `claude.exe` (shim npm) antes de `claude.cmd`, mas o
        # `.exe` pode dar "não é compatível com a versão do Windows" em algumas
        # instalações. Forçamos o `.cmd` (wrapper batch que delega pro node), que é
        # o que o terminal interativo do usuário usa.
        if sys.platform == "win32":
            self.exe = shutil.which("claude.cmd") or shutil.which("claude")
        else:
            self.exe = shutil.which("claude")
        if self.exe is None:
            raise RuntimeError("CLI `claude` nao encontrado no PATH. Instale o Claude Code.")
        # C: cronicamente lotado faz o launch do claude.exe falhar intermitentemente
        # ("nao reconhecido como um comando"). Apontamos o temp dos subprocessos pro D:
        # (muito espaco livre) e tentamos de novo em falha transitoria de launch.
        self._retries = 4
        self.stats: list[dict] = []  # telemetria por chamada: {stage, in, out, cost}
        self._tmp = r"D:\papiro-tmp"
        try:
            Path(self._tmp).mkdir(parents=True, exist_ok=True)
        except OSError:
            self._tmp = os.environ.get("TEMP") or os.environ.get("TMP") or "."

    async def run(self, prompt: str, stage: str = "?") -> str:
        # Prompt vai por STDIN (passar como argumento faz o cmd.exe picotar os \n).
        # --dangerously-skip-permissions: headless precisa, senao o tool Write e
        # negado e o agente "roda" (rc=0) mas nao grava nada.
        # Semaphore limita concorrencia (evita throttle da Max com N lotes paralelos).
        if self._sem is None:
            self._sem = asyncio.Semaphore(self.max_concurrent)
        args = [self.exe, "-p", "--model", self.model, "--output-format", "json",
                "--dangerously-skip-permissions"]
        # Subprocess herda este env: temp no D: (C: lotado quebra o launch do claude.exe).
        env = {**os.environ, "TEMP": self._tmp, "TMP": self._tmp}
        last_err = ""
        for attempt in range(1, self._retries + 1):
            async with self._sem:
                if sys.platform == "win32":
                    cmd_str = subprocess.list2cmdline(args)
                    proc = await asyncio.create_subprocess_shell(
                        cmd_str, stdin=asyncio.subprocess.PIPE,
                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                        env=env,
                    )
                else:
                    proc = await asyncio.create_subprocess_exec(
                        *args, stdin=asyncio.subprocess.PIPE,
                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                        env=env,
                    )
                try:
                    stdout, stderr = await asyncio.wait_for(
                        proc.communicate(input=prompt.encode("utf-8")), timeout=self.timeout)
                except asyncio.TimeoutError:
                    proc.kill()
                    raise RuntimeError(f"timeout {self.timeout}s no `claude -p`")
            if proc.returncode == 0:
                return self._parse(stdout, stage)
            last_err = stderr.decode("utf-8", "replace")[:500]
            if attempt < self._retries:
                # backoff longo (30/60/120s) — aguenta rate-limit transitorio (tokens/min)
                # que antes (3s/6s) derrubava o passo na cara; agora ele se cura sozinho.
                await asyncio.sleep(min(30 * 2 ** (attempt - 1), 120))
        raise RuntimeError(
            f"claude -p falhou (rc={proc.returncode}) apos {self._retries} tentativas: {last_err}")

    def _parse(self, stdout: bytes, stage: str) -> str:
        """--output-format json: extrai o texto do agente e registra tokens/custo."""
        raw = stdout.decode("utf-8", "replace")
        try:
            data = json.loads(raw)
        except Exception:
            return raw  # formato inesperado — devolve cru, sem telemetria
        u = data.get("usage", {}) or {}
        self.stats.append({
            "stage": stage,
            "in": (u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0)
                   + u.get("cache_creation_input_tokens", 0)),
            "out": u.get("output_tokens", 0),
            "cost": float(data.get("total_cost_usd", 0.0) or 0.0),
        })
        return data.get("result", "") or ""


# ---------- Helpers --------------------------------------------------------

def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def lote_files(folha: Path) -> list[Path]:
    # Cap aplicado AQUI => vale pra MAP, auditoria, consolidação e id_meta de forma
    # consistente (o "universo" da folha vira os N primeiros lotes, sem furar a auditoria).
    files = sorted(folha.glob("lote-*.json"))
    return files[:CAP_LOTES] if CAP_LOTES else files


def ids_da_fonte(folha: Path) -> set[int]:
    s: set[int] = set()
    for f in lote_files(folha):
        s |= {q["id"] for q in json.loads(f.read_text(encoding="utf-8"))}
    return s


def is_inventory_valid(p: Path) -> bool:
    if not p.exists():
        return False
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        return isinstance(d.get("ids_analisados"), list) and isinstance(d.get("pontos"), list)
    except Exception:
        return False


def stage_done(folha: Path, name: str) -> bool:
    return (folha / OUT / f".{name}.done").exists()


def mark_done(folha: Path, name: str) -> None:
    (folha / OUT).mkdir(exist_ok=True)
    (folha / OUT / f".{name}.done").write_text(datetime.now().isoformat(), encoding="utf-8")


def count_questoes(folha: Path) -> int:
    return sum(len(json.loads(l.read_text(encoding="utf-8"))) for l in folha.glob("lote-*.json"))


def scan_materias(root: Path) -> list[tuple[Path, list[Path], int]]:
    """Lista (materia_dir, folhas, total_questoes) para cada matéria sob `root`
    que tenha pelo menos uma folha com lote-*.json."""
    if not root.exists():
        return []
    out: list[tuple[Path, list[Path], int]] = []
    for materia in sorted(root.iterdir()):
        if not materia.is_dir():
            continue
        folhas = folhas_da_materia(materia)
        if not folhas:
            continue
        total = sum(count_questoes(f) for f in folhas)
        out.append((materia, folhas, total))
    return out


def estimate_cost(total_questoes: int) -> dict:
    """Estimativa por questão (telemetria, não cravado): ~$0.02 API normal, ~$0.01 Batch."""
    return {
        "tokens_M": total_questoes * 4300 / 1e6,
        "standard_usd": total_questoes * 0.02,
        "batch_usd": total_questoes * 0.01,
    }


def confirm_yn(prompt: str, default_yes: bool = True) -> bool:
    suffix = " [S/n]" if default_yes else " [s/N]"
    try:
        raw = input(f"{prompt}{suffix}: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    if not raw:
        return default_yes
    return raw in {"s", "sim", "y", "yes"}


# ---------- Auditoria (código, nunca LLM) ---------------------------------

def audit_map(folha: Path, lote_inv_paths: list[Path]) -> tuple[set[int], dict]:
    """Retorna (ids_faltando_ou_sem_ponto, detalhes). Conjunto vazio = OK."""
    src = ids_da_fonte(folha)
    analisados, referenciados = set(), set()
    for p in lote_inv_paths:
        if not p.exists():
            continue
        inv = json.loads(p.read_text(encoding="utf-8"))
        analisados |= set(inv.get("ids_analisados", []))
        for pt in inv.get("pontos", []):
            referenciados |= set(pt.get("ids", []))
            for pg in pt.get("pegadinhas", []):
                referenciados |= set(pg.get("ids", []))
            for ex in pt.get("exemplos", []):
                referenciados |= set(ex.get("ids", []))
        for c in inv.get("conexoes", []):
            referenciados |= set(c.get("ids", []))
    perdidos = src - analisados
    sem_ponto = src - referenciados
    return (perdidos | sem_ponto), {
        "fonte": len(src), "analisados": len(analisados),
        "perdidos": sorted(perdidos), "sem_ponto": sorted(sem_ponto),
    }


def audit_indice_final(folha: Path) -> tuple[bool, dict]:
    src = ids_da_fonte(folha)
    idx_path = folha / OUT / "INVENTARIO-indice.json"
    if not idx_path.exists():
        return False, {"erro": "indice ausente"}
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    cob = {int(k) for k in idx.get("indice_questao_ponto", {}).keys()}
    mismatch = [(p["ponto"], p.get("frequencia"), len(set(p.get("ids", []))))
                for p in idx.get("ranking", [])
                if p.get("frequencia") != len(set(p.get("ids", [])))]
    ok = not (src - cob) and not (cob - src) and not mismatch
    return ok, {"fonte": len(src), "cobertos": len(cob), "faltando": sorted(src - cob),
                "fantasma": sorted(cob - src), "freq_mismatch": mismatch[:5]}


# ---------- Builders de prompt de subagente -------------------------------

def prompt_analista(folha: Path, lote_path: Path, lote_id: str, out_path: Path) -> str:
    return (
        f"Você é o Analista Cirúrgico de Questões do PAPIRO (MAP v2). Régua máxima de minuciosidade.\n\n"
        f"PASSO 1 — Read seu prompt operacional: {PROMPT_ANALISTA}\n"
        f"PASSO 2 — Read o lote: {lote_path}\n"
        f"PASSO 3 — Analise TODAS as questões. Cada distrator vira pegadinha com tipo_armadilha e ID. "
        f"Todo ID recebido tem que aparecer em pelo menos um ponto. Checagem cruzada do gabarito (base-0).\n"
        f'PASSO 4 — Monte o JSON exatamente no schema. Campo "lote" = "{lote_id}".\n'
        f"PASSO 5 — Write SOMENTE o JSON (sem ``` nem texto fora) em: {out_path}\n\n"
        f"Retorne resumo curto: questões analisadas, pontos, pegadinhas, conexões."
    )


def prompt_gap(folha: Path, gap_json: Path, out_path: Path) -> str:
    return (
        f"Você é o Analista Cirúrgico do PAPIRO (MAP v2). Estas questões foram dropadas/sub-analisadas. "
        f"Cobertura cirúrgica EXAUSTIVA — cada uma DEVE gerar ≥1 ponto.\n\n"
        f"PASSO 1 — Read: {PROMPT_ANALISTA}\n"
        f"PASSO 2 — Read as questões do gap: {gap_json}\n"
        f"PASSO 3 — Analise com profundidade total; cada ID em ids_analisados E em ≥1 ponto.\n"
        f'PASSO 4 — JSON no schema, campo "lote" = "gap".\n'
        f"PASSO 5 — Write SOMENTE o JSON em: {out_path}\n\n"
        f"Retorne: confirme que todos os IDs viraram ponto."
    )


def prompt_consolidador(folha: Path, lote_invs: list[Path], id_meta: Path,
                       out_md: Path, out_idx: Path) -> str:
    invs = "\n".join(f"- {p}" for p in lote_invs)
    return (
        f"Você é o Consolidador de Inventário (REDUCE etapa 1). Funda os inventários estruturados.\n\n"
        f"PASSO 1 — Read seu prompt: {PROMPT_CONSOLIDADOR}\n"
        f"PASSO 2 — Read os substratos:\n{invs}\n"
        f"PASSO 3 — Read o mapa ID→ano/banca: {id_meta}\n"
        f"PASSO 4 — Funda: una pontos iguais (na dúvida NÃO funda), frequência=IDs únicos, "
        f"tendência por anos, ranking 🔥/⭐/▫️/·, preserve TODAS as pegadinhas dos distratores, "
        f"mapa de pegadinhas por tipo_armadilha. Cobertura exaustiva inviolável.\n"
        f"PASSO 5 — Write o INVENTÁRIO markdown em: {out_md}\n"
        f"PASSO 6 — Write o ÍNDICE JSON (indice_questao_ponto cobrindo TODOS os IDs) em: {out_idx}\n\n"
        f"Retorne resumo: pontos no ranking, top-5, confirme cobertura."
    )


def prompt_rani(folha: Path, inventario_md: Path, out_md: Path) -> str:
    return (
        f"Você é o Redator-Rani (REDUCE etapa 2). Transforme o inventário cirúrgico no RESUMO do aluno, voz mentor.\n\n"
        f"PASSO 1 — Read seu prompt: {PROMPT_RANI}\n"
        f"PASSO 2 — Read o inventário consolidado: {inventario_md}\n"
        f"PASSO 3 — Escreva o RESUMO completo na voz Rani. COBERTURA INVIOLÁVEL: todo ponto do ranking "
        f'do inventário aparece (campeões com destaque, raros na rede de segurança). Itens "a conferir" '
        f'viram "⚠️ confira na fonte", nunca certeza. Mantenha o rastreio por ID nas pegadinhas.\n'
        f"PASSO 4 — Write o resumo (só Markdown) em: {out_md}\n\n"
        f"Retorne: confirme que todos os pontos do ranking foram cobertos."
    )


# ---------- Geração do id_meta (código, sem LLM) --------------------------

def build_id_meta(folha: Path) -> Path:
    meta = {}
    for f in lote_files(folha):
        for q in json.loads(f.read_text(encoding="utf-8")):
            meta[q["id"]] = {"ano": q.get("concursoAno"), "banca": q.get("bancaSigla"),
                             "tipo": q.get("tipoQuestao")}
    out = folha / OUT / "id_meta.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return out


# ---------- Estágios -------------------------------------------------------

async def stage_map(folha: Path, disp: ClaudeCliDispatcher) -> None:
    if stage_done(folha, "map"):
        log(f"  [skip] map ja feito")
        return
    lotes = lote_files(folha)
    pilot = folha / OUT
    pilot.mkdir(exist_ok=True)
    pendentes = []
    for lote in lotes:
        inv = pilot / f"{lote.stem}.inventory.json"
        if is_inventory_valid(inv):
            continue
        pendentes.append((lote, inv))
    log(f"  map: {len(pendentes)}/{len(lotes)} lotes pendentes (paralelo)")

    async def one(lote: Path, inv: Path) -> None:
        await disp.run(prompt_analista(folha, lote, lote.stem, inv), stage="map")
        if not is_inventory_valid(inv):
            raise RuntimeError(f"analista nao gerou JSON valido em {inv}")
        log(f"    ✓ {lote.name}")

    if pendentes:
        await asyncio.gather(*(one(l, i) for l, i in pendentes))
    mark_done(folha, "map")


async def stage_audit_and_gap(folha: Path, disp: ClaudeCliDispatcher) -> None:
    if stage_done(folha, "audit_map"):
        log(f"  [skip] audit_map ja feito")
        return
    pilot = folha / OUT
    invs = [pilot / f"{l.stem}.inventory.json" for l in lote_files(folha)]
    # incluir possivel gap previo
    gap_inv = pilot / "gap.inventory.json"
    todos = invs + ([gap_inv] if gap_inv.exists() else [])
    pendentes, detalhes = audit_map(folha, todos)
    if pendentes:
        log(f"  audit: {len(pendentes)} IDs faltando/sem ponto → gap-fill")
        # extrai as questoes faltantes
        gap_src: list[dict] = []
        for f in lote_files(folha):
            for q in json.loads(f.read_text(encoding="utf-8")):
                if q["id"] in pendentes:
                    gap_src.append(q)
        gap_json = pilot / "gap.json"
        gap_json.write_text(json.dumps(gap_src, ensure_ascii=False, indent=2), encoding="utf-8")
        await disp.run(prompt_gap(folha, gap_json, gap_inv), stage="gap")
        # re-audita
        invs2 = invs + [gap_inv]
        pendentes2, det2 = audit_map(folha, invs2)
        if pendentes2:
            raise RuntimeError(f"audit ainda falha pos-gap: {sorted(pendentes2)[:10]}")
    log(f"  audit_map: 100% ({detalhes['fonte']}/{detalhes['fonte']})")
    mark_done(folha, "audit_map")


async def stage_consolidate(folha: Path, disp: ClaudeCliDispatcher) -> None:
    if stage_done(folha, "consolidate"):
        log(f"  [skip] consolidate ja feito")
        return
    pilot = folha / OUT
    id_meta = build_id_meta(folha)
    invs = [pilot / f"{l.stem}.inventory.json" for l in lote_files(folha)]
    gap_inv = pilot / "gap.inventory.json"
    if gap_inv.exists():
        invs.append(gap_inv)
    out_md = pilot / "INVENTARIO.md"
    out_idx = pilot / "INVENTARIO-indice.json"
    log(f"  consolidate: {len(invs)} substratos → INVENTARIO")
    await disp.run(prompt_consolidador(folha, invs, id_meta, out_md, out_idx), stage="consolidate")
    # Frequência é número DERIVADO: o código recalcula (= IDs únicos/ponto). O LLM erra a
    # contagem por ±1 às vezes, e antes isso matava o estágio. Agora o código sobrescreve
    # (princípio "LLM nunca afirma número") e a auditoria checa o que importa: a COBERTURA.
    if out_idx.exists():
        idx = json.loads(out_idx.read_text(encoding="utf-8"))
        for p in idx.get("ranking", []):
            p["frequencia"] = len(set(p.get("ids", [])))
        out_idx.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    ok, det = audit_indice_final(folha)
    if not ok:
        raise RuntimeError(f"audit indice falhou: {det}")
    log(f"  ✓ indice cobre {det['cobertos']}/{det['fonte']}, freq batem")
    mark_done(folha, "consolidate")


async def stage_rani(folha: Path, disp: ClaudeCliDispatcher) -> None:
    if stage_done(folha, "rani"):
        log(f"  [skip] rani ja feito")
        return
    pilot = folha / OUT
    out_md = pilot / "RESUMO-RANI.md"
    log(f"  rani: escrevendo resumo aluno")
    await disp.run(prompt_rani(folha, pilot / "INVENTARIO.md", out_md), stage="rani")
    if not out_md.exists():
        raise RuntimeError("rani nao escreveu o resumo")
    mark_done(folha, "rani")
    mark_done(folha, "all")


# ---------- Orquestração ---------------------------------------------------

def report_custo(disp: ClaudeCliDispatcher, since: int = 0) -> None:
    """Loga tokens e US$ (proxy de cota) por estágio das chamadas desde `since`."""
    rows = disp.stats[since:]
    if not rows:
        return
    agg: dict[str, dict] = {}
    for r in rows:
        a = agg.setdefault(r["stage"], {"n": 0, "in": 0, "out": 0, "cost": 0.0})
        a["n"] += 1; a["in"] += r["in"]; a["out"] += r["out"]; a["cost"] += r["cost"]
    log("  ── custo por estágio (tokens / US$ proxy) ──")
    ti = to = 0; tc = 0.0
    for stage in ("map", "gap", "consolidate", "rani"):
        if stage in agg:
            a = agg[stage]
            log(f"    {stage:<12} {a['n']:>2} call(s) | in {a['in']:>10,} | out {a['out']:>8,} | ${a['cost']:.3f}")
            ti += a["in"]; to += a["out"]; tc += a["cost"]
    log(f"    {'TOTAL':<12}          | in {ti:>10,} | out {to:>8,} | ${tc:.3f}")


async def process_folha(folha: Path, disp: ClaudeCliDispatcher) -> None:
    if not lote_files(folha):
        log(f"  [skip] sem lote-*.json em {folha}")
        return
    log(f"=== {folha.name} ===")
    t0 = time.time()
    n0 = len(disp.stats)
    await stage_map(folha, disp)
    await stage_audit_and_gap(folha, disp)
    await stage_consolidate(folha, disp)
    await stage_rani(folha, disp)
    log(f"  ✓ folha completa em {time.time()-t0:.0f}s")
    report_custo(disp, n0)


def folhas_da_materia(materia_dir: Path) -> list[Path]:
    """Encontra todas as folhas (subpastas com lote-*.json), retorna ordenadas
    por nº de questões (menores primeiro — smoke test barato)."""
    folhas = [p for p in materia_dir.rglob("*") if p.is_dir() and list(p.glob("lote-*.json"))]
    return sorted(folhas, key=count_questoes)


async def cmd_interactive(disp: ClaudeCliDispatcher) -> None:
    print("=" * 64)
    print(" PAPIRO Pipeline — modo interativo")
    print("=" * 64)

    if not INVENTARIO_ROOT.exists():
        print(f"\nERRO: pasta {INVENTARIO_ROOT} não existe.")
        print("Rode antes (extrair questões do banco):")
        print("  python scripts/papiro/questoes-teste/extract_v2.py")
        return

    materias = scan_materias(INVENTARIO_ROOT)
    if not materias:
        print(f"\nNenhuma matéria encontrada em {INVENTARIO_ROOT}.")
        print("Rode antes:  python scripts/papiro/questoes-teste/extract_v2.py")
        return

    print(f"\nMatérias disponíveis em {INVENTARIO_ROOT}:\n")
    for i, (m, folhas, total) in enumerate(materias, 1):
        print(f"  {i:>2}) {m.name}  ({len(folhas)} folhas, {total:,} questões)")

    while True:
        try:
            raw = input("\nEscolha o número (vazio = sair): ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nsaindo.")
            return
        if not raw:
            print("saindo.")
            return
        try:
            idx = int(raw) - 1
            if 0 <= idx < len(materias):
                break
        except ValueError:
            pass
        print("opção inválida, tente de novo.")

    materia_dir, folhas_all, total_materia = materias[idx]

    # ───── Sub-picker: folha específica OU matéria toda ─────
    print(f"\nFolhas em {materia_dir.name} (menores → maiores):\n")
    for i, f in enumerate(folhas_all, 1):
        n = count_questoes(f)
        rel = f.relative_to(materia_dir)
        print(f"  {i:>3}) {rel}  ({n:,} q)")
    print(f"\n  all) processar TODAS as {len(folhas_all)} folhas ({total_materia:,} q)")

    while True:
        try:
            raw = input("\nEscolha o número da folha ou 'all'/'todos' (vazio = sair): ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nsaindo.")
            return
        if not raw:
            print("saindo.")
            return
        if raw.strip().lower() in {"all", "todos", "*"}:
            folhas = folhas_all
            total = total_materia
            break
        try:
            fidx = int(raw) - 1
            if 0 <= fidx < len(folhas_all):
                folhas = [folhas_all[fidx]]
                total = count_questoes(folhas[0])
                break
        except ValueError:
            pass
        print("  opção inválida, tente de novo.")

    est = estimate_cost(total)
    print(f"\n=== Plano: {materia_dir.name} ===")
    if len(folhas) == 1:
        print(f"  Folha única:   {folhas[0].relative_to(materia_dir)}")
    else:
        print(f"  Folhas:        {len(folhas)} (processadas das menores pras maiores)")
    print(f"  Questões:      {total:,}")
    print(f"  Tokens est.:   ~{est['tokens_M']:.1f} M (cascata completa)")
    print(f"  Custo estimado (telemetria, não cravado):")
    print(f"    Max (sua sub):  $0 extra — tempo varia com o tier")
    print(f"    API Batch:      ~${est['batch_usd']:,.0f}")
    print(f"    API normal:     ~${est['standard_usd']:,.0f}")
    print(f"  Saída:         em <pasta-da-folha>/{OUT}/ (INVENTARIO.md + RESUMO-RANI.md)")
    print(f"  Checkpoint:    ativado — Ctrl+C interrompe sem perder o que já terminou")

    if not confirm_yn("\nProcessar?"):
        print("cancelado.")
        return

    print()
    erros = 0
    for i, f in enumerate(folhas, 1):
        log(f"\n[{i}/{len(folhas)}] {f.relative_to(materia_dir)}")
        try:
            await process_folha(f, disp)
        except KeyboardInterrupt:
            log("interrompido pelo usuário. checkpoint preserva o progresso.")
            return
        except Exception as e:
            erros += 1
            log(f"  ✗ ERRO: {e}\n  continuando para a próxima folha…")

    log(f"\n✓ {'folha' if len(folhas) == 1 else 'matéria'} concluída "
        f"({len(folhas) - erros}/{len(folhas)} OK"
        f"{', ' + str(erros) + ' com erro' if erros else ''}).")


async def main_async(args: argparse.Namespace) -> int:
    disp = ClaudeCliDispatcher(model="claude-opus-4-8")
    if args.cmd == "interactive":
        await cmd_interactive(disp)
    elif args.cmd == "process":
        await process_folha(Path(args.folha), disp)
    elif args.cmd == "materia":
        folhas = folhas_da_materia(Path(args.materia))
        log(f"matéria: {len(folhas)} folhas (menores primeiro)")
        for i, f in enumerate(folhas, 1):
            log(f"\n[{i}/{len(folhas)}]")
            try:
                await process_folha(f, disp)
            except Exception as e:
                log(f"  ✗ ERRO: {e}\n  continuando para a próxima folha...")
    elif args.cmd == "status":
        path = Path(args.path)
        targets = [path] if list(path.glob("lote-*.json")) else folhas_da_materia(path)
        for f in targets:
            stages = ["map", "audit_map", "consolidate", "rani"]
            done = [s for s in stages if stage_done(f, s)]
            print(f"  {f.name}: {len(done)}/{len(stages)} | {','.join(done) or '—'}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description="PAPIRO pipeline — sem argumentos abre o modo interativo (escolher matéria); "
                    "com subcomando roda headless (automação/lançamento em escala).",
    )
    sub = ap.add_subparsers(dest="cmd")  # sem required=True → default = interativo
    p1 = sub.add_parser("process", help="processa uma folha")
    p1.add_argument("folha")
    p2 = sub.add_parser("materia", help="processa todas as folhas de uma matéria, menores primeiro")
    p2.add_argument("materia")
    p3 = sub.add_parser("status", help="mostra progresso de uma folha ou matéria")
    p3.add_argument("path")
    args = ap.parse_args()
    if args.cmd is None:
        args.cmd = "interactive"
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
