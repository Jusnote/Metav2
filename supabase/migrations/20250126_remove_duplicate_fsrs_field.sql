-- ============================================
-- Migração: Remover campo duplicado fsrs_card_state
-- Data: 2025-01-26
-- Descrição: Remove fsrs_card_state que foi criado por engano
--            duplicando a funcionalidade de fsrs_state
-- ============================================

-- Verificar se há dados em fsrs_card_state antes de remover
DO $$
DECLARE
  records_with_data INTEGER;
BEGIN
  SELECT COUNT(*) INTO records_with_data
  FROM schedule_items
  WHERE fsrs_card_state IS NOT NULL;

  IF records_with_data > 0 THEN
    RAISE WARNING '⚠️ Encontrados % registros com fsrs_card_state populado', records_with_data;
    RAISE NOTICE 'Migrando dados de fsrs_card_state para fsrs_state...';

    -- Migrar dados se existirem (manter fsrs_state se já houver, senão copiar de fsrs_card_state)
    UPDATE schedule_items
    SET fsrs_state = COALESCE(fsrs_state, fsrs_card_state)
    WHERE fsrs_card_state IS NOT NULL;

    RAISE NOTICE '✅ Dados migrados com sucesso!';
  ELSE
    RAISE NOTICE '✅ Nenhum dado encontrado em fsrs_card_state';
  END IF;
END $$;

-- Remover o campo duplicado
ALTER TABLE schedule_items
DROP COLUMN IF EXISTS fsrs_card_state;

-- Verificação final
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_items'
    AND column_name = 'fsrs_card_state'
  ) THEN
    RAISE WARNING '⚠️ Campo fsrs_card_state ainda existe!';
  ELSE
    RAISE NOTICE '✅ Campo fsrs_card_state removido com sucesso!';
  END IF;

  -- Verificar que fsrs_state ainda existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_items'
    AND column_name = 'fsrs_state'
  ) THEN
    RAISE NOTICE '✅ Campo fsrs_state mantido (campo oficial)';
  ELSE
    RAISE EXCEPTION '❌ ERRO: Campo fsrs_state não existe! Rollback necessário.';
  END IF;
END $$;

-- Mensagem final
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Limpeza concluída!';
  RAISE NOTICE '📊 Campo oficial: fsrs_state (JSONB)';
  RAISE NOTICE '🗑️ Campo removido: fsrs_card_state (duplicado)';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Próximos passos:';
  RAISE NOTICE '1. Regenerar tipos TypeScript: npx supabase gen types typescript';
  RAISE NOTICE '2. Verificar que código continua funcionando';
END $$;
