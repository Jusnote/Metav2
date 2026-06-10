import '@/views/questoes-paper-bg.css';

/**
 * Aurora background — receita "Grafite 2B": wash cinza neutro concentrado no topo
 * (logo abaixo da navbar), morrendo em transparente sobre o corpo cinza TEC
 * (.questoes-paper-bg #F0F0F0). Layer fixo (-z-10).
 *
 * Estilo vive em .questoes-aurora (questoes-paper-bg.css) — com variante .dark.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="questoes-aurora pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    />
  );
}
