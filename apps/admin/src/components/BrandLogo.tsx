import React from 'react';

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
  const logoSrc = theme === 'dark' ? '/necl-logo-white.png' : '/necl-logo.png';

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
        src={logoSrc}
        alt={alt}
        style={{
          height: `${h}px`,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          userSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  );
};

export default BrandLogo;
