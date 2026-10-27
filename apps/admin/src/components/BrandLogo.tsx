import React from 'react';
import { BRANDING } from '../config/branding';

interface BrandLogoProps {
  variant?: 'full' | 'mark';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'sidebar' | 'auth';
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  theme = 'light',
  size = 'md',
  className = '',
  style = {},
  alt = BRANDING.name,
}) => {
  // Height definitions maintaining exact aspect ratio without stretching
  const heightMap: Record<string, number> = {
    sm: 34,
    sidebar: 44,
    md: 46,
    auth: 54,
    lg: 58,
    xl: 72,
  };

  const isMark = variant === 'mark';
  const h = heightMap[size] || (isMark ? 34 : 46);
  const isDark = theme === 'dark';

  // Choose appropriate transparent asset based on variant
  const logoSrc = isMark
    ? BRANDING.assets.logoMarkTransparent
    : BRANDING.assets.logoTransparent;

  return (
    <div
      className={`brand-logo-container ${isMark ? 'brand-logo-mark' : 'brand-logo-full'} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        ...style,
      }}
    >
      <img
        src={logoSrc}
        alt={alt}
        style={{
          height: `${h}px`,
          width: 'auto',
          maxWidth: isMark ? '44px' : '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          display: 'block',
          userSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  );
};


export default BrandLogo;

