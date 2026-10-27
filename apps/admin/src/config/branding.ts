import trucksLogo from '../assets/images/trucks-logo-header.png';
import trucksLogoTransparent from '../assets/images/trucks-logo-header-transparent.png';
import trucksLogoSquare from '../assets/images/trucks-logo.png';
import trucksLogoMark from '../assets/images/trucks-logo-mark.png';
import trucksLogoMarkTransparent from '../assets/images/trucks-logo-mark-transparent.png';

export const BRANDING = {
  name: 'THE TRUCKX',
  legalName: 'THE TRUCKX Logistics Platform',
  tagline: 'Commercial Freight & Logistics Network',
  shortName: 'THE TRUCKX',
  platformTitle: 'THE TRUCKX Logistics Portal',
  adminPortalTitle: 'THE TRUCKX Administration Portal',
  supportEmail: 'support@thetruckx.in',
  website: 'https://thetruckx.in',
  colors: {
    primary: '#F4510B',
    primaryOrange: '#F4510B',
    primaryDark: '#0D0D0D',
    accent: '#F4510B',
    textDark: '#111827',
    textLight: '#F9FAFB',
  },
  assets: {
    logo: trucksLogo,
    logoTransparent: trucksLogoTransparent,
    logoSquare: trucksLogoSquare,
    logoMark: trucksLogoMark,
    logoMarkTransparent: trucksLogoMarkTransparent,
  },

  meta: {
    title: 'THE TRUCKX - Commercial Freight & Logistics Network',
    description: 'Enterprise freight management, automated dispatch, live tracking, and digital operations platform.',
  },
  copyright: `© ${new Date().getFullYear()} THE TRUCKX. All rights reserved.`,
} as const;


export default BRANDING;
