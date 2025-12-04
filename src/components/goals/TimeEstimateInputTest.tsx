import React, { useState } from 'react';
import { TimeEstimateInput } from './TimeEstimateInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Componente de teste para TimeEstimateInput
 * Para testar: Adicione este componente em alguma rota temporária
 */
export function TimeEstimateInputTest() {
  const [topicDuration, setTopicDuration] = useState(120);
  const [subtopicDuration, setSubtopicDuration] = useState(90);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Teste: TimeEstimateInput</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Teste 1: Tópico */}
        <Card>
          <CardHeader>
            <CardTitle>Tópico</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeEstimateInput
              value={topicDuration}
              onChange={setTopicDuration}
              label="Tempo estimado do tópico"
            />
          </CardContent>
        </Card>

        {/* Teste 2: Subtópico */}
        <Card>
          <CardHeader>
            <CardTitle>Subtópico</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeEstimateInput
              value={subtopicDuration}
              onChange={setSubtopicDuration}
              label="Tempo estimado do subtópico"
            />
          </CardContent>
        </Card>

        {/* Teste 3: Disabled */}
        <Card>
          <CardHeader>
            <CardTitle>Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeEstimateInput
              value={60}
              onChange={() => {}}
              label="Desabilitado"
              disabled
            />
          </CardContent>
        </Card>

        {/* Teste 4: Com erro */}
        <Card>
          <CardHeader>
            <CardTitle>Com Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeEstimateInput
              value={30}
              onChange={() => {}}
              label="Com mensagem de erro"
              error="O tempo mínimo é 45 minutos"
            />
          </CardContent>
        </Card>
      </div>

      {/* Valores atuais */}
      <Card>
        <CardHeader>
          <CardTitle>Valores Atuais (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md text-sm">
            {JSON.stringify(
              {
                topicDuration,
                subtopicDuration,
              },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
