import React from 'react';

interface AddaRasaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  showText?: boolean;
  theme?: 'gold' | 'white' | 'dark';
  width?: number;
  height?: number;
}

export const AddaRasaLogo: React.FC<AddaRasaLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  theme = 'gold',
  width,
  height,
}) => {
  const pixelDimensions = {
    sm: { w: 32, h: 42 },
    md: { w: 64, h: 84 },
    lg: { w: 96, h: 126 },
    xl: { w: 128, h: 168 },
    custom: { w: 64, h: 84 },
  };

  const finalWidth = width || pixelDimensions[size]?.w || 64;
  const finalHeight = height || pixelDimensions[size]?.h || 84;

  const primaryGold = theme === 'white' ? '#FFFFFF' : theme === 'dark' ? '#1a1b22' : '#9D852C';
  const lightGold = theme === 'white' ? '#F3F4F6' : theme === 'dark' ? '#333544' : '#D4BC58';
  const darkGold = theme === 'white' ? '#E5E7EB' : theme === 'dark' ? '#0b0c10' : '#7D671A';

  return (
    <svg
      viewBox="0 0 300 390"
      width={finalWidth}
      height={finalHeight}
      style={{
        width: `${finalWidth}px`,
        height: `${finalHeight}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        flexShrink: 0,
        display: 'inline-block',
      }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} object-contain shrink-0`}
      aria-label="Logo Adda Rasa"
    >
      <defs>
        <linearGradient id="addaRasaGoldGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={lightGold} />
          <stop offset="35%" stopColor={primaryGold} />
          <stop offset="70%" stopColor={lightGold} />
          <stop offset="100%" stopColor={darkGold} />
        </linearGradient>

        <radialGradient id="addaRasaGoldDotGrad" cx="38%" cy="38%" r="62%">
          <stop offset="0%" stopColor={lightGold} />
          <stop offset="65%" stopColor={primaryGold} />
          <stop offset="100%" stopColor={darkGold} />
        </radialGradient>
      </defs>

      {/* Top Text: Adda */}
      {showText && (
        <text
          x="150"
          y="72"
          textAnchor="middle"
          fill="url(#addaRasaGoldGradMain)"
          style={{
            fontFamily: "'Playfair Display', 'Cinzel', 'Times New Roman', Georgia, serif",
            fontWeight: 800,
            fontSize: '72px',
            letterSpacing: '1.5px',
          }}
        >
          Adda
        </text>
      )}

      {/* Center Motif (4 Dots + 4 Hugging Curved Elbow Ribbon Arches) */}
      <g id="center-emblem" transform={showText ? 'translate(150, 192)' : 'translate(150, 195)'}>
        {/* 4 Corner Dots */}
        <circle cx="-74" cy="-75" r="22" fill="url(#addaRasaGoldDotGrad)" />
        <circle cx="74" cy="-75" r="22" fill="url(#addaRasaGoldDotGrad)" />
        <circle cx="74" cy="75" r="22" fill="url(#addaRasaGoldDotGrad)" />
        <circle cx="-74" cy="75" r="22" fill="url(#addaRasaGoldDotGrad)" />

        {/* 4 Curved Ribbon Arms in 4-fold Rotational Symmetry */}
        {/* Arm 1 (Top-Left) */}
        <path
          d="M -8 -102 C -32 -32 -32 -32 -102 -8 L -102 -42 C -52 -50 -50 -52 -42 -102 Z"
          fill="url(#addaRasaGoldGradMain)"
        />

        {/* Arm 2 (Top-Right - 90 deg rotation) */}
        <g transform="rotate(90)">
          <path
            d="M -8 -102 C -32 -32 -32 -32 -102 -8 L -102 -42 C -52 -50 -50 -52 -42 -102 Z"
            fill="url(#addaRasaGoldGradMain)"
          />
        </g>

        {/* Arm 3 (Bottom-Right - 180 deg rotation) */}
        <g transform="rotate(180)">
          <path
            d="M -8 -102 C -32 -32 -32 -32 -102 -8 L -102 -42 C -52 -50 -50 -52 -42 -102 Z"
            fill="url(#addaRasaGoldGradMain)"
          />
        </g>

        {/* Arm 4 (Bottom-Left - 270 deg rotation) */}
        <g transform="rotate(270)">
          <path
            d="M -8 -102 C -32 -32 -32 -32 -102 -8 L -102 -42 C -52 -50 -50 -52 -42 -102 Z"
            fill="url(#addaRasaGoldGradMain)"
          />
        </g>
      </g>

      {/* Bottom Text: Rasa */}
      {showText && (
        <>
          <text
            x="150"
            y="340"
            textAnchor="middle"
            fill="url(#addaRasaGoldGradMain)"
            style={{
              fontFamily: "'Playfair Display', 'Cinzel', 'Times New Roman', Georgia, serif",
              fontWeight: 800,
              fontSize: '72px',
              letterSpacing: '1.5px',
            }}
          >
            Rasa
          </text>

          {/* Underline Bar */}
          <line
            x1="26"
            y1="362"
            x2="274"
            y2="362"
            stroke="url(#addaRasaGoldGradMain)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
};
