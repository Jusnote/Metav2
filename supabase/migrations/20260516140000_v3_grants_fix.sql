-- Hotfix V3: grants em tabelas/sequences/functions de coaching
-- O esquema dedicado não herda automaticamente os GRANTs que o public tem.
-- Sem isto, service_role e authenticated batem em "permission denied for table X".

GRANT ALL ON ALL TABLES IN SCHEMA coaching TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA coaching TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA coaching TO anon;

GRANT ALL ON ALL SEQUENCES IN SCHEMA coaching TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA coaching TO authenticated, anon;

GRANT ALL ON ALL ROUTINES IN SCHEMA coaching TO postgres, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA coaching TO authenticated, anon;

-- Default privileges pra futuras tabelas (criadas por postgres)
ALTER DEFAULT PRIVILEGES IN SCHEMA coaching
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA coaching
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA coaching
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA coaching
  GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA coaching
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA coaching
  GRANT ALL ON ROUTINES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA coaching
  GRANT EXECUTE ON ROUTINES TO authenticated, anon;

-- Notifica PostgREST pra refresh do schema cache
NOTIFY pgrst, 'reload schema';
