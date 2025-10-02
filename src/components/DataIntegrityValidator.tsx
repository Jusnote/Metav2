/**
 * Componente para validar integridade dos dados durante migração
 * Usado para verificar se a migração foi bem-sucedida
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { auditLocalStorage, LocalStorageAuditResult } from '@/utils/localStorageAudit';
import { isMigrationCompleted } from '@/utils/dataMigration';

interface ValidationResult {
  table: string;
  localCount: number;
  serverCount: number;
  status: 'success' | 'warning' | 'error';
  message: string;
}

interface DataIntegrityReport {
  isValid: boolean;
  validations: ValidationResult[];
  localStorageAudit: LocalStorageAuditResult;
  recommendations: string[];
  lastValidation: Date;
}

export function DataIntegrityValidator() {
  const [report, setReport] = useState<DataIntegrityReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Executar validação inicial
    validateDataIntegrity();
  }, []);

  const validateDataIntegrity = async () => {
    setIsValidating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Auditar localStorage
      const localAudit = auditLocalStorage();

      // Validar cada tipo de dados
      const validations: ValidationResult[] = [];

      // Validar Flashcards
      const flashcardValidation = await validateFlashcards(user.id, localAudit);
      validations.push(flashcardValidation);

      // Validar Quick Notes
      const notesValidation = await validateQuickNotes(user.id, localAudit);
      validations.push(notesValidation);

      // Validar Documents
      const documentsValidation = await validateDocuments(user.id);
      validations.push(documentsValidation);

      // Gerar recomendações
      const recommendations = generateRecommendations(validations, localAudit);

      const newReport: DataIntegrityReport = {
        isValid: validations.every(v => v.status === 'success'),
        validations,
        localStorageAudit: localAudit,
        recommendations,
        lastValidation: new Date()
      };

      setReport(newReport);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na validação');
    } finally {
      setIsValidating(false);
    }
  };

  const validateFlashcards = async (userId: string, audit: LocalStorageAuditResult): Promise<ValidationResult> => {
    const localFlashcards = audit.dataKeys.find(key => key.key === 'flashcards_cards');
    const localCount = localFlashcards?.itemCount || 0;

    const { data: serverFlashcards, error } = await supabase
      .from('flashcards')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;

    const serverCount = serverFlashcards?.length || 0;

    let status: 'success' | 'warning' | 'error' = 'success';
    let message = `${serverCount} flashcards no servidor`;

    if (localCount > 0 && serverCount === 0) {
      status = 'error';
      message = `${localCount} flashcards locais não migrados`;
    } else if (localCount > serverCount) {
      status = 'warning';
      message = `${localCount - serverCount} flashcards podem não ter sido migrados`;
    } else if (serverCount > 0) {
      message = `${serverCount} flashcards sincronizados com sucesso`;
    }

    return {
      table: 'Flashcards',
      localCount,
      serverCount,
      status,
      message
    };
  };

  const validateQuickNotes = async (userId: string, audit: LocalStorageAuditResult): Promise<ValidationResult> => {
    const localNotes = audit.dataKeys.find(key => key.key === 'quick_notes_local');
    const localCount = localNotes?.itemCount || 0;

    const { data: serverNotes, error } = await supabase
      .from('quick_notes')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;

    const serverCount = serverNotes?.length || 0;

    let status: 'success' | 'warning' | 'error' = 'success';
    let message = `${serverCount} notas no servidor`;

    if (localCount > 0 && serverCount === 0) {
      status = 'error';
      message = `${localCount} notas locais não migradas`;
    } else if (localCount > serverCount) {
      status = 'warning';
      message = `${localCount - serverCount} notas podem não ter sido migradas`;
    } else if (serverCount > 0) {
      message = `${serverCount} notas sincronizadas com sucesso`;
    }

    return {
      table: 'Quick Notes',
      localCount,
      serverCount,
      status,
      message
    };
  };

  const validateDocuments = async (userId: string): Promise<ValidationResult> => {
    const { data: serverDocuments, error } = await supabase
      .from('documents')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;

    const serverCount = serverDocuments?.length || 0;

    return {
      table: 'Documents',
      localCount: 0, // Documents não usam localStorage
      serverCount,
      status: 'success',
      message: `${serverCount} documentos no servidor`
    };
  };

  const generateRecommendations = (validations: ValidationResult[], audit: LocalStorageAuditResult): string[] => {
    const recommendations: string[] = [];

    // Verificar problemas de migração
    const errorValidations = validations.filter(v => v.status === 'error');
    if (errorValidations.length > 0) {
      recommendations.push('🚨 Executar migração de dados pendentes');
    }

    const warningValidations = validations.filter(v => v.status === 'warning');
    if (warningValidations.length > 0) {
      recommendations.push('⚠️ Verificar dados que podem não ter sido migrados completamente');
    }

    // Verificar localStorage
    const migrationNeeded = audit.dataKeys.filter(key => key.needsMigration && key.itemCount > 0);
    if (migrationNeeded.length > 0 && !isMigrationCompleted()) {
      recommendations.push('📦 Executar migração completa localStorage → Supabase');
    }

    // Verificar limpeza
    if (audit.tempKeys.length > 0) {
      recommendations.push('🧹 Limpar chaves temporárias do localStorage');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Dados íntegros e sincronizados corretamente');
    }

    return recommendations;
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: 'success' | 'warning' | 'error') => {
    const variants = {
      success: 'default' as const,
      warning: 'secondary' as const,
      error: 'destructive' as const
    };

    const labels = {
      success: 'OK',
      warning: 'Atenção',
      error: 'Erro'
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Erro na validação: {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={validateDataIntegrity}
          >
            Tentar Novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {report?.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            Integridade dos Dados
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={validateDataIntegrity}
            disabled={isValidating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
            {isValidating ? 'Validando...' : 'Revalidar'}
          </Button>
        </CardHeader>
        <CardContent>
          {isValidating && (
            <div className="space-y-2">
              <Progress value={undefined} className="w-full" />
              <p className="text-sm text-muted-foreground">Validando integridade dos dados...</p>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              {/* Status Geral */}
              <div className="flex items-center gap-2">
                <Badge variant={report.isValid ? 'default' : 'secondary'}>
                  {report.isValid ? 'Dados Íntegros' : 'Requer Atenção'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Última validação: {report.lastValidation.toLocaleString()}
                </span>
              </div>

              {/* Validações por Tabela */}
              <div className="space-y-3">
                <h4 className="font-medium">Status por Tipo de Dados</h4>
                {report.validations.map((validation, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(validation.status)}
                      <div>
                        <p className="font-medium">{validation.table}</p>
                        <p className="text-sm text-muted-foreground">{validation.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {validation.localCount > 0 && (
                        <Badge variant="outline">Local: {validation.localCount}</Badge>
                      )}
                      <Badge variant="outline">Servidor: {validation.serverCount}</Badge>
                      {getStatusBadge(validation.status)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recomendações */}
              {report.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Recomendações</h4>
                  <div className="space-y-1">
                    {report.recommendations.map((recommendation, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        {recommendation}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumo localStorage */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Resumo localStorage</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total de Chaves</p>
                    <p className="font-medium">{report.localStorageAudit.totalKeys}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dados</p>
                    <p className="font-medium">{report.localStorageAudit.dataKeys.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Temporárias</p>
                    <p className="font-medium">{report.localStorageAudit.tempKeys.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tamanho Total</p>
                    <p className="font-medium">
                      {(report.localStorageAudit.totalSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
