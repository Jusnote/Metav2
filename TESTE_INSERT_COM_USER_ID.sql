-- ========================================
-- TESTE DE INSERT COM USER_ID MANUAL
-- ========================================

-- 1. Primeiro, pegue seu user_id real
SELECT id, email FROM auth.users LIMIT 5;

-- 2. IMPORTANTE: Copie o "id" (UUID) da query acima e substitua abaixo onde está escrito 'SEU_USER_ID_AQUI'

-- 3. Teste inserir 2 documentos com mesmo subtopic_id
DO $$
DECLARE
    v_user_id UUID := 'SEU_USER_ID_AQUI'; -- ⚠️ SUBSTITUA PELO SEU USER_ID REAL
    v_subtopic_id UUID := '456d0343-c431-4f3a-8057-12afd9760c94';
BEGIN
    -- Tentar inserir primeiro documento
    INSERT INTO documents (title, content, subtopic_id, user_id)
    VALUES (
        'Teste 1 - Verificação Constraint',
        '[]'::jsonb,
        v_subtopic_id,
        v_user_id
    );

    RAISE NOTICE 'Primeiro documento inserido com sucesso!';

    -- Tentar inserir SEGUNDO documento com MESMO subtopic_id
    INSERT INTO documents (title, content, subtopic_id, user_id)
    VALUES (
        'Teste 2 - Verificação Constraint',
        '[]'::jsonb,
        v_subtopic_id,
        v_user_id
    );

    RAISE NOTICE 'Segundo documento inserido com sucesso! ✅ CONSTRAINT NÃO EXISTE';

    -- Limpar documentos de teste
    DELETE FROM documents
    WHERE title IN ('Teste 1 - Verificação Constraint', 'Teste 2 - Verificação Constraint')
      AND user_id = v_user_id;

    RAISE NOTICE 'Documentos de teste removidos.';

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION '❌ ERRO: Constraint UNIQUE ainda existe! Detalhes: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ ERRO inesperado: %', SQLERRM;
END $$;
