import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const BadgeSchema = z.object({
  badges: z.array(
    z.object({
      type: z.enum(['revogado', 'vetado', 'informacoes']),
      resumo: z.string().describe('Frase objetiva em português explicando o que aconteceu com o dispositivo'),
    })
  ),
});

const BATCH_SIZE = 5;

async function processBatch(textos: string[]) {
  return Promise.all(
    textos.map(async (texto) => {
      try {
        const { object } = await generateObject({
          model: anthropic('claude-haiku-4-5-20251001'),
          schema: BadgeSchema,
          system: 'Você é especialista em legislação brasileira. Analise anotações legislativas com precisão. Seja objetivo e direto no resumo (máximo 1 frase).',
          prompt: `Analise as anotações legislativas ao final deste dispositivo jurídico brasileiro:

"${texto.slice(0, 600)}"

Regras de classificação:
- type "revogado": dispositivo foi revogado, suprimido ou retirado do ordenamento (ex: "Revogado pela Lei X", "Suprimido")
- type "vetado": dispositivo foi vetado pelo Executivo (ex: "VETADO", "Vetado")
- type "informacoes": qualquer outra anotação editorial (ex: Redação dada, Incluído, Vide, Vigência, Regulamento, Promulgação, Acrescentado, Alterado, Renumerado)

Se houver múltiplas anotações do mesmo tipo, agrupe em um único badge.
Se houver tipos diferentes, crie um badge para cada tipo.
No "resumo", cite a lei/decreto específico quando disponível.
SEMPRE retorne pelo menos um badge para qualquer anotação presente.`,
        });
        return { badges: object.badges };
      } catch (e) {
        console.error('[lei-badges] generateObject error:', e instanceof Error ? e.message : e);
        return { badges: [] };
      }
    })
  );
}

export async function POST(req: NextRequest) {
  const { textos }: { textos: string[] } = await req.json();

  if (!textos?.length) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 401 });
  }

  const results: { badges: { type: 'revogado' | 'vetado' | 'informacoes'; resumo: string }[] }[] = [];

  for (let i = 0; i < textos.length; i += BATCH_SIZE) {
    const batch = textos.slice(i, i + BATCH_SIZE);
    const batchResults = await processBatch(batch);
    results.push(...batchResults);
  }

  return NextResponse.json({ results });
}
