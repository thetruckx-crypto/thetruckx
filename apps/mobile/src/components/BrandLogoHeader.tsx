import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface BrandLogoHeaderProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export const BrandLogoHeader: React.FC<BrandLogoHeaderProps> = ({
  size = 'md',
  theme = 'light',
}) => {
  // Dimensions for the logo
  let width = 210;
  let height = 62;

  if (size === 'sm') {
    width = 150;
    height = 44;
  } else if (size === 'lg') {
    width = 250;
    height = 74;
  }

  const logoSource = require('../../assets/necl-logo.png');

  return (
    <View style={styles.container}>
      <Image
        source={logoSource}
        style={{ width, height }}
        resizeMode="contain"
        accessibilityLabel="North Eastern Carriers Logo"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
