"""ORQUESTRADOR do pipeline-padrão de taxonomia (validado em DConst/Português).
Por matéria, em incidência-first, roda os 7 estágios com CHECKPOINT (pula o que já existe)
e continue-on-error. Estágios chamam os scripts validados via subprocess.

Pipeline: prep → árvore(Opus) → loop c1(DeepSeek) → refino(Opus) → 3º nível(Opus) →
          coloca tudo(DeepSeek direto) → revisao.html

Uso:
  python _orchestrate.py                      # escopo de lançamento (content=topic), incidência-first
  python _orchestrate.py "<materia exata>"    # uma matéria
  python _orchestrate.py --status             # progresso de todas
"""
import json, re, subprocess, sys, unicodedata
from pathlib import Path

PIPE = Path(__file__).parent
TAX = Path(r"D:\inventario-v2\_scale_probe\tax")
PY = sys.executable
MATS = json.loads(Path(r"D:\inventario-v2\_scale_probe\_materias.json").read_text(encoding="utf-8"))
DONE_SLUGS = {"dconst", "portugues"}  # já feitas

# (sufixo do arquivo de saída do estágio, comando)
STAGES = [
    ("clusters.json", lambda mat, sl: [PY, "_tax_prep.py", mat, sl]),
    ("tree.json", lambda mat, sl: [PY, "_tax_fable.py", sl, mat]),
    ("cycle1.json", lambda mat, sl: [PY, "_tree_loop_c1.py", sl, mat]),
    ("tree_v2.json", lambda mat, sl: [PY, "_tree_loop_refine.py", sl, mat]),
    ("tree_v3.json", lambda mat, sl: [PY, "_tree_3level.py", sl, mat]),
    ("placement.json", lambda mat, sl: [PY, "_place_all.py", sl, mat, f"{sl}.tree_v3.json"]),
    ("revisao.html", lambda mat, sl: [PY, "_place_html.py", sl, mat, f"{sl}.tree_v3.json"]),
]


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "_", s).strip("_").lower()[:40]


def scope():
    out = []
    for m in MATS:
        n = m["materia"]
        if n.startswith("Direito") or n.startswith("Legislação") or n == "Contabilidade Geral":
            sl = slugify(n)
            if sl not in DONE_SLUGS:
                out.append((n, sl, m["n"]))
    return sorted(out, key=lambda x: -x[2])  # incidência-first


def stage_done(sl, suffix):
    return (TAX / f"{sl}.{suffix}").exists()


def run_materia(mat, sl):
    for suffix, cmd_fn in STAGES:
        if stage_done(sl, suffix):
            print(f"  [skip] {suffix}", flush=True); continue
        print(f"  → {suffix} …", flush=True)
        r = subprocess.run(cmd_fn(mat, sl), cwd=PIPE)
        if r.returncode != 0 or not stage_done(sl, suffix):
            raise RuntimeError(f"estágio {suffix} falhou (rc={r.returncode})")
    print(f"  ✓ {mat} COMPLETA", flush=True)


def main():
    if "--status" in sys.argv:
        for mat, sl, n in scope():
            done = sum(1 for suf, _ in STAGES if stage_done(sl, suf))
            print(f"  {done}/{len(STAGES)}  {mat} ({n:,}q)")
        return
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args:
        mat = args[0]; run_materia(mat, slugify(mat)); return
    sc = scope()
    total_q = sum(n for _, _, n in sc)
    print(f"{len(sc)} matérias no escopo (incidência-first) · {total_q:,} questões\n")
    for i, (mat, sl, n) in enumerate(sc, 1):
        print(f"[{i}/{len(sc)}] {mat} ({n:,}q) slug={sl}", flush=True)
        try:
            run_materia(mat, sl)
        except Exception as e:
            print(f"  ✗ ERRO: {e} — continua pra próxima", flush=True)


if __name__ == "__main__":
    main()
