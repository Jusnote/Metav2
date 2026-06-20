"""Extracao one-shot via `claude -p --model haiku` (auth Max), prompt no stdin,
resposta JSON pura (sem tools). Threaded. Escreve peg_out_cli/traps-NN.json limpo."""
from __future__ import annotations
import json, sys, time, re, shutil, subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CACHE = Path(r"D:\inventario-v2\_scale_probe")
BATCHES = CACHE / "peg_batches"
OUT = CACHE / "peg_out_cli"
OUT.mkdir(parents=True, exist_ok=True)
WORKERS = 6
EXE = shutil.which("claude.cmd") or shutil.which("claude")

TIPOS = "[troca_de_palavra, absolutizacao, conceito_vizinho, troca_de_numero, invencao, inversao, exceção_ignorada]"
SYS = (
    "Você extrai PEGADINHAS (armadilhas dos distratores) de questões de concurso (art. 5º CF). "
    "MEDIÇÃO DE SATURAÇÃO: contamos armadilhas DISTINTAS. Seja CANÔNICO, ESPECÍFICO e CONSISTENTE — "
    "NUNCA use frases genéricas tipo 'interpretacao diferente'.\n"
    "Para CADA questão, para CADA alternativa ERRADA, gere uma armadilha:\n"
    f"  - tipo: um de {TIPOS}\n"
    "  - confusao: frase CURTA, ESPECÍFICA e CANÔNICA (≤12 palavras, PT) da confusão exata, genérica o bastante "
    "pra que a MESMA armadilha de questões diferentes gere frase PARECIDA. "
    "Ex.: 'confunde direitos individuais com sociais'; 'afirma habeas data cabível para corrigir dado de terceiro'.\n"
    "IMPORTANTE: NÃO use ferramentas, NÃO escreva arquivos. Responda SOMENTE com o JSON puro (sem ```), formato:\n"
    '{"results":[{"id":<int>,"traps":[{"tipo":"...","confusao":"..."}]}]}'
)


def parse_json(text):
    text = re.sub(r"```(json)?", "", text)
    i, j = text.find("{"), text.rfind("}")
    if i >= 0 and j > i:
        text = text[i:j+1]
    return json.loads(text)


def do_batch(bf):
    bi = bf.stem.split("-")[1]
    outp = OUT / f"traps-{bi}.json"
    if outp.exists():
        return f"[skip] {bi}"
    items = json.loads(bf.read_text(encoding="utf-8-sig"))
    blob = "\n\n".join(it["text"] for it in items)
    prompt = SYS + f"\n\n=== {len(items)} QUESTÕES ===\n" + blob
    for attempt in range(3):
        try:
            r = subprocess.run(
                f'"{EXE}" -p --model haiku --output-format text',
                input=prompt, capture_output=True, text=True, shell=True,
                timeout=300, encoding="utf-8", errors="replace")
            if r.returncode != 0:
                raise RuntimeError(f"rc={r.returncode}: {(r.stderr or '')[:120]}")
            d = parse_json(r.stdout)
            outp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
            nt = sum(len(x.get("traps", [])) for x in d.get("results", []))
            return f"[ok] {bi}: {len(d.get('results', []))} q, {nt} traps"
        except Exception as e:
            if attempt == 2:
                return f"[FALHA] {bi}: {e.__class__.__name__} {str(e)[:90]}"
            time.sleep(3)


def main():
    if not EXE:
        sys.exit("claude CLI nao encontrado")
    bfs = sorted(BATCHES.glob("batch-*.json"))
    print(f"[cli] {len(bfs)} lotes, {WORKERS} workers, exe={Path(EXE).name}")
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for r in ex.map(do_batch, bfs):
            print(" ", r, flush=True)
    print(f"\n[fim] {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
