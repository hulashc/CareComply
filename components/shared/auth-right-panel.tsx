"use client";

import { useState } from "react";

export function AuthRightPanel() {
  const [videoError, setVideoError] = useState(false);

  return (
    <div className="relative hidden flex-1 lg:flex items-center justify-center overflow-hidden">
      <style>{`
        @keyframes weave {
          0%, 2%    { background-position: 0 0,       30px 30px,    0 0,         30px 30px; }
          10%, 15%  { background-position: 0 0,       30px 30px,    0 30px,      30px 0;    }
          22.5%, 27.5% { background-position: 30px 0, 0 30px,       0 30px,      30px 0;    }
          35%, 40%  { background-position: 30px 0,    0 30px,       0 0,         30px -30px; }
          47.5%, 52.5% { background-position: 0 0,    -30px 30px,   0 0,         30px -30px; }
          60%, 65%  { background-position: 0 0,       -30px 30px,   0 -30px,     30px 0;    }
          72.5%, 77.5% { background-position: -30px 0, 0 30px,      0 -30px,     30px 0;    }
          85%, 90%  { background-position: -30px 0,    0 30px,       0 0,         30px 30px; }
          98%, 100% { background-position: 0 0,        30px 30px,    0 0,         30px 30px; }
        }

        .weave-bg {
          --b: 4px;
          --s: 60px;
          background:
            conic-gradient(from -90deg at calc(50% + var(--b)) calc(100% - var(--b)), transparent 75%, rgba(20,160,140,0.7) 0),
            conic-gradient(from -90deg at calc(50% + var(--b)) calc(100% - var(--b)), transparent 75%, rgba(20,160,140,0.7) 0),
            conic-gradient(from -90deg at var(--b) calc(50% - var(--b)), transparent 75%, rgba(20,160,140,0.7) 0),
            conic-gradient(from -90deg at var(--b) calc(50% - var(--b)), transparent 75%, rgba(20,160,140,0.7) 0),
            hsl(220,40%,15%);
          background-size: var(--s) var(--s);
          animation: weave 10s infinite;
        }
      `}</style>

      <div className="absolute inset-0 weave-bg" />

      {!videoError && (
        <video autoPlay muted loop playsInline preload="auto" className="absolute inset-0 w-full h-full object-cover opacity-15 z-10" onError={() => setVideoError(true)}>
          <source src="/auth-video.mp4" type="video/mp4" />
          <source src="/auth-video.webm" type="video/webm" />
        </video>
      )}
    </div>
  );
}
