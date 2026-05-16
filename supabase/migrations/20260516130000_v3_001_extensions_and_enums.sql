-- V3 Migration 001 — Setup inicial: schema coaching, extensões e função de trigger
-- Refs: doc 04 (schema), doc 10 (fase 1)
-- REESCRITO: todas as definições V3 vivem em schema "coaching" (isolado de public/V2)

-- ============================================================
-- 1. Schema isolado para V3
-- ============================================================
CREATE SCHEMA IF NOT EXISTS coaching;

GRANT USAGE ON SCHEMA coaching TO authenticated, service_role, anon;
GRANT ALL ON SCHEMA coaching TO postgres, service_role;

-- ============================================================
-- 2. Extensões (globais, sem qualificar schema)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
-- 3. Função de trigger para atualizado_em (em coaching)
-- ============================================================
CREATE OR REPLACE FUNCTION coaching.update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
