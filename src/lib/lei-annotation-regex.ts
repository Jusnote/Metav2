// src/lib/lei-annotation-regex.ts
// Expanded annotation regex covering ALL known patterns from Planalto and JusBrasil.
// Shared between both pipelines (copy/paste and GraphQL).

import type { AnnotationType } from '@/types/lei-import';

/**
 * Matches legislative annotations like:
 * (Redacao dada pela Lei...), (Incluido pela...), (Revogado pela...),
 * (Regulamento), (Producao de efeito), (Vigencia), etc.
 */
export const RE_ANOTACAO_V2 =
  /\((?:Reda[çc][ãa]o\s+dad|Inclu[ií]d|Revogad|Vide\s|Vig[eê]ncia|Acrescid|Alterad|VETAD|Suprimi|Renumerad|Regulamento|Regulamenta[çc][ãa]o|Produ[çc][ãa]o\s+de\s+efeito|Promulga[çc][ãa]o|Texto\s+compilad|Convers[ãa]o\s+d|Declara[çc][ãa]o|Declarad|Norma\s+anterior|Publica[çc][ãa]o\s+original|Mensagem\s+de\s+veto|Refer[eê]ncia)[^)]*\)/gi;

/**
 * Matches the article number pattern tolerantly.
 * Handles: Art. 1o, Art 1.636., Art. 121-A, Art. 2.046
 */
export const RE_ARTIGO_TOLERANT =
  /^\s*Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)\s*\.?\s*[.\-–—]?\s*(.*)/i;

/**
 * Matches any parenthetical longer than 20 chars in clean text.
 * Used as safety check to detect annotations the main regex missed.
 */
export const RE_PARENTHETICAL_SUSPECT =
  /\([^)]{20,}\)/g;

/**
 * Classifies an annotation text into a structured type.
 */
export function classifyAnnotation(text: string): AnnotationType {
  const t = text.toLowerCase();
  if (t.includes('reda') && t.includes('dad')) return 'redacao';
  if (t.includes('inclu')) return 'inclusao';
  if (t.includes('revogad')) return 'revogacao';
  if (t.includes('vigência') || t.includes('vigencia')) return 'vigencia';
  if (t.includes('vide')) return 'vide';
  if (t.includes('regulament')) return 'regulamento';
  if (t.includes('produ') && t.includes('efeito')) return 'producao_efeito';
  if (t.includes('vetad')) return 'veto';
  return 'outro';
}

/**
 * Extracts a referenced law number from annotation text.
 * E.g., "(Redacao dada pela Lei no 13.968, de 2019)" -> "13968/2019"
 */
export function extractLeiReferenciada(text: string): string | null {
  const match = text.match(/Lei\s+(?:n[ºo°]?\s*)?(\d+[\.\d]*)\s*(?:,\s*de\s+|\s*\/\s*)(\d{4})/i);
  if (match) {
    const numero = match[1].replace(/\./g, '');
    return `${numero}/${match[2]}`;
  }
  return null;
}

/**
 * Separates annotations from text. Returns clean text + extracted annotations.
 */
export function separateAnnotations(text: string): {
  textoLimpo: string;
  anotacoes: string[];
  textoOriginal: string;
} {
  const textoOriginal = text;
  const anotacoes: string[] = [];

  let textoLimpo = text.replace(RE_ANOTACAO_V2, (match) => {
    anotacoes.push(match.trim());
    return '';
  });

  textoLimpo = textoLimpo.replace(/\s{2,}/g, ' ').trim();
  textoLimpo = textoLimpo.replace(/\s*[,;]\s*$/, '').trim();

  return { textoLimpo, anotacoes, textoOriginal };
}
