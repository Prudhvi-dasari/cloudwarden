import { useState, useEffect } from 'react';
import { detectClientGeo } from '../lib/geo';

const CLEAN_LOCAL_FLAGS = {
  IN: '/images/flags/in_clean.png',
  US: '/images/flags/us_clean.png',
  GB: '/images/flags/gb_clean.png',
  UK: '/images/flags/gb_clean.png',
  AE: '/images/flags/ae_clean.png',
  DE: '/images/flags/de_clean.png',
};

export default function CloudTransferAnimation() {
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    detectClientGeo().then((info) => {
      if (info) setGeo(info);
    });
  }, []);

  const activeCc = geo?.countryCode ? geo.countryCode.toUpperCase() : '';

  // Dynamic clean flag image URL (pure flag cloth with no dark frame)
  const getFlagUrl = (cc) => {
    if (CLEAN_LOCAL_FLAGS[cc]) {
      return CLEAN_LOCAL_FLAGS[cc];
    }
    return `https://flagcdn.com/w320/${cc.toLowerCase()}.png`;
  };

  const currentFlagUrl = getFlagUrl(activeCc);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 select-none">
      
      {/* =========================================================================
          SVG FIBER OPTIC CABLES & LASER PULSES ACROSS 3D DATACENTER BUILDINGS
          ========================================================================= */}
      <svg
        className="absolute inset-0 w-full h-full opacity-60 sm:opacity-90"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="wireLaser" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.95" />
          </linearGradient>

          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Wire 1: Left Server Tower -> Central Hub */}
        <path
          d="M 180 380 C 220 360, 260 300, 280 260 C 340 250, 440 180, 500 160"
          fill="none"
          stroke="rgba(56, 189, 248, 0.18)"
          strokeWidth="2"
        />
        <path
          d="M 180 380 C 220 360, 260 300, 280 260 C 340 250, 440 180, 500 160"
          fill="none"
          stroke="url(#wireLaser)"
          strokeWidth="2.5"
          strokeDasharray="20 120"
          filter="url(#neonGlow)"
          style={{ animation: 'wirePulse 2.8s linear infinite' }}
        />

        {/* Wire 2: Bottom horizontal cable bridge */}
        <path
          d="M 320 460 C 380 475, 420 480, 500 480 C 580 480, 620 475, 680 460"
          fill="none"
          stroke="rgba(99, 102, 241, 0.18)"
          strokeWidth="2"
        />
        <path
          d="M 320 460 C 380 475, 420 480, 500 480 C 580 480, 620 475, 680 460"
          fill="none"
          stroke="url(#wireLaser)"
          strokeWidth="2.5"
          strokeDasharray="24 140"
          filter="url(#neonGlow)"
          style={{ animation: 'wirePulseReverse 3.2s linear infinite' }}
        />

        {/* Wire 3: Central Hub -> Right Datacenter */}
        <path
          d="M 500 160 C 560 180, 620 220, 640 260 C 690 280, 750 340, 780 370"
          fill="none"
          stroke="rgba(34, 197, 94, 0.18)"
          strokeWidth="2"
        />
        <path
          d="M 500 160 C 560 180, 620 220, 640 260 C 690 280, 750 340, 780 370"
          fill="none"
          stroke="url(#wireLaser)"
          strokeWidth="2.5"
          strokeDasharray="20 130"
          filter="url(#neonGlow)"
          style={{ animation: 'wirePulse 3s linear infinite' }}
        />
      </svg>

      {/* =========================================================================
          RESPONSIVE FLAGPOLE & NATIONAL FLAG (DESKTOP & MOBILE OPTIMIZED)
          - On mobile: scaled to 44x30px with safe screen-edge padding, never cut off
          - On desktop: calibrated to roof edge height with zero shield overlap
          ========================================================================= */}
      <div 
        className="absolute top-3 sm:top-[8%] md:top-[11%] right-3 sm:right-[10%] md:right-[14%] lg:right-[16%] z-10 pointer-events-none flex items-start"
      >
        {/* --- Sleek Chrome Flagpole --- */}
        <div className="flex flex-col items-center shrink-0 relative z-30">
          {/* Polished Gold Finial Orb */}
          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-md border border-amber-100/80" />
          
          {/* Top Swivel Ring */}
          <div className="w-1.5 sm:w-2 md:w-2.5 h-0.5 bg-slate-200 rounded-full mt-0.5 shadow-2xs" />

          {/* Chrome Mast Shaft */}
          <div className="w-0.5 sm:w-1 md:w-1.5 h-12 sm:h-18 md:h-22 bg-gradient-to-r from-slate-400 via-white to-slate-400 shadow-sm" />
          
          {/* Small Rooftop Anchor Base */}
          <div className="w-2 sm:w-2.5 md:w-3 h-0.5 sm:h-1 bg-slate-500 rounded-sm -mt-0.5 shadow-xs" />
        </div>

        {/* --- Waving Flag Cloth Locked Directly Beside Pole Hoist --- */}
        <div className="relative -ml-[1px] mt-0.5 sm:mt-1 overflow-visible">
          <div 
            className="w-[44px] h-[30px] sm:w-[58px] sm:h-[39px] md:w-[72px] md:h-[48px] relative rounded-r-xs overflow-hidden shadow-lg"
            style={{
              transformOrigin: 'left center',
              animation: 'flagClothWave 3.2s ease-in-out infinite',
            }}
          >
            <img 
              src={currentFlagUrl} 
              alt={`${activeCc} Flag`} 
              className="w-full h-full object-cover select-none pointer-events-none"
              onError={(e) => {
                if (e.target.src !== '/images/flags/in_clean.png') {
                  e.target.src = '/images/flags/in_clean.png';
                }
              }}
            />

            {/* Dynamic Fabric Wave Shading / Reflection Overlay */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-55"
              style={{
                background: 'linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0.45) 25%, rgba(0,0,0,0.3) 50%, rgba(255,255,255,0.45) 75%, rgba(0,0,0,0.2) 100%)',
                backgroundSize: '200% 100%',
                animation: 'clothRipple 3.2s linear infinite',
                mixBlendMode: 'overlay',
              }}
            />
          </div>
        </div>

      </div>

    </div>
  );
}
