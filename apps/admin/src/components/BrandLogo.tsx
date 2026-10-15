import React from 'react';
import neclLogo from '../assets/images/necl-logo.png';

interface BrandLogoProps {
  variant?: 'full' | 'mark';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  theme = 'light',
  size = 'md',
  className = '',
  style = {},
  alt = 'North Eastern Carriers'
}) => {
  // Height definitions maintaining exact aspect ratio without stretching
  const heightMap: Record<string, number> = {
    sm: 36,
    md: 50,
    lg: 64,
    xl: 80,
  };

  const h = heightMap[size] || 50;

  return (
    <div
      className={`brand-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <img
        src={neclLogo}
        alt={alt}
        style={{
          height: `${h}px`,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          userSelect: 'none',
          filter: theme === 'dark' ? 'brightness(0) invert(1)' : undefined,
        }}
        draggable={false}
      />
    </div>
  );
};

export default BrandLogo;

