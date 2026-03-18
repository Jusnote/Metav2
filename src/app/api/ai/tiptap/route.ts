import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COMMAND_TEMPLATES: Record<string, (text: string) => string> = {
  explain: (text) =>
    `Explique de forma clara e didática o seguinte trecho legal. Destaque os elementos jurídicos importantes:\n\n"${text}"`,
  simplify: (text) =>
    `Reescreva o seguinte trecho legal em linguagem simples e acessível, mantendo o sentido jurídico:\n\n"${text}"`,
  summarize: (text) =>
    `Resuma o seguinte trecho legal em 2-3 frases curtas:\n\n"${text}"`,
  'key-points': (text) =>
    `Liste os pontos-chave e elementos jurídicos importantes do seguinte trecho:\n\n"${text}"`,
  'practical-example': (text) =>
    `Dê um ou dois exemplos práticos de como o seguinte dispositivo legal se aplica no dia a dia:\n\n"${text}"`,
};

const SYSTEM_PROMPT = `Você é um assistente jurídico especializado em legislação brasileira (Lei Seca).
Responda sempre em português brasileiro, de forma clara e didática.
Seja conciso mas completo. Use exemplos quando ajudar na compreensão.`;

export async function POST(req: NextRequest) {
  const { text, command, prompt } = await req.json();

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY.' },
      { status: 401 }
    );
  }

  // Build user prompt
  let userPrompt = '';

  if (command && text && COMMAND_TEMPLATES[command]) {
    userPrompt = COMMAND_TEMPLATES[command](text);
  } else if (prompt && text) {
    userPrompt = `Sobre o seguinte trecho legal:\n"${text}"\n\n${prompt}`;
  } else if (prompt) {
    userPrompt = prompt;
  } else {
    return NextResponse.json(
      { error: 'Missing prompt or command.' },
      { status: 400 }
    );
  }

  try {
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 2048,
    });

    return result.toTextStreamResponse();
  } catch {
    return NextResponse.json(
      { error: 'Falha ao processar requisição de IA.' },
      { status: 500 }
    );
  }
}
