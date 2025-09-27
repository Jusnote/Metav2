import React from 'react';

interface AnimatedBackgroundProps {
  className?: string;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none z-0 ${className}`}>
      {/* Study-related SVG elements with different sizes, colors, and animation speeds */}
      
      {/* Book icons */}
      <div className="absolute top-10 left-10 w-8 h-8 opacity-20 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
          <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/>
        </svg>
      </div>
      
      {/* Light bulb icons */}
      <div className="absolute top-20 right-20 w-10 h-10 opacity-25 animate-float-medium">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
          <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
        </svg>
      </div>
      
      {/* Brain icons */}
      <div className="absolute top-32 left-1/4 w-6 h-6 opacity-30 animate-float-fast">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-purple-400">
          <path d="M21.33 12.91c.09-.09.15-.2.15-.33 0-.12-.06-.23-.15-.32-.09-.09-.2-.15-.33-.15-.12 0-.23.06-.32.15l-1.5 1.5c-.09.09-.15.2-.15.33 0 .12.06.23.15.32.09.09.2.15.32.15.13 0 .24-.06.33-.15l1.5-1.5zm-18.66 0c-.09-.09-.15-.2-.15-.33 0-.12.06-.23.15-.32.09-.09.2-.15.33-.15.12 0 .23.06.32.15l1.5 1.5c.09.09.15.2.15.33 0 .12-.06.23-.15.32-.09.09-.2.15-.32.15-.13 0-.24-.06-.33-.15l-1.5-1.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
        </svg>
      </div>
      
      {/* Graduation cap icons */}
      <div className="absolute top-40 right-1/3 w-9 h-9 opacity-20 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-green-400">
          <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
        </svg>
      </div>
      
      {/* Pencil icons */}
      <div className="absolute top-60 left-1/2 w-7 h-7 opacity-35 animate-float-medium">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-orange-400">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </div>
      
      {/* Target/Focus icons */}
      <div className="absolute top-80 right-10 w-8 h-8 opacity-25 animate-float-fast">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </div>
      
      {/* Clock/Time icons */}
      <div className="absolute top-96 left-20 w-6 h-6 opacity-30 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-indigo-400">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
      </div>
      
      {/* Star/Achievement icons */}
      <div className="absolute bottom-20 right-1/4 w-10 h-10 opacity-20 animate-float-medium">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      </div>
      
      {/* Calculator icons */}
      <div className="absolute bottom-32 left-1/3 w-7 h-7 opacity-35 animate-float-fast">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-teal-400">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H6v-2h8v2zm3-4H6v-2h11v2zm0-4H6V7h11v2z"/>
        </svg>
      </div>
      
      {/* More study elements */}
      <div className="absolute bottom-40 right-20 w-8 h-8 opacity-25 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-cyan-400">
          <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1z"/>
        </svg>
      </div>
      
      <div className="absolute bottom-60 left-10 w-9 h-9 opacity-30 animate-float-medium">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-pink-400">
          <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
        </svg>
      </div>
      
      <div className="absolute bottom-80 right-1/2 w-6 h-6 opacity-20 animate-float-fast">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-emerald-400">
          <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
        </svg>
      </div>
      
      <div className="absolute top-1/4 left-3/4 w-7 h-7 opacity-25 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-violet-400">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </div>
      
      <div className="absolute top-1/3 right-1/4 w-8 h-8 opacity-35 animate-float-medium">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-rose-400">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </div>
      
      <div className="absolute top-2/3 left-1/4 w-9 h-9 opacity-20 animate-float-fast">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
      </div>
      
      <div className="absolute bottom-1/4 right-3/4 w-6 h-6 opacity-30 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-lime-400">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      </div>
      
      <div className="absolute bottom-1/3 left-3/4 w-8 h-8 opacity-25 animate-float-medium">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-sky-400">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H6v-2h8v2zm3-4H6v-2h11v2zm0-4H6V7h11v2z"/>
        </svg>
      </div>
      
      <div className="absolute top-1/2 right-1/3 w-7 h-7 opacity-35 animate-float-fast">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-fuchsia-400">
          <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1z"/>
        </svg>
      </div>
      
      <div className="absolute top-3/4 left-1/2 w-10 h-10 opacity-20 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
          <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
        </svg>
      </div>
      
      <div className="absolute bottom-1/2 right-2/3 w-6 h-6 opacity-30 animate-float-medium">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400">
          <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
        </svg>
      </div>
      
      <div className="absolute top-16 left-2/3 w-8 h-8 opacity-25 animate-float-fast">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-neutral-400">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </div>
      
      <div className="absolute bottom-16 right-1/3 w-7 h-7 opacity-35 animate-float-slow">
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-stone-400">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </div>
    </div>
  );
};

export default AnimatedBackground;