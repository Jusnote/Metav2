"""Extracao DIRETA na API Haiku (asyncio) das pegadinhas dos lotes art.5.
Rapido (~2min), JSON limpo, custo medido. Substitui o workflow de subagentes (lento)."""
from __future__ import annotations
import json, sys, time, re, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from anthropic import Anthropic

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CACHE = Path(r"D:\inventario-v2\_scale_probe")
BATCHES = CACHE / "peg_batches"
OUT = CACHE / "peg_out_api"
OUT.mkdir(parents=True, exist_ok=True)
MODEL = "claude-haiku-4-5"
CONC = 8


def envval(key):
    for path in [r"D:/meta novo/Metav2/.env", r"D:/meta novo/Metav2/.env.local", r"D:/verus_api/.env"]:
        try:
            for line in open(path, encoding="utf-8", errors="replace"):
                line = line.strip()
                if line.startswith(key + "="):
                    return line[len(key) + 1:].strip().strip('"').strip("'")
        except FileNotFoundError:
            continue
    return None


TIPOS = "[troca_de_palavra, absolutizacao, conceito_vizinho, troca_de_numero, invencao, inversao, exceção_ignorada]"
SYS = (
    "Você extrai PEGADINHAS (armadilhas dos distratores) de questões de concurso de Direito Constitucional "
    "(art. 5º CF). É uma MEDIÇÃO DE SATURAÇÃO: estamos CONTANDO armadilhas DISTINTAS, não escrevendo material. "
    "Seja CANÔNICO e CONSISTENTE.\n"
    "Para CADA questão, para CADA alternativa ERRADA (distrator), gere uma armadilha:\n"
    f"  - tipo: um de {TIPOS}\n"
    "  - confusao: frase CURTA e CANÔNICA (≤12 palavras, PT) da confusão específica, formulada de modo GENÉRICO "
    "(NÃO cite o texto literal), pra que a MESMA armadilha de questões diferentes gere frase PARECIDA. "
    "Ex.: 'confunde direitos individuais com sociais' | 'afirma direito absoluto ignorando exceção legal'.\n"
    "Responda SOMENTE com JSON puro (sem ```), no formato: "
    '{"results":[{"id":<int>,"traps":[{"tipo":"...","confusao":"..."}]}]}'
)


def parse_json(text):
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    i, j = text.find("{"), text.rfind("}")
    if i >= 0 and j > i:
        text = text[i:j+1]
    return json.loads(text)


_lock = threading.Lock()


def do_batch(client, bf, usage):
    bi = bf.stem.split("-")[1]
    outp = OUT / f"traps-{bi}.json"
    if outp.exists():
        return f"[skip] {bi}"
    items = json.loads(bf.read_text(encoding="utf-8"))
    blob = "\n\n".join(it["text"] for it in items)
    user = f"Extraia as pegadinhas destas {len(items)} questões:\n\n{blob}"
    for attempt in range(4):
        try:
            r = client.messages.create(
                model=MODEL, max_tokens=8000, temperature=0,
                system=SYS, messages=[{"role": "user", "content": user}])
            with _lock:
                usage["in"] += r.usage.input_tokens
                usage["out"] += r.usage.output_tokens
            d = parse_json(r.content[0].text)
            outp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
            nt = sum(len(x.get("traps", [])) for x in d.get("results", []))
            return f"[ok] {bi}: {len(d.get('results', []))} q, {nt} traps"
        except Exception as e:
            if attempt == 3:
                return f"[FALHA] {bi}: {e.__class__.__name__} {str(e)[:80]}"
            time.sleep(2 * (attempt + 1))


def main():
    key = envval("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("ANTHROPIC_API_KEY nao encontrada")
    client = Anthropic(api_key=key)
    usage = {"in": 0, "out": 0}
    bfs = sorted(BATCHES.glob("batch-*.json"))
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=CONC) as ex:
        for r in ex.map(lambda bf: do_batch(client, bf, usage), bfs):
            print(" ", r)
    cost = usage["in"] / 1e6 * 1.0 + usage["out"] / 1e6 * 5.0
    print(f"\n[uso] in={usage['in']:,} out={usage['out']:,} tok | ~${cost:.2f} | {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
