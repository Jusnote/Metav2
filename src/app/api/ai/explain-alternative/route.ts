import type { NextRequest } from 'next/server';

import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Você é um professor experiente de direito para concursos públicos. Sua tarefa é explicar POR QUE uma alternativa está correta ou incorreta, com profundidade suficiente para o aluno realmente aprender.

Formato OBRIGATÓRIO (duas partes separadas por uma linha em branco):

PARTE 1 — RESUMO (uma única linha, sem quebra):
Comece com "Correta." ou "Incorreta." seguido de uma frase-resumo objetiva com o fundamento principal (máximo 20 palavras). Exemplo: "Correta. A ameaça é crime de ação penal pública condicionada à representação, conforme art. 147, parágrafo único, do CP."

PARTE 2 — EXPLICAÇÃO (parágrafo após linha em branco):
Desenvolva em 3-5 frases com:
- O fundamento legal ESPECÍFICO (artigo, parágrafo, inciso, súmula, jurisprudência).
- Se incorreta: explique qual é o ERRO da alternativa e qual seria a afirmação correta.
- Se correta: explique a lógica jurídica e por que as outras interpretações seriam equivocadas.
- Mencione pegadinhas comuns de banca quando relevante.

Regras:
- NÃO use markdown, bullet points, negrito ou formatação. Apenas texto corrido.
- NÃO repita o texto da alternativa literalmente.
- Seja técnico e preciso — o aluno está se preparando para concurso.
- Responda em português brasileiro.`;

export async function POST(req: NextRequest) {
  const { questionText, alternativeText, alternativeLetter, isCorrect, subject, subtopic } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing ANTHROPIC_API_KEY.' },
      { status: 401 }
    );
  }

  const prompt = `Matéria: ${subject || 'N/A'}
Assunto: ${subtopic || 'N/A'}

Enunciado da questão:
${questionText}

Alternativa ${alternativeLetter}) ${alternativeText}
Esta alternativa é ${isCorrect ? 'CORRETA' : 'INCORRETA'}.

Explique com fundamento legal.`;

  try {
    const result = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 1024,
      temperature: 0.3,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch {
          const errorMsg = '\n\n[Explicacao interrompida. Tente novamente.]';
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
