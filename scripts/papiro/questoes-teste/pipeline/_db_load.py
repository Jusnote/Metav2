"""Loader idempotente: carrega a taxonomia + colocação de uma matéria no banco do Coolify.
Lê tax/<slug>.tree_v3.json + tax/<slug>.placement.json → papiro.q_node + q_node_questao.
Re-rodável SEM trocar IDs: faz UPSERT dos nós por chave natural (materia+nivel+parent+nome),
remove só os órfãos (nós que sumiram da árvore) e renova o mapa de questões. Assim re-rodar a
mesma árvore mantém os mesmos node_id (não quebra filtros/cache/links no front).
Uso: python _db_load.py <slug> "<materia>"
"""
import json, sys, io
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2
from psycopg2.extras import execute_values

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
SLUG = sys.argv[1]
MATERIA = sys.argv[2] if len(sys.argv) > 2 else SLUG
TAX = Path(r"D:\inventario-v2\_scale_probe\tax")
tree = json.loads((TAX / f"{SLUG}.tree_v3.json").read_text(encoding="utf-8"))
plc = json.loads((TAX / f"{SLUG}.placement.json").read_text(encoding="utf-8"))["placement"]


def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v:
                val = v
    return val


p = urlparse(envval("DATABASE_URL"))
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                        dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
cur = conn.cursor()


def upsert(materia, nivel, parent, nome, definicao=None, desempate=None, artigo=None, ordem=0):
    """Reusa o nó existente (mesma matéria/nível/parent/nome) preservando o id; senão insere."""
    cur.execute("""select id from papiro.q_node
                   where materia=%s and nivel=%s and nome=%s and parent_id is not distinct from %s""",
                (materia, nivel, nome, parent))
    r = cur.fetchone()
    if r:
        nid = r[0]
        cur.execute("""update papiro.q_node set definicao=%s, desempate=%s, artigo=%s, ordem=%s where id=%s""",
                    (definicao, desempate, artigo, ordem, nid))
        return nid
    cur.execute("""insert into papiro.q_node (materia,nivel,parent_id,nome,definicao,desempate,artigo,ordem)
                   values (%s,%s,%s,%s,%s,%s,%s,%s) returning id""",
                (materia, nivel, parent, nome, definicao, desempate, artigo, ordem))
    return cur.fetchone()[0]


# upsert da árvore (preserva IDs) + monta leaves na MESMA ordem do _place_all (placement node-id 1..N)
kept, leaves = [], []
for it, tema in enumerate(tree["temas"]):
    tid = upsert(MATERIA, 1, None, tema["nome"], ordem=it); kept.append(tid)
    for isub, s in enumerate(tema["subtemas"]):
        sid = upsert(MATERIA, 2, tid, s["nome"], s.get("definicao"), s.get("desempate"), None, isub); kept.append(sid)
        pts = s.get("pontos", [])
        if pts:
            for ip, pt in enumerate(pts):
                pid = upsert(MATERIA, 3, sid, pt["nome"], None, None, pt.get("artigo"), ip)
                kept.append(pid); leaves.append(pid)
        else:
            leaves.append(sid)  # subtema-folha

# remove órfãos (nós que sumiram da árvore) — cascateia o mapa deles
cur.execute("delete from papiro.q_node where materia=%s and id <> all(%s)", (MATERIA, kept))
orphans = cur.rowcount
# renova o mapa da matéria (nós preservados, vínculos refeitos do zero)
cur.execute("""delete from papiro.q_node_questao m using papiro.q_node n
               where m.node_id = n.id and n.materia = %s""", (MATERIA,))
print(f"[árvore] {len(tree['temas'])} temas · {sum(len(t['subtemas']) for t in tree['temas'])} subtemas · "
      f"{len(leaves)} folhas (upsert, IDs preservados) · {orphans} órfãos removidos")

# insere mapa questão→nó (multi-rótulo); placement n = índices de folha 1-based.
# v["f"] (opcional) = subconjunto de n marcado como secundário FORTE (cobra o tema).
# Sem "f" (ex.: DConst binário antigo) → forte=false; passo de re-avaliação promove depois.
rows = []
for qid_s, v in plc.items():
    qid = int(qid_s)
    fortes = set(v.get("f", []))
    for ordem, leaf_idx in enumerate(v.get("n", [])):
        if 1 <= leaf_idx <= len(leaves):
            principal = ordem == 0
            forte = leaf_idx in fortes  # principal já entra no filtro; forte cobre o secundário legítimo
            rows.append((qid, leaves[leaf_idx - 1], principal, forte, ordem))
execute_values(cur, "insert into papiro.q_node_questao (questao_id,node_id,principal,forte,ordem) values %s "
                    "on conflict (questao_id,node_id) do nothing", rows, page_size=5000)
conn.commit()
print(f"[mapa] {len(rows):,} vínculos questão→nó inseridos ({len(plc):,} questões)")

# verificação
cur.execute("select count(*) from papiro.q_node where materia=%s", (MATERIA,))
nn = cur.fetchone()[0]
cur.execute("""select n.nome, count(*) c from papiro.q_node_questao m join papiro.q_node n on n.id=m.node_id
               where n.materia=%s and m.principal group by n.nome order by c desc limit 8""", (MATERIA,))
print(f"\n✓ {MATERIA} no banco: {nn} nós | top nós por incidência (principal):")
for nome, c in cur.fetchall():
    print(f"   {c:>7,}  {nome}")
cur.close(); conn.close()
