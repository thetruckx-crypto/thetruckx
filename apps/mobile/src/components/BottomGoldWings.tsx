import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

export const BottomGoldWings: React.FC = () => {
  return (
    <View style={styles.container}>
      <Svg width={width} height={36} viewBox={`0 0 ${width} 36`}>
        <Defs>
          <LinearGradient id="wingGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FF6B35" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#FF6B35" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#FF6B35" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d={`M0 35 Q ${width * 0.5} 0 ${width} 35`}
          stroke="url(#wingGrad)"
          strokeWidth="1.5"
          fill="none"
        />
      </Svg>
    </View>
  );
};

export const BottomOrangeWings = BottomGoldWings;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    position: 'absolute',
    bottom: 4,
  },
});
