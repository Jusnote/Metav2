"""Lista matérias + contagem (incidência 2020-2025) via tunnel. Step 0 da taxonomia.
Salva _scale_probe/_materias.json pra priorização do batch."""
import io, json, sys
from urllib.parse import urlparse, unquote
import psycopg2

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def envval(key, path=r"D:/verus_api/.env"):
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip().strip('"').strip("'")


p = urlparse(envval("DATABASE_URL"))
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username),
                        password=unquote(p.password), dbname=(p.path or "/postgres").lstrip("/"),
                        sslmode="disable", connect_timeout=15)
cur = conn.cursor()
cur.execute("""
  select materia, count(*) from public.questoes
  where coalesce(anulada,false)=false
    and enunciado is not null and length(enunciado) > 20 and materia is not null
  group by materia order by count(*) desc
""")
rows = cur.fetchall()
cur.close(); conn.close()

total = sum(n for _, n in rows)
print(f"{len(rows)} matérias | {total:,} questões (todos os anos, válidas)\n")
for i, (m, n) in enumerate(rows, 1):
    print(f"{i:>3}. {n:>7,}  {m}")

out = r"D:\inventario-v2\_scale_probe\_materias.json"
open(out, "w", encoding="utf-8").write(
    json.dumps([{"materia": m, "n": n} for m, n in rows], ensure_ascii=False, indent=1))
print(f"\n[salvo] {out}")
