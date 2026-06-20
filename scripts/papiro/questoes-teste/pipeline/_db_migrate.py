"""Migration: cria schema papiro + tabelas da taxonomia de questões NO BANCO DO COOLIFY
(o do túnel, onde estão as questoes). Aditivo e idempotente — não toca em nada existente.
  papiro.q_node          (árvore tema/subtema/ponto, hierárquico)
  papiro.q_node_questao  (mapa questão→nó, multi-rótulo)
"""
import sys, io
from urllib.parse import urlparse, unquote
import psycopg2

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def envval(key, path=r"D:/verus_api/.env"):
    val = None
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if line.startswith(key + "="):
            v = line[len(key) + 1:].strip().strip('"').strip("'")
            if v:
                val = v
    return val


DDL = """
create schema if not exists papiro;

create table if not exists papiro.q_node (
  id         bigserial primary key,
  materia    text not null,
  nivel      smallint not null,                       -- 1=tema 2=subtema 3=ponto
  parent_id  bigint references papiro.q_node(id) on delete cascade,
  nome       text not null,
  definicao  text,
  desempate  text,
  artigo     text,
  ordem      int default 0,
  created_at timestamptz default now()
);
create index if not exists ix_qnode_materia on papiro.q_node(materia);
create index if not exists ix_qnode_parent  on papiro.q_node(parent_id);

create table if not exists papiro.q_node_questao (
  questao_id integer not null,                        -- ref. lógica public.questoes(id)
  node_id    bigint not null references papiro.q_node(id) on delete cascade,
  principal  boolean default false,                    -- nó principal (tema de verdade)
  forte      boolean not null default false,           -- secundário forte: cobra o tema (entra no filtro). fraco=só citou
  ordem      smallint default 0,
  primary key (questao_id, node_id)
);
create index if not exists ix_qnq_node    on papiro.q_node_questao(node_id);
create index if not exists ix_qnq_questao on papiro.q_node_questao(questao_id);
"""

# RLS + grants (se for Supabase self-hosted: roles anon/authenticated). Tolerante a falha.
RLS = """
grant usage on schema papiro to anon, authenticated;
grant select on all tables in schema papiro to anon, authenticated;
alter default privileges in schema papiro grant select on tables to anon, authenticated;
alter table papiro.q_node enable row level security;
alter table papiro.q_node_questao enable row level security;
drop policy if exists qnode_read on papiro.q_node;
create policy qnode_read on papiro.q_node for select using (true);
drop policy if exists qnq_read on papiro.q_node_questao;
create policy qnq_read on papiro.q_node_questao for select using (true);
"""

p = urlparse(envval("DATABASE_URL"))
conn = psycopg2.connect(host="127.0.0.1", port=5433, user=unquote(p.username), password=unquote(p.password),
                        dbname=(p.path or "/postgres").lstrip("/"), sslmode="disable", connect_timeout=30)
conn.autocommit = True
cur = conn.cursor()
cur.execute(DDL)
print("✓ schema papiro + tabelas q_node / q_node_questao criados")
try:
    cur.execute(RLS)
    print("✓ RLS + grants (Supabase) aplicados")
except Exception as e:
    print(f"⚠ RLS/grants pulados (não-Supabase?): {str(e)[:120]}")
cur.execute("select table_name from information_schema.tables where table_schema='papiro' order by 1")
print("tabelas papiro.*:", [r[0] for r in cur.fetchall()])
cur.close(); conn.close()
