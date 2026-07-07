"use client";

import { cn } from "../../utils/cn";

export default function LogoTicker({ className, gap = 24, items, style, velocity = 60 }) {
  const duration = Math.max(18, Math.round((items.length * (180 + gap)) / velocity));
  const trackStyle = {
    "--logo-ticker-duration": `${duration}s`,
    gap,
  };

  return (
    <div
      className={cn("logo-ticker overflow-hidden", className)}
      style={{
        maskImage:
          "linear-gradient(to right, transparent 5%, black 10%, black 90%, transparent 95%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 5%, black 10%, black 90%, transparent 95%)",
        ...style,
      }}
    >
      <div className="logo-ticker-track flex w-max items-center" style={trackStyle}>
        {items.map((item) => (
          <div className="logo-ticker-item shrink-0" key={`logo-a-${item.key}`}>
            {item}
          </div>
        ))}
        {items.map((item) => (
          <div aria-hidden="true" className="logo-ticker-item shrink-0" key={`logo-b-${item.key}`}>
            {item}
          </div>
        ))}
      </div>
      <style>{`
        .logo-ticker-track {
          animation: logo-ticker-scroll var(--logo-ticker-duration) linear infinite;
        }

        .logo-ticker:hover .logo-ticker-track {
          animation-play-state: paused;
        }

        @keyframes logo-ticker-scroll {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(-50%, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .logo-ticker {
            mask-image: none;
            -webkit-mask-image: none;
          }

          .logo-ticker-track {
            animation: none;
            flex-wrap: wrap;
            justify-content: center;
            transform: none;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
