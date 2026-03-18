import type { NextRequest } from 'next/server';

import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Você é um tutor jurídico inteligente integrado a um sistema de estudo. Seu papel é ajudar o estudante a melhorar seu desempenho em tópicos jurídicos específicos.

Você receberá contexto sobre:
- O tópico/subtópico que o estudante está revisando
- Histórico de revisões (datas e percentuais de acerto)
- Tempo investido no estudo
- Nível de proficiência atual

Com base nessas informações:
1. Dê dicas específicas e acionáveis sobre o que estudar
2. Identifique padrões de erro e sugira estratégias de melhoria
3. Responda perguntas sobre o conteúdo jurídico do tópico
4. Sugira exercícios práticos quando solicitado
5. Seja conciso e direto - o estudante está em modo de estudo

Responda sempre em português brasileiro. Use linguagem clara e acessível.
Não use markdown excessivo - prefira parágrafos curtos e listas quando necessário.`;

export async function POST(req: NextRequest) {
  const { messages, context } = await req.json();

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY.' },
      { status: 401 }
    );
  }

  const contextPrompt = context
    ? `\n\nContexto do estudo atual:\n- Tópico: ${context.topicTitle || 'N/A'}\n- Subtópico: ${context.subtopicTitle || 'N/A'}\n- Nível: ${context.level || 'N/A'}\n- Último acesso: ${context.lastAccess || 'N/A'}\n- Tempo investido: ${context.timeInvested || 'N/A'}\n- Histórico de revisões: ${context.reviews || 'Nenhum'}`
    : '';

  try {
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT + contextPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      maxOutputTokens: 1024,
      temperature: 0.7,
    });

    return result.toDataStreamResponse();
  } catch {
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
