-- UP: feriados_nacionais (lookup público; seed acontece na task 20)
-- DOWN: DROP TABLE feriados_nacionais

CREATE TABLE IF NOT EXISTS feriados_nacionais (
  data DATE PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  uf CHAR(2),
  cidade TEXT
);

CREATE INDEX IF NOT EXISTS ix_feriados_data_tipo ON feriados_nacionais(tipo, data);

COMMENT ON TABLE feriados_nacionais IS
  'Lookup de feriados nacionais/estaduais/municipais. Cronograma respeita data como exceção (capacidade=0).';
