import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { BRANDING } from '../config/branding';

interface BrandLogoHeaderProps {
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg' | 'auth';
  theme?: 'light' | 'dark';
  showSubtitle?: boolean;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export const BrandLogoHeader: React.FC<BrandLogoHeaderProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'light',
  tintColor,
  style,
  imageStyle,
}) => {
  // Proportions calibrated to optical logo bounds (~1.89:1)
  // Header: 100-140px wide (sm: 114x38); Auth: 140-190px wide (md: 155x50)
  let width = 155;
  let height = 50;


  if (size === 'sm') {
    width = 114;
    height = 38;
  } else if (size === 'auth') {
    width = 165;
    height = 54;
  } else if (size === 'lg') {
    width = 180;
    height = 58;
  }

  const isMark = variant === 'mark';
  if (isMark) {
    width = 44;
    height = 32;
  }

  const logoSource = isMark
    ? BRANDING.assets.logoMark
    : BRANDING.assets.logo;

  const isDark = theme === 'dark';


  return (
    <View style={[styles.container, isDark ? styles.darkPill : null, style]}>
      <Image
        source={logoSource}

        style={[
          { width, height },
          tintColor ? { tintColor } : null,
          imageStyle,
        ]}
        resizeMode="contain"
        accessibilityLabel={`${BRANDING.name} Logo`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});

export default BrandLogoHeader;
