import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Database, Trash2, X } from 'lucide-react';
import { useDataMigration } from '@/hooks/useDataMigration';

export function DataMigrationDialog() {
  const {
    showMigrationDialog,
    setShowMigrationDialog,
    isMigrating,
    migrationProgress,
    migrateData,
    skipMigration,
    clearLocalData,
  } = useDataMigration();

  const handleMigrate = async () => {
    await migrateData();
    // Recarregar a página para atualizar os dados
    window.location.reload();
  };

  if (!showMigrationDialog) return null;

  return (
    <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Dados Locais Encontrados
          </DialogTitle>
          <DialogDescription>
            Encontramos decks e flashcards salvos no seu navegador. Você gostaria de migrar esses dados para o banco de dados na nuvem?
          </DialogDescription>
        </DialogHeader>

        {isMigrating ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Migrando seus dados...</p>
            </div>
            <Progress value={migrationProgress} className="w-full" />
            <p className="text-xs text-center text-muted-foreground">
              {Math.round(migrationProgress)}% concluído
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Vantagens da migração:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Seus dados ficarão seguros na nuvem</li>
                <li>• Acesso em qualquer dispositivo</li>
                <li>• Sincronização automática</li>
                <li>• Backup automático</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleMigrate}
                className="w-full gap-2"
                disabled={isMigrating}
              >
                <Database className="h-4 w-4" />
                Migrar para a Nuvem
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={skipMigration}
                  className="flex-1 gap-2"
                  disabled={isMigrating}
                >
                  <X className="h-4 w-4" />
                  Manter Local
                </Button>
                
                <Button 
                  variant="destructive"
                  onClick={clearLocalData}
                  className="flex-1 gap-2"
                  disabled={isMigrating}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Dados
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Esta ação só aparecerá uma vez. Escolha com cuidado.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

