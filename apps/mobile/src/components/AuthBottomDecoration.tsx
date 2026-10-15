import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AuthBottomDecorationProps {
  height?: number;
}

export const AuthBottomDecoration: React.FC<AuthBottomDecorationProps> = ({
  height = 190,
}) => {
  return (
    <View style={[styles.container, { height }]} pointerEvents="none">
      {/* Sweeping Navy and Orange Wave Overlay */}
      <View style={styles.svgOverlay}>
        <Svg
          width={SCREEN_WIDTH}
          height={height}
          viewBox={`0 0 ${SCREEN_WIDTH} ${height}`}
        >
          {/* Outer Navy Wave swoosh */}
          <Path
            d={`M0 ${height * 0.45} Q ${SCREEN_WIDTH * 0.28} ${height * 0.72} ${SCREEN_WIDTH * 0.65} ${height * 0.96} L ${SCREEN_WIDTH} ${height} L 0 ${height} Z`}
            fill="#0A1931"
          />

          {/* Inner Orange Accent Wave swoosh */}
          <Path
            d={`M0 ${height * 0.52} Q ${SCREEN_WIDTH * 0.32} ${height * 0.78} ${SCREEN_WIDTH * 0.72} ${height} L 0 ${height} Z`}
            fill="#F05A22"
          />

          {/* Deep Navy Bottom Base */}
          <Path
            d={`M0 ${height * 0.64} Q ${SCREEN_WIDTH * 0.35} ${height * 0.88} ${SCREEN_WIDTH * 0.6} ${height} L 0 ${height} Z`}
            fill="#061224"
          />
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  truckImage: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svgOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
});
