// src/data/carreiras-mock.ts
//
// Dados temporários da Fase 1A. Na Fase 1B, `useCarreiras` troca a fonte
// pra Supabase e este arquivo pode ser deletado ou mantido como seed.
//
// foto_url = null pra usar o fallback (gradiente + sigla). Se quiser
// testar com imagens reais, troque por URLs Unsplash (ex:
// https://images.unsplash.com/photo-XXXX?w=400&h=400&fit=crop&auto=format&q=80).

import type { Carreira } from '@/types/carreira';

const now = new Date().toISOString();

export const MOCK_CARREIRAS: Carreira[] = [
  // ─── Advocacia ──────────────────────────────────────────────
  { id: 'mock-oab',           area: 'advocacia',   nome: 'OAB · Exame de Ordem', slug: 'oab-exame',    foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },

  // ─── Policial ───────────────────────────────────────────────
  { id: 'mock-pf-agente',     area: 'policial',    nome: 'PF · Agente',        slug: 'pf-agente',     foto_url: 'https://concursos.adv.br/wp-content/uploads/2022/05/Concurso-Agente-da-Policia-Federal.jpeg', ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pf-escrivao',   area: 'policial',    nome: 'PF · Escrivão',      slug: 'pf-escrivao',   foto_url: 'https://www.sociedademilitar.com.br/wp-content/uploads/2024/06/escrivao-pf.jpeg', ordem: 2,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pf-delegado',   area: 'policial',    nome: 'PF · Delegado',      slug: 'pf-delegado',   foto_url: 'https://midias.diariodepernambuco.com.br/static/app/noticia_127983242361/2023/01/23/918946/20230123132158812447u.jpeg', ordem: 3,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-prf',           area: 'policial',    nome: 'PRF · Policial',     slug: 'prf-policial',  foto_url: 'https://dhg1h5j42swfq.cloudfront.net/2024/05/13132132/concurso-prf-foto-gov.webp', ordem: 4,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pc-sp-invest',  area: 'policial',    nome: 'PC-SP · Investigador', slug: 'pc-sp-investigador', foto_url: 'https://www.sociedademilitar.com.br/wp-content/uploads/2023/10/pc-sp-concurso.jpg', ordem: 5,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pc-rj-inspet',  area: 'policial',    nome: 'PC-RJ · Inspetor',   slug: 'pc-rj-inspetor', foto_url: 'https://jcconcursos.com.br/media/uploads/noticia/concurso-pc-rj-1.jpg', ordem: 6,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-depen',         area: 'policial',    nome: 'DEPEN · Agente',     slug: 'depen-agente',  foto_url: 'https://www.gov.br/senappen/pt-br/assuntos/noticias/depen-encerra-o-ano-com-participacoes-importantes-em-acoes-de-combate-ao-crime-organizado-e-apoio-as-unidades-federativas/spf-depen.jpeg', ordem: 7,  ativa: true, created_at: now, updated_at: now },

  // ─── Fiscal ─────────────────────────────────────────────────
  { id: 'mock-afrfb',         area: 'fiscal',      nome: 'RFB · Auditor',      slug: 'rfb-auditor',   foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-tcu-aud',       area: 'fiscal',      nome: 'TCU · Auditor',      slug: 'tcu-auditor',   foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-icms-sp',       area: 'fiscal',      nome: 'ICMS-SP · AFT',      slug: 'icms-sp-aft',   foto_url: null, ordem: 3,  ativa: true, created_at: now, updated_at: now },

  // ─── Jurídica ───────────────────────────────────────────────
  { id: 'mock-mp-fed',        area: 'juridica',    nome: 'MPF · Procurador',   slug: 'mpf-procurador', foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-def-pub',       area: 'juridica',    nome: 'Defensoria · Defensor', slug: 'def-defensor', foto_url: null, ordem: 3,  ativa: true, created_at: now, updated_at: now },

  // ─── Tribunais ──────────────────────────────────────────────
  { id: 'mock-trt-tec',       area: 'tribunais',   nome: 'TRT · Técnico',      slug: 'trt-tecnico',   foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-tre-anal',      area: 'tribunais',   nome: 'TRE · Analista',     slug: 'tre-analista',  foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },

  // ─── Saúde ──────────────────────────────────────────────────
  { id: 'mock-enf-mun',       area: 'saude',       nome: 'Prefeitura · Enfermeiro', slug: 'pref-enfermeiro', foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },

  // ─── Controle ───────────────────────────────────────────────
  { id: 'mock-cgu',           area: 'controle',    nome: 'CGU · Analista',     slug: 'cgu-analista',  foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },

  // ─── Bancária ───────────────────────────────────────────────
  { id: 'mock-bb',            area: 'bancaria',    nome: 'BB · Escriturário',  slug: 'bb-escriturario', foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-caixa',         area: 'bancaria',    nome: 'Caixa · Técnico',    slug: 'caixa-tecnico', foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },
];
