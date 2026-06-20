/**
 * Aurora background — wash azul concentrado só no topo (logo abaixo da
 * navbar), fade rápido pra branco. Layer fixo (-z-10).
 *
 * Para wash mais alto: aumentar o `35%` (posição do branco sólido).
 * Para wash mais saturado: aumentar o `0.18` do azul no topo.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        // "Luz de estúdio" (fórmula aprovada: clara + fio abaixo + F4) — azul antigo em comentário:
        // 'linear-gradient(180deg, rgba(59,130,246,0.18) 0%, rgba(99,165,250,0.10) 10%, rgba(255,255,255,0) 25%, #ffffff 35%)'
        background:
          'radial-gradient(1000px 560px at 50% -160px, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 75%), radial-gradient(700px 480px at 6% -40px, rgba(60,64,70,0.11) 0%, rgba(60,64,70,0) 68%), radial-gradient(700px 480px at 94% -40px, rgba(60,64,70,0.11) 0%, rgba(60,64,70,0) 68%), #EFF0F1',
      }}
    />
  );
}
