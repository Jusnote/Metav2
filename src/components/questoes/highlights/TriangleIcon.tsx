import React from 'react';

export function TriangleIcon({ color, size = 13, className }: { color: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ color, display: 'block' }} aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" fill="currentColor" />
      <path d="M12 9.1v3.9" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="16.7" r="1.05" fill="#fff" />
    </svg>
  );
}
