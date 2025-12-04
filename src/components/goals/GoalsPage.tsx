import { useState } from 'react';
import { GoalCreationDialog } from './GoalCreationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

/**
 * Página de gerenciamento de metas de estudo
 */
export function GoalsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Metas de Estudo</h1>
          <p className="text-gray-600 mt-1">
            Crie e gerencie suas metas com revisões inteligentes FSRS
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Meta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🎯 Suas Metas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            Você ainda não tem metas criadas.
            <br />
            Clique em "Nova Meta" para começar!
          </p>
        </CardContent>
      </Card>

      <GoalCreationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
