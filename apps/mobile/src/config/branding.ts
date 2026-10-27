export const BRANDING = {
  name: 'THE TRUCKX',
  legalName: 'THE TRUCKX Logistics Platform',
  tagline: 'Commercial Freight & Logistics Network',
  shortName: 'THE TRUCKX',
  appTitle: 'THE TRUCKX Mobile',
  clientAppTitle: 'THE TRUCKX Client',
  vendorAppTitle: 'THE TRUCKX Vendor',
  driverAppTitle: 'THE TRUCKX Driver',
  supportEmail: 'support@thetruckx.in',
  colors: {
    primary: '#FD5C15',
    primaryOrange: '#FF5E16',
    primaryDark: '#0D0D0D',
    accent: '#FD5C15',
  },
  assets: {
    logo: require('../../assets/trucks-logo-header.png'),
    logoTransparent: require('../../assets/trucks-logo-header-transparent.png'),
    logoSquare: require('../../assets/trucks-logo.png'),
    logoMark: require('../../assets/trucks-logo-mark.png'),
    logoMarkTransparent: require('../../assets/trucks-logo-mark-transparent.png'),
  },

  copyright: `© ${new Date().getFullYear()} THE TRUCKX. All rights reserved.`,
} as const;


export default BRANDING;
