"""Iteracao 1 do pipeline ECONOMICO: consolida + Rani usando SO os lotes 1-3 (deep),
em _pilot2_econ/, sem tocar no full. Pra comparar resumo-econ vs resumo-full."""
from __future__ import annotations
import shutil, subprocess, sys, time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

FOLHA = Path(r"D:\inventario-v2\lingua-portuguesa-portugues\colocacao-pronominal")
PILOT = FOLHA / "_pilot2"
ECON = FOLHA / "_pilot2_econ"
ECON.mkdir(exist_ok=True)
PIPE = Path(r"D:\meta novo\Metav2\scripts\papiro\questoes-teste\pipeline")
EXE = shutil.which("claude.cmd") or shutil.which("claude")
DEEP_LOTES = [1, 2, 3]


def run(prompt, tag, timeout=1500):
    t0 = time.time()
    try:
        r = subprocess.run(f'"{EXE}" -p --model claude-opus-4-8 --dangerously-skip-permissions',
                           input=prompt, capture_output=True, text=True, shell=True,
                           timeout=timeout, encoding="utf-8", errors="replace")
    except subprocess.TimeoutExpired:
        print(f"[{tag}] TIMEOUT"); return False
    print(f"[{tag}] rc={r.returncode} {time.time()-t0:.0f}s | {(r.stdout or '')[:160]}")
    return r.returncode == 0


# ---- consolidate lotes 1-3 ----
invs = [PILOT / f"lote-{i:03d}.inventory.json" for i in DEEP_LOTES]
out_md = ECON / "INVENTARIO.md"
out_idx = ECON / "INVENTARIO-indice.json"
invs_str = "\n".join(f"- {p}" for p in invs)
cons = (
    "Você é o Consolidador de Inventário (REDUCE etapa 1). Funda os inventários estruturados.\n\n"
    f"PASSO 1 — Read seu prompt: {PIPE / 'consolidador_inventario.md'}\n"
    f"PASSO 2 — Read os substratos:\n{invs_str}\n"
    f"PASSO 3 — Read o mapa ID→ano/banca: {PILOT / 'id_meta.json'}\n"
    "PASSO 4 — Funda: una pontos iguais (na dúvida NÃO funda), frequência=IDs únicos, "
    "tendência por anos, ranking 🔥/⭐/▫️/·, preserve TODAS as pegadinhas dos distratores, "
    "mapa de pegadinhas por tipo. Cobertura exaustiva inviolável.\n"
    f"PASSO 5 — Write o INVENTÁRIO markdown em: {out_md}\n"
    f"PASSO 6 — Write o ÍNDICE JSON (indice_questao_ponto cobrindo TODOS os IDs dos 3 lotes) em: {out_idx}\n\n"
    "Retorne resumo curto: nº de pontos no ranking, top-5, confirme cobertura."
)
ok = run(cons, "consolidate-econ")
if ok and out_md.exists():
    rani = (
        "Você é o Redator-Rani (REDUCE etapa 2). Transforme o inventário cirúrgico no RESUMO do aluno, voz mentor.\n\n"
        f"PASSO 1 — Read seu prompt: {PIPE / 'redator_rani.md'}\n"
        f"PASSO 2 — Read o inventário consolidado: {out_md}\n"
        "PASSO 3 — Escreva o RESUMO completo na voz Rani. COBERTURA INVIOLÁVEL: todo ponto do ranking aparece. "
        'Itens "a conferir" viram "⚠️ confira na fonte". Mantenha rastreio por ID nas pegadinhas.\n'
        f"PASSO 4 — Write o resumo (só Markdown) em: {ECON / 'RESUMO-RANI.md'}\n\n"
        "Retorne: confirme que todos os pontos do ranking foram cobertos."
    )
    run(rani, "rani-econ")
else:
    print("consolidate falhou — abortando rani")
print("saida em", ECON)
