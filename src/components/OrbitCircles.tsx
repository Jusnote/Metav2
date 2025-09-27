import React from 'react';

const OrbitCircles = () => {
  return (
    <div className="orbit-base absolute inset-0 pointer-events-none -z-10 flex items-center justify-center" style={{ top: '120px' }}>
      {/* círculo principal */}
      <svg className="orbit-base__svg-circle orbit-base__svg-circle--1 absolute w-[600px] h-[600px]" 
           viewBox="0 0 600 600" 
           fill="none">
        <circle cx="300" cy="300" r="299.375" stroke="url(#circleGradient)" strokeWidth="1.25"></circle>
        <defs>
          <linearGradient id="circleGradient" x1="300" y1="0" x2="299.792" y2="700.355">
            <stop offset="0" stopColor="white"/>
            <stop offset="1" stopColor="white" stopOpacity="0.26"/>
          </linearGradient>
        </defs>
      </svg>

      {/* outros círculos concêntricos estáticos */}
      <svg className="orbit-base__svg-circle orbit-base__svg-circle--2 absolute w-[480px] h-[480px]" 
           viewBox="0 0 480 480" 
           fill="none">
        <circle cx="240" cy="240" r="239.375" stroke="url(#circleGradient2)" strokeWidth="1.25"></circle>
        <defs>
          <linearGradient id="circleGradient2" x1="240" y1="0" x2="239.792" y2="580.355">
            <stop offset="0" stopColor="white" stopOpacity="0.8"/>
            <stop offset="1" stopColor="white" stopOpacity="0.2"/>
          </linearGradient>
        </defs>
      </svg>
      
      <svg className="orbit-base__svg-circle orbit-base__svg-circle--3 absolute w-[360px] h-[360px]" 
           viewBox="0 0 360 360" 
           fill="none">
        <circle cx="180" cy="180" r="179.375" stroke="url(#circleGradient3)" strokeWidth="1.25"></circle>
        <defs>
          <linearGradient id="circleGradient3" x1="180" y1="0" x2="179.792" y2="460.355">
            <stop offset="0" stopColor="white" stopOpacity="0.6"/>
            <stop offset="1" stopColor="white" stopOpacity="0.1"/>
          </linearGradient>
        </defs>
      </svg>

      {/* ícones estáticos posicionados ao redor */}
      <div className="orbit-base__img orbit-base__img--1 absolute w-8 h-8" 
           style={{ top: '15%', left: '50%', transform: 'translateX(-50%)' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="4" fill="white" opacity="0.8"/>
        </svg>
      </div>
      
      <div className="orbit-base__img orbit-base__img--2 absolute w-3 h-3" 
           style={{ bottom: '15%', left: '50%', transform: 'translateX(-50%)' }}>
        <div className="w-full h-full bg-white opacity-60 rounded-full"></div>
      </div>
      
      <div className="orbit-base__img orbit-base__img--3 absolute w-2 h-2" 
           style={{ top: '50%', right: '15%', transform: 'translateY(-50%)' }}>
        <div className="w-full h-full bg-white opacity-40 rounded-full"></div>
      </div>
      
      <div className="orbit-base__img orbit-base__img--4 absolute w-2 h-2" 
           style={{ top: '50%', left: '15%', transform: 'translateY(-50%)' }}>
        <div className="w-full h-full bg-white opacity-50 rounded-full"></div>
      </div>

      {/* Pontinhos piscantes orbitando */}
      <div className="absolute w-[600px] h-[600px] animate-spin" style={{ animationDuration: '20s' }}>
        <div className="absolute w-2 h-2 bg-white rounded-full animate-pulse" 
             style={{ top: '10px', left: '50%', transform: 'translateX(-50%)', opacity: '0.7' }}></div>
      </div>
      
      <div className="absolute w-[480px] h-[480px] animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }}>
        <div className="absolute w-1.5 h-1.5 bg-white rounded-full animate-pulse" 
             style={{ bottom: '10px', right: '30%', opacity: '0.6', animationDelay: '1s' }}></div>
      </div>
    </div>
  );
};

export default OrbitCircles;