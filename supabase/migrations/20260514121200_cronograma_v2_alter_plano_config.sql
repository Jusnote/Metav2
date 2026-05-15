-- UP: novas colunas em plano_config
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE plano_config
  ADD COLUMN IF NOT EXISTS simulados_freq simulados_freq_enum NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS tem_redacao BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_material tipo_material_enum NOT NULL DEFAULT 'misto',
  ADD COLUMN IF NOT EXISTS horario_preferido horario_preferido_enum NOT NULL DEFAULT 'flexivel';

COMMENT ON COLUMN plano_config.simulados_freq IS 'Frequência de simulados periódicos no plano';
COMMENT ON COLUMN plano_config.tem_redacao IS 'Se TRUE, reserva ~1h/semana pra redação';
COMMENT ON COLUMN plano_config.tipo_material IS 'Tipo de material preferido (afeta duração de blocos)';
COMMENT ON COLUMN plano_config.horario_preferido IS 'Horário em que o user prefere estudar (UX hint)';
