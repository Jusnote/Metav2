import React, { useState } from "react";
import { useQuestoes } from "@/hooks/useQuestoes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, Clock, Bookmark } from "lucide-react";
import { VisualizarQuestao } from "@/components/VisualizarQuestao";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const ListaQuestoes: React.FC = () => {
  const { questoes, loading, error, deleteQuestao } = useQuestoes();
  const [selectedQuestao, setSelectedQuestao] = useState<any | null>(null);
  const [respostasSelecionadas, setRespostasSelecionadas] = useState<{[key: string]: string}>({});

  const getStatusIcon = (status: string) => {
    // Implementar lógica de status se houver
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const selecionarResposta = (questaoId: string, alternativa: string) => {
    setRespostasSelecionadas({
      ...respostasSelecionadas,
      [questaoId]: alternativa
    });
  };

  if (loading) {
    return <div className="text-center py-8">Carregando questões...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">Erro: {error}</div>;
  }

  if (questoes.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhuma questão encontrada. Crie sua primeira questão!</div>;
  }

  return (
    <div className="space-y-6">
      {questoes.map((questao) => (
        <Card key={questao.id} className="group hover:shadow-xl transition-all duration-300 bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/30 overflow-hidden">
          <CardHeader className="pb-3 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/30"></div>
            
            <div className="flex justify-between items-start pt-2">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs bg-muted/50">
                    {questao.id.substring(0, 8).toUpperCase()}
                  </Badge>
                  {getStatusIcon("nao-resolvida")}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-primary">
                    {questao.titulo}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {questao.disciplina} {questao.assunto && `• ${questao.assunto}`}
                  </div>
                </div>
              </div>
              
              <div className="text-right space-y-2">
                <Badge 
                  variant={questao.nivel === "Fácil" ? "secondary" : questao.nivel === "Médio" ? "default" : "destructive"}
                  className="text-xs"
                >
                  {questao.nivel}
                </Badge>
                <div className="text-xs text-muted-foreground space-y-1">
                  {questao.banca && questao.cargo && (
                    <p>{questao.banca} - {questao.cargo}</p>
                  )}
                  {questao.ano && (
                    <p>{questao.ano}</p>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-5">
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground leading-relaxed font-medium">
                {questao.enunciado}
              </p>
            </div>
            
            {questao.tipo === "multipla_escolha" && questao.alternativas && questao.alternativas.length > 0 && (
              <div className="space-y-3">
                {questao.alternativas.sort((a, b) => a.letra.localeCompare(b.letra)).map((alternativa) => (
                  <div 
                    key={alternativa.id} 
                    className={`group/alt p-3 rounded-lg border border-border/50 cursor-pointer transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 ${
                      respostasSelecionadas[questao.id] === alternativa.letra 
                        ? "border-primary bg-primary/10 shadow-sm" 
                        : ""
                    }`}
                    onClick={() => selecionarResposta(questao.id, alternativa.letra)}
                  >
                    <Label 
                      htmlFor={`${questao.id}-${alternativa.letra}`}
                      className="flex items-start gap-3 cursor-pointer w-full"
                    >
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Checkbox
                          id={`${questao.id}-${alternativa.letra}`}
                          checked={respostasSelecionadas[questao.id] === alternativa.letra}
                          onCheckedChange={() => selecionarResposta(questao.id, alternativa.letra)}
                          className="mt-0.5"
                        />
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-colors ${
                          respostasSelecionadas[questao.id] === alternativa.letra
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border group-hover/alt:border-primary/50"
                        }`}>
                          {alternativa.letra}
                        </div>
                      </div>
                      <span className="text-sm leading-relaxed flex-1 pt-1">
                        {alternativa.texto}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t border-border/50">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                <Bookmark className="h-4 w-4" />
                Adicionar ao Caderno
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => deleteQuestao(questao.id)}>
                  Excluir
                </Button>
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary-hover shadow-md">
                  <CheckCircle className="h-4 w-4" />
                  Responder
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {selectedQuestao && (
        <VisualizarQuestao
          questao={selectedQuestao}
          onClose={() => setSelectedQuestao(null)}
        />
      )}
    </div>
  );
};

