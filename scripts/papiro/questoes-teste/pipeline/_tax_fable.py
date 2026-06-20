"""Editor de árvore (Opus via OpenRouter — sem depender do Max). Lê tax/<slug>.clusters.json
→ árvore tema→subtema com nomes bons (+ definicao/desempate). Modo HYBRID se houver
tax/<slug>.backbone.md. Audita cobertura. THROWAWAY/pipeline.

Uso:  python _tax_fable.py <slug> "<materia>"   |   python _tax_fable.py --render <slug>
"""
from __future__ import annotations
import io, json, re, sys
from collections import Counter
from pathlib import Path
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).parent
PROMPT_MD = ROOT / "editor_taxonomia.md"
CACHE = Path(r"D:\inventario-v2\_scale_probe\tax")
OR_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-opus-4.8"


def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v:
                val = v
    return val


KEY = envval("OPENROUTER_API_KEY")


def clusters_block(clusters):
    out = []
    for c in clusters:
        top = ", ".join(f"{a}({n})" for a, n in c.get("top_assuntos", [])[:3])
        sm = "\n".join(f"      - {s[:170]}" for s in c.get("samples", []))
        out.append(f"[cluster {c['id']}] {c['size']} questões | TEC: {top}\n    samples:\n{sm}")
    return "\n\n".join(out)


def call_opus(system, user):
    body = {"model": MODEL, "messages": [{"role": "system", "content": system},
            {"role": "user", "content": user}], "temperature": 0, "max_tokens": 16000,
            "reasoning": {"enabled": False}}
    for _ in range(3):
        r = requests.post(OR_URL, headers={"Authorization": f"Bearer {KEY}",
                          "Content-Type": "application/json"}, json=body, timeout=600)
        if r.status_code == 200:
            c = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content")
            if c:
                return c
        print(f"   retry (HTTP {r.status_code}: {r.text[:90]})")
    return None


def parse_tree(text):
    t = re.sub(r"```(json)?", "", text)
    a, b = t.find("{"), t.rfind("}")
    return json.loads(t[a:b + 1])


def audit_and_render(slug, materia):
    cl = json.loads((CACHE / f"{slug}.clusters.json").read_text(encoding="utf-8"))
    size = {c["id"]: c["size"] for c in cl["clusters"]}
    allc = set(size)
    out = CACHE / f"{slug}.tree.json"
    if not out.exists():
        print("✗ árvore não gerada."); return
    tree = json.loads(out.read_text(encoding="utf-8"))
    placed = [c for t in tree.get("temas", []) for s in t.get("subtemas", []) for c in s.get("cluster_ids", [])]
    counts = Counter(placed)
    missing = sorted(allc - set(counts)); phantom = sorted(set(counts) - allc)
    nt = len(tree.get("temas", [])); nsub = sum(len(t.get("subtemas", [])) for t in tree.get("temas", []))
    print("=" * 80)
    print(f" {materia} | {nt} temas · {nsub} subtemas · amostra {cl['total_amostra']:,}q")
    print("=" * 80)
    for t in tree.get("temas", []):
        ts = sum(size.get(c, 0) for s in t.get("subtemas", []) for c in s.get("cluster_ids", []))
        print(f"\n■ {t.get('nome')}  ({ts:,}q)")
        for s in t.get("subtemas", []):
            ss = sum(size.get(c, 0) for c in s.get("cluster_ids", []))
            print(f"   – {s.get('nome')}  ({ss:,}q)")
    ok = not missing and not phantom
    print(f"\nAUDITORIA {len(allc)} clusters: {'✓ OK' if ok else '✗ ' + str({'faltando': missing, 'fantasma': phantom})}")


def main():
    render_only = "--render" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    slug = args[0]
    materia = args[1] if len(args) > 1 else slug
    cl_path = CACHE / f"{slug}.clusters.json"
    bb_path = CACHE / f"{slug}.backbone.md"
    out = CACHE / f"{slug}.tree.json"
    if not render_only and not (out.exists()):
        cl = json.loads(cl_path.read_text(encoding="utf-8"))
        system = PROMPT_MD.read_text(encoding="utf-8")
        bb = f"\n\nBACKBONE (estrutura-alvo por COMPETÊNCIA — organize por ela, não por tema do texto):\n{bb_path.read_text(encoding='utf-8')}" if bb_path.exists() else ""
        user = (f"Matéria: «{materia}». Organize os {len(cl['clusters'])} clusters abaixo numa árvore "
                f"tema→subtema com nomes bons (+ definicao + desempate por nó). Cada cluster em ≥1 subtema; "
                f"use os SAMPLES (ignore TEC \"?\").{bb}\n\n=== CLUSTERS ===\n{clusters_block(cl['clusters'])}\n\n"
                f"Responda SOMENTE o JSON da árvore (schema do system: materia, temas[].subtemas[] com "
                f"nome, cluster_ids, definicao, exemplos, desempate, ref). Sem texto fora.")
        print(f"Opus (OpenRouter) montando a árvore de {materia}…")
        txt = call_opus(system, user)
        if not txt:
            print("✗ Opus não respondeu"); return
        try:
            tree = parse_tree(txt)
        except Exception as e:
            print("✗ JSON inválido:", e); print(txt[:600]); return
        out.write_text(json.dumps(tree, ensure_ascii=False, indent=1), encoding="utf-8")
        print("✓ árvore escrita")
    audit_and_render(slug, materia)


if __name__ == "__main__":
    main()
