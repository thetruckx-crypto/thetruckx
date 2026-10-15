import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface ScenicHeroBannerProps {
  height?: number;
}

export const ScenicHeroBanner: React.FC<ScenicHeroBannerProps> = ({ height = 210 }) => {
  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0A1931" />
            <Stop offset="0.6" stopColor="#112340" />
            <Stop offset="1" stopColor="#172B4D" />
          </LinearGradient>
          <LinearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF8A50" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#F05A22" stopOpacity="0.2" />
          </LinearGradient>
          <LinearGradient id="mountainFar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E293B" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#0F172A" stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id="mountainNear" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#334155" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#1E293B" />
          </LinearGradient>
          <LinearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E293B" />
            <Stop offset="1" stopColor="#0F172A" />
          </LinearGradient>
        </Defs>

        {/* Sky */}
        <Rect x="0" y="0" width={width} height={height} fill="url(#skyGrad)" />

        {/* Rising Orange Sun */}
        <Circle cx={width * 0.5} cy={height * 0.42} r={Math.round(Math.min(46, height * 0.24))} fill="url(#sunGrad)" />

        {/* Far Himalayas / Hills */}
        <Path
          d={`M0 ${height * 0.65} Q ${width * 0.25} ${height * 0.35} ${width * 0.5} ${height * 0.55} T ${width} ${height * 0.45} L ${width} ${height} L 0 ${height} Z`}
          fill="url(#mountainFar)"
        />

        {/* Near Tea Garden Ridges */}
        <Path
          d={`M0 ${height * 0.72} Q ${width * 0.35} ${height * 0.5} ${width * 0.68} ${height * 0.68} T ${width} ${height * 0.6} L ${width} ${height} L 0 ${height} Z`}
          fill="url(#mountainNear)"
        />

        {/* Highway Perspective */}
        <Path
          d={`M${width * 0.46} ${height * 0.66} L${width * 0.54} ${height * 0.66} L${width * 0.76} ${height} L${width * 0.24} ${height} Z`}
          fill="url(#roadGrad)"
        />

        {/* Highway Center Stripes */}
        <Path
          d={`M${width * 0.5} ${height * 0.67} L${width * 0.5} ${height * 0.72}`}
          stroke="#FF6B35"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
        <Path
          d={`M${width * 0.5} ${height * 0.75} L${width * 0.5} ${height * 0.83}`}
          stroke="#FF6B35"
          strokeWidth="2.5"
          strokeOpacity="0.85"
        />
        <Path
          d={`M${width * 0.5} ${height * 0.87} L${width * 0.5} ${height * 0.98}`}
          stroke="#FF6B35"
          strokeWidth="3.5"
          strokeOpacity="1"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});
