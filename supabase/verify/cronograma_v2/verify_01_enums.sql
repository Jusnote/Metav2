-- Lista enums esperados; cada SELECT deve retornar a row
SELECT typname FROM pg_type WHERE typname = 'nivel_conhecimento_enum';
SELECT typname FROM pg_type WHERE typname = 'simulados_freq_enum';
SELECT typname FROM pg_type WHERE typname = 'tipo_material_enum';
SELECT typname FROM pg_type WHERE typname = 'horario_preferido_enum';
SELECT typname FROM pg_type WHERE typname = 'plan_template_visibility';

-- Confirma valores dos enums
SELECT unnest(enum_range(NULL::nivel_conhecimento_enum));
SELECT unnest(enum_range(NULL::simulados_freq_enum));

-- Confirma 'rascunho' adicionado ao enum existente
SELECT 'rascunho' = ANY(enum_range(NULL::plano_status)::TEXT[]) AS rascunho_exists;
