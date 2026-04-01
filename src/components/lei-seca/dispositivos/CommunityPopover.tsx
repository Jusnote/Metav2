'use client';

import { useEffect, useRef } from 'react';

interface CommunityPopoverProps {
  breakdown: Record<string, number>;
  onClose: () => void;
}

export function CommunityPopover({ breakdown, onClose }: CommunityPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div
      ref={ref}
      className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 flex gap-1 items-center bg-white border border-[#eee] rounded-[14px] px-[10px] py-2 z-20 whitespace-nowrap"
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.03)',
        animation: 'commPopUp 0.15s ease-out',
      }}
    >
      <style>{`@keyframes commPopUp { from { opacity:0; transform:translateX(-50%) translateY(4px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
      {sorted.map(([emoji, count]) => (
        <div key={emoji} className="flex items-center gap-[3px] px-2 py-[3px] rounded-lg text-[13px] font-[Inter,sans-serif] transition-colors hover:bg-[#f8f8f7]">
          {emoji} <span className="text-[10px] text-[#999] font-semibold">{count}</span>
        </div>
      ))}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-white" />
    </div>
  );
}
