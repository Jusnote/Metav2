export function SoftGlowSeparator({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: '1px',
        alignSelf: 'stretch',
        position: 'relative',
        background: 'linear-gradient(180deg, transparent 5%, #dbeafe 30%, #93c5fd 50%, #dbeafe 70%, transparent 95%)',
        opacity: 0.6,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: -4,
          width: 9,
          height: '100%',
          background: 'linear-gradient(180deg, transparent 5%, rgba(59,130,246,0.04) 30%, rgba(59,130,246,0.06) 50%, rgba(59,130,246,0.04) 70%, transparent 95%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
