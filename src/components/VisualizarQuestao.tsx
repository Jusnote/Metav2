import React from 'react';
import { QuestaoCompleta } from '@/hooks/useQuestoes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

interface VisualizarQuestaoProps {
  questao: QuestaoCompleta;
  onClose: () => void;
}

export const VisualizarQuestao: React.FC<VisualizarQuestaoProps> = ({
  questao,
  onClose,
}) => {
  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{questao.titulo}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 mt-2">
            {questao.disciplina && (
              <Badge variant="outline" className="bg-primary/10">
                {questao.disciplina}
              </Badge>
            )}
            {questao.assunto && (
              <Badge variant="outline">
                {questao.assunto}
              </Badge>
            )}
            {questao.banca && (
              <Badge variant="outline">
                {questao.banca}
              </Badge>
            )}
            {questao.cargo && (
              <Badge variant="outline">
                {questao.cargo}
              </Badge>
            )}
            <Badge variant={questao.nivel === 'Fácil' ? 'outline' : questao.nivel === 'Médio' ? 'secondary' : 'destructive'}>
              {questao.nivel}
            </Badge>
            <Badge variant="outline">
              {questao.tipo === 'multipla_escolha'
                ? 'Múltipla Escolha'
                : questao.tipo === 'verdadeiro_falso'
                ? 'Verdadeiro/Falso'
                : 'Dissertativa'}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="bg-muted/30 p-4 rounded-md">
            <p className="whitespace-pre-line">{questao.enunciado}</p>
          </div>

          {questao.tipo === 'multipla_escolha' && questao.alternativas.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Alternativas:</h3>
              {questao.alternativas
                .sort((a, b) => a.letra.localeCompare(b.letra))
                .map((alternativa) => (
                  <div
                    key={alternativa.id}
                    className={`p-3 rounded-md flex items-start gap-2 ${
                      alternativa.correta ? 'bg-green-50 border border-green-200' : 'bg-muted/20'
                    }`}
                  >
                    {alternativa.correta ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold mr-2">{alternativa.letra})</span>
                      <span>{alternativa.texto}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p>Criada em: {new Date(questao.created_at).getFullYear()}</p>
            <p>Última atualização: {new Date(questao.updated_at).toLocaleString()}</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

